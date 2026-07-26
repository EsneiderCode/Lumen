import type { UserRole, WorkOrderStatus } from '@/types/enums'

// The work order state machine, kept free of any Supabase import so the offline
// sync path and the tests around it can reason about statuses without a client.

/**
 * Canonical valid transitions for the work order state machine.
 * Any transition not listed here is illegal.
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['executed', 'cancelled'],
  executed: ['rueckmeldung_pending', 'cancelled'],
  rueckmeldung_pending: ['rueckmeldung_sent', 'cancelled'],
  rueckmeldung_sent: ['internally_certified', 'returned', 'cancelled'],
  internally_certified: ['sent_to_client', 'cancelled'],
  sent_to_client: ['client_accepted', 'client_rejected'],
  client_accepted: ['invoiced'],
  client_rejected: ['internally_certified'],
  invoiced: ['paid'],
  returned: ['rueckmeldung_pending'],
  paid: [],
  cancelled: [],
}

/**
 * Statuses that only an admin may transition to.
 * Technicians are limited to the field-reporting portion of the pipeline.
 */
const ADMIN_ONLY_TARGETS = new Set<WorkOrderStatus>([
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
  'paid',
  'returned',
  'cancelled',
])

/**
 * Validates a proposed status transition (pure: machine + role only).
 * Returns an error string if invalid, or null if allowed.
 *
 * Direct orders (no external client) may shortcut from internally_certified
 * straight to invoiced — pass isDirectOrder=true for that case.
 * Mirror of the SQL trigger validate_work_order_status_transition().
 */
export function validateStatusTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  userRole?: UserRole,
  isDirectOrder?: boolean,
): string | null {
  // Direct-order shortcut: internally_certified → invoiced
  const isDirectShortcut =
    isDirectOrder === true && from === 'internally_certified' && to === 'invoiced'

  if (!isDirectShortcut) {
    const allowed = VALID_TRANSITIONS[from]
    if (!allowed.includes(to)) {
      return `Ungültiger Statusübergang: ${from} → ${to}`
    }
  }

  if (userRole && userRole !== 'admin' && ADMIN_ONLY_TARGETS.has(to)) {
    return `Keine Berechtigung: Nur Admins können den Status auf "${to}" setzen`
  }
  return null
}

/**
 * Shortest legal route between two statuses, breadth-first over
 * VALID_TRANSITIONS. `to` is included, `from` is not; `[]` means they are
 * already the same, `null` that the machine has no route at all.
 *
 * A search rather than a hardcoded list of hops because the callers start from
 * whatever status the order happens to be in — which is not always the one the
 * screen was opened with.
 */
export function statusPath(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): WorkOrderStatus[] | null {
  if (from === to) return []

  const cameFrom = new Map<WorkOrderStatus, WorkOrderStatus>()
  const queue: WorkOrderStatus[] = [from]
  const seen = new Set<WorkOrderStatus>([from])

  while (queue.length > 0) {
    const current = queue.shift() as WorkOrderStatus
    for (const next of VALID_TRANSITIONS[current]) {
      if (seen.has(next)) continue
      seen.add(next)
      cameFrom.set(next, current)

      if (next === to) {
        const path: WorkOrderStatus[] = [to]
        let step = to
        while (cameFrom.get(step) !== from) {
          step = cameFrom.get(step) as WorkOrderStatus
          path.unshift(step)
        }
        return path
      }
      queue.push(next)
    }
  }

  return null
}

/**
 * The status hops sending a Rückmeldung has to make from where the order is
 * now. `[]` when it has already been sent — draining the offline queue twice
 * must not be an error.
 *
 * Returns null when there is no route, which is the honest answer for an order
 * that is cancelled, already certified, or still unassigned: an assignment
 * carries a team and a technician and has its own RPC, so a Rückmeldung must
 * never conjure one on its way past.
 */
export function rueckmeldungSendPath(from: WorkOrderStatus): WorkOrderStatus[] | null {
  if (from === 'rueckmeldung_sent') return []
  const path = statusPath(from, 'rueckmeldung_sent')
  if (!path || path.includes('assigned')) return null
  return path
}
