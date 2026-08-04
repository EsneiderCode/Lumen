import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { WorkOrderStatus, WorkType, TeamColor, UserRole } from '@/types/enums'
import {
  assignmentKey,
  fetchComplianceForAssignments,
  fetchProfileCompliance,
  type ProfileComplianceResult,
} from '@/services/complianceService'
import { capturePlanKeyForOrder } from '@/constants/capture-plans'
import { describeMissingNodes, evaluateCapturePlan } from '@/services/capturePlanEngine'
import {
  fetchCapturePlan,
  fetchCapturePlanVersion,
  fetchCaptureReport,
} from '@/services/capturePlanService'
import type { CapturedPhotoRef } from '@/types/capture-plan'
import {
  isDirectWorkOrder,
  toFailureResult,
  toSuccessResult,
  type WorkOrderActionReason,
  type WorkOrderActionResult,
} from '@/services/workOrderBusinessRules'
import type { ServiceItem } from '@/types/service-items'

// ── State machine ──────────────────────────────────────────────────────────
// Lives in workOrderStateMachine.ts (pure, no Supabase); re-exported here
// because every caller already reaches for it through this module.

import {
  rueckmeldungSendPath,
  statusPath,
  validateStatusTransition,
  VALID_TRANSITIONS,
} from '@/services/workOrderStateMachine'

export { VALID_TRANSITIONS, validateStatusTransition, statusPath, rueckmeldungSendPath }

// ── Data prerequisites for transitions (DB-backed) ─────────────────────────

/** Lines of the gate's error message, so the admin is not buried in a wall of text. */
const MAX_LISTED_MISSING_NODES = 6

/**
 * Completeness according to the order's capture plan — the client twin of
 * assert_work_order_rueckmeldung_complete() (migration 056), down to the
 * wording of the message.
 *
 * Every order that was ever captured has a report — migration 055 backfilled
 * the ones that predate the plans — so no report means nobody has reported
 * anything yet.
 */
async function validateCapturePlanCompleteness(
  workOrderId: string,
  order: { work_type: string; capture_plan_key?: string | null },
): Promise<string | null> {
  const { data: report } = await fetchCaptureReport(workOrderId)
  if (!report) return 'Rückmeldung fehlt — Auftrag kann nicht zertifiziert werden'

  const planKey = capturePlanKeyForOrder(order)
  // The pinned version wins, unless the admin has since moved the order to a
  // different plan — that change is a deliberate "capture this differently".
  const pinned =
    report.plan_key === planKey ? await fetchCapturePlanVersion(planKey, report.plan_version) : null
  const plan = pinned ?? (await fetchCapturePlan(planKey))
  if (!plan) return `Erfassungsplan "${planKey}" nicht gefunden — Rückmeldung nicht prüfbar`

  const { data: photos } = await supabase
    .from('work_order_photos')
    .select('id, photo_type, section_key, slot_key, item_id')
    .eq('work_order_id', workOrderId)

  const evaluation = evaluateCapturePlan(plan, (photos ?? []) as CapturedPhotoRef[], report.answers)
  if (evaluation.canSubmit) return null

  const missing = describeMissingNodes(evaluation)
  const shown = missing.slice(0, MAX_LISTED_MISSING_NODES)
  if (missing.length > shown.length) {
    shown.push(`… (+${missing.length - shown.length})`)
  }
  return `Rückmeldung unvollständig (${planKey}): ${shown.join('; ')}`
}

/**
 * Validates DB-backed prerequisites for a status transition.
 * Returns an error string if any prerequisite is not met, or null if OK.
 *
 * Enforces (CLAUDE.md business rules):
 *   1. internally_certified  ← requires a Rückmeldung complete per the order's
 *      capture plan
 *   2. invoiced (with client) ← requires certification_audits row of cert_type='client'
 *   3. invoiced (direct)      ← requires certification_audits row of cert_type='internal'
 */
export async function validateTransitionPrerequisites(
  workOrderId: string,
  toStatus: WorkOrderStatus,
): Promise<string | null> {
  if (toStatus !== 'internally_certified' && toStatus !== 'invoiced') {
    return null
  }

  const { data: order, error: orderError } = await supabase
    .from('work_orders')
    .select('work_type, client_id, capture_plan_key')
    .eq('id', workOrderId)
    .single()

  if (orderError || !order) return 'Auftrag nicht gefunden'

  // ── Rule 1: internally_certified requires complete Rückmeldung
  if (toStatus === 'internally_certified') {
    const planResult = await validateCapturePlanCompleteness(workOrderId, order)
    if (planResult) return planResult
  }

  // ── Rules 2/3: invoiced requires the right certification audit
  if (toStatus === 'invoiced') {
    const isDirect = isDirectWorkOrder(order)
    const requiredCertType: 'internal' | 'client' = isDirect ? 'internal' : 'client'

    const { data: audits } = await supabase
      .from('certification_audits')
      .select('cert_type')
      .eq('work_order_id', workOrderId)
      .eq('cert_type', requiredCertType)
      .limit(1)

    if (!audits || audits.length === 0) {
      return isDirect
        ? 'Direktauftrag kann nicht fakturiert werden ohne interne Zertifizierung'
        : 'Auftrag kann nicht fakturiert werden ohne Kundenakzeptanz'
    }
  }

  return null
}

// ── Collaborator type ──────────────────────────────────────────────────────

/**
 * Internal vs external collaborator — derived from the assignee's profile
 * role, NOT from a column on work_orders. Drives:
 *   · which prices CertificationPage shows the admin (1 column for internal:
 *     unit_price; 2 columns for external: unit_price + unit_price_external).
 *   · whether a `cert_type='external'` audit is expected (only on external).
 */
export type CollaboratorType = 'internal' | 'external'

/**
 * Maps a profile role to the collaborator type for billing/cert routing.
 * Anything other than 'contractor' is treated as internal — that's the
 * safer default (admin and technician are payroll, no external liquidation).
 */
export function getCollaboratorType(profileRole: UserRole | null | undefined): CollaboratorType {
  return profileRole === 'contractor' ? 'external' : 'internal'
}

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row']
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert']
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']
type DirectOrderInsert = Omit<WorkOrderInsert, 'order_number' | 'created_by' | 'client_id'> & {
  client_id: string | null
}
type DirectOrderUpdate = Omit<WorkOrderUpdate, 'client_id' | 'service_item_id'> & {
  client_id?: string | null
  service_item_id?: string | null
}

export interface WorkOrderWithRelations extends WorkOrderRow {
  clients: { name: string; code: string } | null
  projects: {
    name: string
    code: string
    /** Locality and map centre of the project (migration 060). */
    city?: string | null
    center_lat?: number | null
    center_lng?: number | null
  } | null
  operators: { name: string; code: string } | null
  assignedProfile?: { full_name: string } | null
  // service_items join populated by fetchWorkOrder + list fetches
  service_items?: {
    id: string
    code: string
    description_de: string
    description_es: string | null
    unit: string | null
    detail_form: string | null
  } | null
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus
  statuses?: WorkOrderStatus[]
  team?: TeamColor
  work_type?: WorkType
  project_id?: string
  client_id?: string
  search?: string
  date_from?: string // ISO date YYYY-MM-DD
  date_to?: string // ISO date YYYY-MM-DD
  priority?: 'normal' | 'alta' | 'urgente'
}

// ── Lookup tables ─────────────────────────────────────────────

export async function fetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name')
  return { data: data ?? [], error: error?.message ?? null }
}

export interface ProjectLookup {
  id: string
  name: string
  code: string
  client_id: string | null
  default_operator_id: string | null
  default_line: 'NE3' | 'NE4' | null
}

export async function fetchProjects(clientId?: string) {
  let query = supabase
    .from('projects')
    .select('id, name, code, client_id, default_operator_id, default_line' as string)
    .eq('is_active', true)
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query.order('code')
  return {
    data: (data ?? []) as unknown as ProjectLookup[],
    error: error?.message ?? null,
  }
}

export async function fetchOperators() {
  const { data, error } = await supabase
    .from('operators')
    .select('id, name, code')
    .eq('is_active', true)
    .order('code')
  return { data: data ?? [], error: error?.message ?? null }
}

export interface TechnicianProfile {
  id: string
  full_name: string
  team: TeamColor | null
  role: 'technician' | 'contractor'
}

export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, team, role')
    .in('role', ['technician', 'contractor'])
    .eq('is_active', true)
    .order('full_name')
  return { data: (data ?? []) as unknown as TechnicianProfile[], error: error?.message ?? null }
}

// ── Work Orders CRUD ─────────────────────────────────────────

export async function fetchWorkOrders(filters: WorkOrderFilters = {}, page = 0, pageSize = 25) {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('work_orders')
    .select(
      `
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.statuses && filters.statuses.length > 0) {
    // Use .or() instead of .in() — more reliable with PostgreSQL enum columns
    query = query.or(filters.statuses.map((s) => `status.eq.${s}`).join(','))
  } else if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.team) query = query.eq('assigned_team', filters.team)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (filters.work_type) query = query.eq('work_type', filters.work_type as any)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.client_id) query = query.eq('client_id', filters.client_id)
  if (filters.search) {
    // Strip PostgREST operator characters to prevent filter-string injection
    const term = filters.search.replace(/[.,()]/g, '')
    // POP y DP se guardan sin el prefijo del proyecto ni el 'DP' (migración
    // 064), así que buscar «QFF001-DP021» tal como se ve en la lista no casaría
    // con ninguna de las dos columnas. Se buscan los números sueltos del término
    // («QFF001-DP021» → 001, 021), que es lo que sí está guardado.
    const siteFilters = [...new Set(term.match(/\d+/g) ?? [])].flatMap((part) => [
      `pop_code.ilike.%${part}%`,
      `dp_code.ilike.%${part}%`,
    ])
    query = query.or(
      [`order_number.ilike.%${term}%`, `address.ilike.%${term}%`, ...siteFilters].join(','),
    )
  }
  if (filters.date_from) query = query.gte('assigned_date', filters.date_from)
  if (filters.date_to) query = query.lte('assigned_date', filters.date_to)
  if (filters.priority) query = query.eq('priority', filters.priority)

  const { data, error, count } = await query
  return {
    data: (data ?? []) as unknown as WorkOrderWithRelations[],
    total: count ?? 0,
    error: error?.message ?? null,
  }
}

export async function fetchWorkOrder(id: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(
      `
      *,
      clients ( name, code ),
      projects ( name, code, city, center_lat, center_lng ),
      operators ( name, code ),
      service_items ( id, code, description_de, description_es, unit, detail_form )
    `,
    )
    .eq('id', id)
    .single()
  return { data: data as unknown as WorkOrderWithRelations | null, error: error?.message ?? null }
}

export async function createWorkOrder(payload: DirectOrderInsert, userId: string) {
  // Generate order number atomically via DB sequence (migration 003)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seqData, error: seqError } = await (supabase as any).rpc('generate_order_number')
  if (seqError || !seqData) {
    return {
      data: null,
      error: seqError?.message ?? 'Auftragsnummer konnte nicht generiert werden',
    }
  }
  const order_number = seqData as string

  const { data, error } = await supabase
    .from('work_orders')
    .insert({ ...payload, order_number, created_by: userId } as never)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  // Record initial state in history
  await supabase.from('work_order_state_history').insert({
    work_order_id: data.id,
    from_status: null,
    to_status: 'created',
    changed_by: userId,
    notes: 'Auftrag erstellt',
  })

  return { data, error: null }
}

export async function updateWorkOrder(id: string, payload: DirectOrderUpdate) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single()
  return { data, error: error?.message ?? null }
}

export async function deleteWorkOrder(id: string) {
  const { error } = await supabase.from('work_orders').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Assignment (LUM-010) ──────────────────────────────────────

/**
 * One entry of {@link WorkOrderRow.assigned_team_roster} — the crew documented on
 * the order at assignment time (migration 073). Documentation only: it carries no
 * price (technicians and contractors never see money) and no policy, view or RPC
 * may read it to grant access. The single person who can work the order is
 * `assigned_technician`, flagged here as `is_responsible`.
 */
export interface AssignedTeamRosterEntry {
  profile_id: string
  full_name: string
  role: string
  is_responsible: boolean
}

/**
 * Reads the documented roster off a work order row. The column is JSONB and
 * `database.types.ts` is not regenerated on every machine, so the value arrives
 * untyped; anything that is not a well-formed entry list is dropped rather than
 * rendered half-parsed.
 */
export function parseAssignedTeamRoster(value: unknown): AssignedTeamRosterEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const profileId = record.profile_id
    if (typeof profileId !== 'string' || !profileId) return []
    return [
      {
        profile_id: profileId,
        full_name: typeof record.full_name === 'string' ? record.full_name : '',
        role: typeof record.role === 'string' ? record.role : '',
        is_responsible: record.is_responsible === true,
      },
    ]
  })
}

/**
 * Machine-readable marker for "an assignment needs a responsible technician".
 * The service layer carries no i18next (no other service imports it); the screen
 * translates this code, so the user never sees an English literal.
 */
export const ASSIGNMENT_REQUIRES_TECHNICIAN = 'assignment.requires_technician'

/**
 * Snapshot of the crew that was active in `team` when the order was assigned,
 * with `responsibleId` marked. Returns `{ roster: null }` when there is no team —
 * a direct personal assignment documents nobody else.
 *
 * A failed query is NOT an empty team. Returning `[]` there would write a
 * document claiming the order has no crew, and `assignWorkOrder` would report
 * success — so the error is propagated and the assignment is abandoned instead.
 */
async function buildAssignedTeamRoster(
  team: TeamColor | null,
  responsibleId: string,
): Promise<{ roster: AssignedTeamRosterEntry[] | null; error: string | null }> {
  if (!team) return { roster: null, error: null }

  // Same population the assign screen previews (fetchTechnicians): the field
  // crew, not every profile that happens to carry a team.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('team', team)
    .eq('is_active', true)
    .in('role', ['technician', 'contractor'])
    .order('full_name')

  if (error) return { roster: null, error: error.message }

  const members = (data ?? []) as unknown as {
    id: string
    full_name: string | null
    role: string | null
  }[]

  const roster: AssignedTeamRosterEntry[] = members.map((member) => ({
    profile_id: member.id,
    full_name: member.full_name ?? '',
    role: member.role ?? '',
    is_responsible: member.id === responsibleId,
  }))

  // The responsible person is documented even when they are not (or no longer) a
  // member of the crew — a roster that omits them would document a lie.
  if (!roster.some((entry) => entry.is_responsible)) {
    const { data: responsible, error: responsibleError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', responsibleId)
      .single()

    if (responsibleError) return { roster: null, error: responsibleError.message }
    const person = responsible as unknown as {
      id: string
      full_name: string | null
      role: string | null
    } | null
    roster.unshift({
      profile_id: responsibleId,
      full_name: person?.full_name ?? '',
      role: person?.role ?? '',
      is_responsible: true,
    })
  }

  return { roster, error: null }
}

export async function assignWorkOrder(
  id: string,
  team: TeamColor | null,
  assignedDate: string | null,
  changedBy: string,
  technicianId: string | null = null,
  reassignmentNote: string | null = null,
  /**
   * Audited compliance override (Fase 3). When set, a red/no-entity contractor
   * is force-assigned and the reason/actor are stamped on the order; the DB gate
   * (migration 047) only honours the override when a non-empty reason is present.
   */
  complianceOverride: { reason: string; by: string } | null = null,
): Promise<{
  data: WorkOrderRow | null
  error: string | null
  reasons?: WorkOrderActionReason[]
}> {
  // Every order gets exactly ONE responsible person (migration 073). A team-only
  // assignment used to leave assigned_technician null, which under the real RLS
  // meant nobody could open the order — and, before 073, meant the whole crew
  // could reach its documents and photos.
  if (!technicianId) {
    return {
      data: null,
      error: ASSIGNMENT_REQUIRES_TECHNICIAN,
      reasons: [{ code: 'invalid_transition', message: ASSIGNMENT_REQUIRES_TECHNICIAN }],
    }
  }

  const { data: current } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', id)
    .single()

  const fromStatus = current?.status ?? null

  // Always write the four override columns so a stale flag from a prior
  // (overridden) assignment never lingers on a now-compliant reassignment.
  const overrideColumns = complianceOverride
    ? {
        compliance_override: true,
        compliance_override_reason: complianceOverride.reason,
        compliance_override_by: complianceOverride.by,
        compliance_override_at: new Date().toISOString(),
      }
    : {
        compliance_override: false,
        compliance_override_reason: null,
        compliance_override_by: null,
        compliance_override_at: null,
      }

  // Documentary snapshot of the crew present at assignment time (migration 073).
  // `assigned_team` keeps being written for migration 068, which still reads it.
  const { roster, error: rosterError } = await buildAssignedTeamRoster(team, technicianId)

  // Assigning with a roster we could not read would stamp a false document on
  // the order. Better no assignment than a wrong record of who was there.
  if (rosterError) {
    return {
      data: null,
      error: rosterError,
      reasons: [{ code: 'server_error', message: rosterError }],
    }
  }

  const payload: Record<string, unknown> = {
    assigned_team: team,
    assigned_technician: technicianId,
    assigned_team_roster: roster,
    assigned_date: assignedDate,
    status: 'assigned',
    updated_at: new Date().toISOString(),
    ...overrideColumns,
  }

  const { data, error } = await supabase
    .from('work_orders')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  const overrideNote = complianceOverride
    ? ` · Compliance-Override: ${complianceOverride.reason}`
    : ''

  await supabase.from('work_order_state_history').insert({
    work_order_id: id,
    from_status: fromStatus,
    to_status: 'assigned',
    changed_by: changedBy,
    notes: `Zugewiesen an ${team ? `Team ${team}` : 'Techniker (direkt)'}${team ? ` · Verantwortlich: 1 Person · Team dokumentiert: ${roster?.length ?? 0}` : ''}${reassignmentNote ? ` · Grund: ${reassignmentNote}` : ''}${overrideNote}`,
  })

  return { data, error: null }
}

/**
 * Per-obra compliance semáforo for a list of orders (Fase 3). Resolves which
 * assignees are contractors — only they are gated — then batch-computes aptitude
 * for each (contractor, obra) pair. Returns a map keyed by {@link assignmentKey};
 * orders assigned to a team, an internal technician, or nobody are absent.
 */
export async function fetchOrderComplianceMap(
  orders: { assigned_technician: string | null; project_id: string | null }[],
): Promise<Map<string, ProfileComplianceResult>> {
  const techIds = [
    ...new Set(orders.map((o) => o.assigned_technician).filter((x): x is string => Boolean(x))),
  ]
  if (techIds.length === 0) return new Map()

  const { data: profs } = await supabase.from('profiles').select('id, role').in('id', techIds)
  const contractorIds = new Set(
    ((profs ?? []) as { id: string; role: UserRole }[])
      .filter((p) => p.role === 'contractor')
      .map((p) => p.id),
  )
  if (contractorIds.size === 0) return new Map()

  const pairs = orders
    .filter((o) => o.assigned_technician && contractorIds.has(o.assigned_technician))
    .map((o) => ({ profileId: o.assigned_technician as string, projectId: o.project_id ?? null }))
  if (pairs.length === 0) return new Map()

  const { data } = await fetchComplianceForAssignments(pairs)
  return data
}

export { assignmentKey }

// ── Detail tables ─────────────────────────────────────────────

export type DetailTable =
  | 'wo_detail_soplado'
  | 'wo_detail_fusion_ap'
  | 'wo_detail_fusion_dp'
  | 'wo_detail_alta'
  | 'wo_detail_nt'
  | 'wo_detail_patchkabel'
  | 'wo_detail_pop'

export function workTypeToDetailTable(workType: WorkType): DetailTable {
  const map: Record<WorkType, DetailTable> = {
    soplado: 'wo_detail_soplado',
    fusion_ap: 'wo_detail_fusion_ap',
    fusion_dp: 'wo_detail_fusion_dp',
    alta: 'wo_detail_alta',
    nt_installation: 'wo_detail_nt',
    patchkabel: 'wo_detail_patchkabel',
    pop: 'wo_detail_pop',
  }
  return map[workType]
}

export interface WorkOrderDetailMutationResult {
  error: string | null
  errorCode: string | null
  errorContext: 'detail_upsert' | null
}

export async function upsertWorkOrderDetail(
  table: DetailTable,
  workOrderId: string,
  detail: Record<string, unknown>,
): Promise<WorkOrderDetailMutationResult> {
  const { error } = await supabase
    .from(table as 'wo_detail_soplado')
    .upsert(
      { ...detail, work_order_id: workOrderId } as Database['public']['Tables']['wo_detail_soplado']['Insert'],
      { onConflict: 'work_order_id' },
    )

  return {
    error: error?.message ?? null,
    errorCode: error?.code ?? null,
    errorContext: error ? 'detail_upsert' : null,
  }
}

export async function fetchWorkOrderDetail(table: DetailTable, workOrderId: string) {
  // Use array + limit instead of maybeSingle() to avoid errors when
  // duplicate rows exist (can happen if RLS blocked SELECT on first attempt)
  const { data, error } = await supabase
    .from(table as 'wo_detail_soplado')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
  const row = data && data.length > 0 ? data[0] : null
  return { data: row, error: error?.message ?? null }
}

// ── Technician / Sprint 4 ──────────────────────────────────────

/**
 * Orders the signed-in field user is responsible for.
 *
 * `team` is kept in the signature so callers do not have to change, but it is
 * deliberately unused: an order reaches exactly one person, its
 * `assigned_technician`. The old `.or(assigned_team.eq...)` branch was dead code
 * — RLS (`work_orders_technician_select`) has always required
 * `assigned_technician = auth.uid()`, so team-matched rows never came back — and
 * since migration 073 it would also misdescribe the rule.
 */
export async function fetchMyWorkOrders(
  userId: string,
  _team: string | null,
  page = 0,
  pageSize = 20,
) {
  const from = page * pageSize
  const to = from + pageSize - 1

  const query = supabase
    .from('work_orders')
    .select(
      `
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `,
      { count: 'exact' },
    )
    .eq('assigned_technician', userId)
    .not('status', 'in', '("cancelled","paid")')
    .order('assigned_date', { ascending: true, nullsFirst: false })
    .range(from, to)

  const { data, error, count } = await query
  return {
    data: (data ?? []) as unknown as WorkOrderWithRelations[],
    total: count ?? 0,
    error: error?.message ?? null,
  }
}

type WorkOrderTransitionErrorContext =
  | 'status_read'
  | 'transition_validation'
  | 'transition_prerequisite'
  | 'status_update'

export interface WorkOrderTransitionResult {
  data: WorkOrderRow | null
  error: string | null
  errorCode: string | null
  errorContext: WorkOrderTransitionErrorContext | null
  warning: string | null
  warningCode: string | null
  warningContext: 'state_history' | null
}

function transitionFailure(
  message: string,
  code: string | null,
  context: WorkOrderTransitionErrorContext,
): WorkOrderTransitionResult {
  return {
    data: null,
    error: message,
    errorCode: code,
    errorContext: context,
    warning: null,
    warningCode: null,
    warningContext: null,
  }
}

export async function transitionWorkOrderStatus(
  id: string,
  toStatus: WorkOrderStatus,
  changedBy: string,
  notes?: string,
  userRole?: UserRole,
): Promise<WorkOrderTransitionResult> {
  const { data: current, error: currentError } = await supabase
    .from('work_orders')
    .select('status, client_id')
    .eq('id', id)
    .single()

  if (currentError) {
    return transitionFailure(currentError.message, currentError.code, 'status_read')
  }

  const fromStatus = current?.status ?? null
  const isDirectOrder = current ? isDirectWorkOrder(current) : false

  if (fromStatus) {
    const validationError = validateStatusTransition(
      fromStatus as WorkOrderStatus,
      toStatus,
      userRole,
      isDirectOrder,
    )
    if (validationError) return transitionFailure(validationError, null, 'transition_validation')
  }

  const prereqError = await validateTransitionPrerequisites(id, toStatus)
  if (prereqError) return transitionFailure(prereqError, null, 'transition_prerequisite')

  const { data, error } = await supabase
    .from('work_orders')
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return transitionFailure(error.message, error.code, 'status_update')

  const { error: historyError } = await supabase.from('work_order_state_history').insert({
    work_order_id: id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    notes: notes ?? null,
  })

  if (historyError) {
    console.error('Work-order status transition succeeded but state history insert failed', {
      workOrderId: id,
      toStatus,
      code: historyError.code,
      message: historyError.message,
    })
  }

  return {
    data,
    error: null,
    errorCode: null,
    errorContext: null,
    warning: historyError?.message ?? null,
    warningCode: historyError?.code ?? null,
    warningContext: historyError ? 'state_history' : null,
  }
}

interface LifecycleRpcArgs {
  workOrderId: string
  changedBy: string
  dataHash?: string
  billingReference?: string | null
  notes?: string | null
}

function mapLifecycleValidationError(message: string): WorkOrderActionReason {
  const lower = message.toLowerCase()
  if (lower.includes('foto')) {
    return { code: 'missing_required_photos', message }
  }
  if (lower.includes('rückmeldung') || lower.includes('rueckmeldung')) {
    return { code: 'incomplete_rueckmeldung', message }
  }
  return { code: 'invalid_transition', message }
}

function mapRpcLifecycleError(message: string): WorkOrderActionReason {
  const lower = message.toLowerCase()
  if (lower.includes('client') && lower.includes('audit')) {
    return { code: 'missing_client_audit', message }
  }
  if (lower.includes('internal') && lower.includes('audit')) {
    return { code: 'missing_internal_audit', message }
  }
  // The gate raises in German ("Rückmeldung unvollständig …"), so the umlaut
  // spelling has to be here or every rejected certification reads as a server
  // error to the admin.
  if (lower.includes('rueckmeldung') || lower.includes('rückmeldung')) {
    return { code: 'incomplete_rueckmeldung', message }
  }
  if (lower.includes('erfassungsplan')) {
    return { code: 'incomplete_rueckmeldung', message }
  }
  if (lower.includes('foto')) {
    return { code: 'missing_required_photos', message }
  }
  if (lower.includes('not found')) {
    return { code: 'not_found', message }
  }
  if (lower.includes('invalid') || lower.includes('requires')) {
    return { code: 'invalid_transition', message }
  }
  return { code: 'server_error', message }
}

function validateLifecycleDataHash(dataHash: string | undefined): WorkOrderActionReason[] {
  if (!dataHash || dataHash.trim().length === 0) {
    return [{ code: 'invalid_transition', message: 'Certification audit data hash is required' }]
  }
  return []
}

async function callLifecycleRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<WorkOrderActionResult<WorkOrderRow>> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: WorkOrderRow | null; error: { message: string } | null }>
    }
  ).rpc(fn, args)

  if (error) return toFailureResult([mapRpcLifecycleError(error.message)])
  return toSuccessResult(data as WorkOrderRow)
}

export async function certifyWorkOrderInternal(
  args: LifecycleRpcArgs,
): Promise<WorkOrderActionResult<WorkOrderRow>> {
  const hashErrors = validateLifecycleDataHash(args.dataHash)
  if (hashErrors.length > 0) return toFailureResult(hashErrors)

  const prerequisiteError = await validateTransitionPrerequisites(
    args.workOrderId,
    'internally_certified',
  )
  if (prerequisiteError) {
    return toFailureResult([mapLifecycleValidationError(prerequisiteError)])
  }

  // Supabase's browser client cannot wrap this insert and the lifecycle RPC in
  // one transaction. Materialize first: a later transition failure may leave a
  // harmless draft line on a still-pending order, but we must never seal an
  // order that has no immutable price snapshot.
  const billingResult = await materializeBillingLinesForInternalCertification(args.workOrderId)
  if (billingResult.error) {
    return toFailureResult([{ code: 'server_error', message: billingResult.error }])
  }

  return callLifecycleRpc('certify_work_order_internal', {
    p_work_order_id: args.workOrderId,
    p_changed_by: args.changedBy,
    p_data_hash: args.dataHash!.trim(),
    p_notes: args.notes ?? null,
  })
}

export async function acceptWorkOrderClient(
  args: LifecycleRpcArgs,
): Promise<WorkOrderActionResult<WorkOrderRow>> {
  const hashErrors = validateLifecycleDataHash(args.dataHash)
  if (hashErrors.length > 0) return toFailureResult(hashErrors)

  return callLifecycleRpc('accept_work_order_client', {
    p_work_order_id: args.workOrderId,
    p_changed_by: args.changedBy,
    p_data_hash: args.dataHash!.trim(),
    p_notes: args.notes ?? null,
  })
}

export async function invoiceWorkOrder(
  args: LifecycleRpcArgs,
): Promise<WorkOrderActionResult<WorkOrderRow>> {
  return callLifecycleRpc('invoice_work_order_checked', {
    p_work_order_id: args.workOrderId,
    p_changed_by: args.changedBy,
    p_billing_reference: args.billingReference ?? null,
    p_notes: args.notes ?? null,
  })
}

export type BulkWorkOrderAction =
  | 'internal_certify'
  | 'send_to_client'
  | 'client_accept'
  | 'invoice'
export type BulkWorkOrderOutcome = 'succeeded' | 'failed' | 'skipped'

export interface BulkWorkOrderInputItem {
  id: string
  orderNumber?: string
}

export interface BulkWorkOrderItemResult {
  workOrderId: string
  orderNumber?: string
  outcome: BulkWorkOrderOutcome
  reasons: WorkOrderActionReason[]
}

export interface BulkWorkOrderResult {
  action: BulkWorkOrderAction
  total: number
  succeeded: number
  failed: number
  skipped: number
  items: BulkWorkOrderItemResult[]
}

export async function bulkWorkOrderAction(args: {
  action: BulkWorkOrderAction
  workOrders: BulkWorkOrderInputItem[]
  changedBy: string
  dataHash?: string
  billingReference?: string | null
  notes?: string | null
}): Promise<BulkWorkOrderResult> {
  const items: BulkWorkOrderItemResult[] = []

  for (const workOrder of args.workOrders) {
    try {
      let result: WorkOrderActionResult<WorkOrderRow>
      if (args.action === 'invoice') {
        result = await invoiceWorkOrder({
          workOrderId: workOrder.id,
          changedBy: args.changedBy,
          billingReference: args.billingReference ?? null,
          notes: args.notes ?? null,
        })
      } else if (args.action === 'internal_certify') {
        result = await certifyWorkOrderInternal({
          workOrderId: workOrder.id,
          changedBy: args.changedBy,
          dataHash: args.dataHash ?? '',
          notes: args.notes ?? null,
        })
      } else if (args.action === 'client_accept') {
        result = await acceptWorkOrderClient({
          workOrderId: workOrder.id,
          changedBy: args.changedBy,
          dataHash: args.dataHash ?? '',
          notes: args.notes ?? null,
        })
      } else {
        items.push({
          workOrderId: workOrder.id,
          orderNumber: workOrder.orderNumber,
          outcome: 'skipped',
          reasons: [
            {
              code: 'invalid_transition',
              message: `Bulk action ${args.action} is not supported by the RPC workflow yet`,
            },
          ],
        })
        continue
      }

      items.push({
        workOrderId: workOrder.id,
        orderNumber: workOrder.orderNumber,
        outcome: result.ok ? 'succeeded' : 'failed',
        reasons: result.reasons,
      })
    } catch (error) {
      items.push({
        workOrderId: workOrder.id,
        orderNumber: workOrder.orderNumber,
        outcome: 'failed',
        reasons: [
          {
            code: 'server_error',
            message: error instanceof Error ? error.message : 'Unexpected bulk action error',
          },
        ],
      })
    }
  }

  return {
    action: args.action,
    total: args.workOrders.length,
    succeeded: items.filter((item) => item.outcome === 'succeeded').length,
    failed: items.filter((item) => item.outcome === 'failed').length,
    skipped: items.filter((item) => item.outcome === 'skipped').length,
    items,
  }
}

export async function fetchStateHistory(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_state_history')
    .select('*, profiles ( full_name )')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error: error?.message ?? null }
}

// ── Contractor (LUM-019) ──────────────────────────────────────

/**
 * Same rule as {@link fetchMyWorkOrders}: one order, one responsible person.
 * `team` is unused on purpose — see that function for why the team branch went.
 */
export async function fetchContractorWorkOrders(userId: string, _team: string | null) {
  const query = supabase
    .from('work_orders')
    .select(
      `
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `,
    )
    .eq('assigned_technician', userId)
    .order('assigned_date', { ascending: false, nullsFirst: false })

  const { data, error } = await query
  return {
    data: (data ?? []) as unknown as WorkOrderWithRelations[],
    error: error?.message ?? null,
  }
}

export async function fetchWorkOrderPhotos(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_photos')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error: error?.message ?? null }
}

export async function uploadWorkOrderPhoto(
  workOrderId: string,
  photoType: 'before' | 'during' | 'after',
  file: File,
  userId: string,
) {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${Date.now()}.${ext}`
  const storagePath = `${workOrderId}/${photoType}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('work-order-photos')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data, error } = await supabase
    .from('work_order_photos')
    .insert({
      work_order_id: workOrderId,
      storage_path: storagePath,
      photo_type: photoType,
      uploaded_by: userId,
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

/** Returns a short-lived signed URL (1 hour) for a single photo. */
export async function getPhotoSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('work-order-photos')
    .createSignedUrl(storagePath, expiresIn)
  if (error || !data) return ''
  return data.signedUrl
}

/**
 * Batch-resolves signed URLs for multiple photos.
 * Returns a map of storagePath → signedUrl.
 */
export async function getPhotoSignedUrls(
  storagePaths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from('work-order-photos')
    .createSignedUrls(storagePaths, expiresIn)
  if (error || !data) return {}
  return Object.fromEntries(
    data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]),
  )
}

export async function deleteWorkOrderPhoto(photoId: string, storagePath: string) {
  const { error: storageError } = await supabase.storage
    .from('work-order-photos')
    .remove([storagePath])
  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase.from('work_order_photos').delete().eq('id', photoId)
  return { error: dbError?.message ?? null }
}

// ── Sprint 7 — Certification Review (LUM-023 / LUM-024) ──────────────────

// LUM-023's writer is gone: the order form no longer asks the office for
// technical data, so nothing produces an `assigned_detail_snapshot` any more.
// The column and the orders that already carry one stay untouched, and the
// admin detail page still shows their Assigned-vs-Reported table.

/**
 * LUM-024: Generate a SHA-256 hex digest of the provided data object.
 * Keys are sorted for determinism. Used for certification audit hashes.
 */
export async function generateDataHash(data: Record<string, unknown>): Promise<string> {
  const str = JSON.stringify(data, Object.keys(data).sort())
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * LUM-024: Insert a certification audit record.
 */
export async function insertCertificationAudit(
  workOrderId: string,
  certType: 'internal' | 'client' | 'external',
  certifiedBy: string,
  dataHash: string,
  notes?: string,
) {
  if (certType === 'external') {
    const { data: order, error: orderError } = await supabase
      .from('work_orders')
      .select('assigned_technician, project_id')
      .eq('id', workOrderId)
      .single()

    if (orderError || !order?.assigned_technician) {
      return { error: 'External certification requires a contractor assignee' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', order.assigned_technician)
      .single()

    if (profileError || getCollaboratorType(profile?.role as UserRole | null) !== 'external') {
      return { error: 'External certification requires a contractor assignee' }
    }

    // Pre-flight mirror of the DB gate (migration 046): the contractor's
    // compliance entity must be apt (non-red) for this obra.
    const { data: compliance, error: complianceError } = await fetchProfileCompliance(
      order.assigned_technician,
      order.project_id,
    )
    if (complianceError) return { error: complianceError }
    if (compliance.isBlocked) {
      return {
        error: compliance.hasEntity
          ? `External certification blocked: contractor compliance incomplete, unapproved, or expired (${compliance.missingCodes.join(', ')})`
          : 'External certification blocked: contractor has no compliance record — onboard them in the compliance module',
      }
    }
  }

  const { error } = await supabase
    .from('certification_audits' as 'work_orders') // cast — table added in migration 002
    .insert({
      work_order_id: workOrderId,
      cert_type: certType,
      certified_by: certifiedBy,
      data_hash: dataHash,
      notes: notes ?? null,
    } as never)
  return { error: error?.message ?? null }
}

/**
 * LUM-024: Fetch all certification audits for a work order.
 */
export async function fetchCertificationAudits(workOrderId: string) {
  const { data, error } = await supabase
    .from('certification_audits')
    .select('*, profiles ( full_name )')
    .eq('work_order_id', workOrderId)
    .order('certified_at', { ascending: true })
  return {
    data: (data ?? []) as unknown as Array<{
      id: string
      cert_type: 'internal' | 'client' | 'external'
      certified_at: string
      data_hash: string
      notes: string | null
      profiles: { full_name: string } | null
    }>,
    error: error?.message ?? null,
  }
}

// ── Field-reported service items + admin billing lines ─────────────────────

export interface ReportedServiceItemDraft {
  service_item_id: string
  qty: number
  notes?: string | null
}

export function normalizeReportedServiceItems(value: unknown): ReportedServiceItemDraft[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const serviceItemId = typeof row.service_item_id === 'string' ? row.service_item_id.trim() : ''
    const qty = Number(row.qty)
    if (!serviceItemId || !Number.isFinite(qty) || qty <= 0) return []

    const rawNotes = row.notes
    return [
      {
        service_item_id: serviceItemId,
        qty,
        notes: typeof rawNotes === 'string' && rawNotes.trim() ? rawNotes.trim() : null,
      },
    ]
  })
}

export function buildBillingDraftsFromReportedItems(
  reportedItems: ReportedServiceItemDraft[],
  catalog: ServiceItem[],
): BillingLineDraft[] {
  const catalogById = new Map(catalog.map((item) => [item.id, item]))

  return normalizeReportedServiceItems(reportedItems).flatMap((item) => {
    const catalogItem = catalogById.get(item.service_item_id)
    if (!catalogItem || catalogItem.unit_price == null) return []

    return [
      {
        service_item_id: item.service_item_id,
        qty: item.qty,
        unit_price_snapshot: Number(catalogItem.unit_price),
        unit_price_external_snapshot: catalogItem.unit_price_external ?? null,
        notes: item.notes ?? null,
      },
    ]
  })
}

export interface BillingLine {
  id: string
  work_order_id: string
  service_item_id: string
  qty: number
  unit_price_snapshot: number
  unit_price_external_snapshot: number | null
  subtotal: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BillingLineDraft {
  id?: string // present = update, absent = insert
  service_item_id: string
  qty: number
  unit_price_snapshot: number // snapshot at create — never re-derived
  unit_price_external_snapshot?: number | null
  notes?: string | null
}

export interface BillingMaterializationResult {
  /** True only when this call inserted the immutable snapshots. */
  created: boolean
  error: string | null
}

function positiveBillingQuantity(value: unknown): number | null {
  const quantity = Number(value)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

/**
 * The primary service represented by most work orders is a discrete unit. The
 * technical counts in those capture plans document the work but are not the
 * catalog multiplier: e.g. DP installation is priced per UDS, fusion AP per
 * cabinet, patch cable per connection, NT per device and POP per installation.
 * Soplado is the exception in the current catalog — it is explicitly priced by
 * linear metre, so its submitted `details.meters` is the billable quantity.
 * Alta remains multi-line and carries explicit quantities in
 * `reported_service_items`.
 */
function derivePrimaryBillingQuantity(
  workType: string,
  answers: Record<string, unknown>,
): { quantity: number | null; error: string | null } {
  if (
    workType === 'fusion_ap' ||
    workType === 'fusion_dp' ||
    workType === 'nt_installation' ||
    workType === 'patchkabel' ||
    workType === 'pop'
  ) {
    return { quantity: 1, error: null }
  }
  if (workType !== 'soplado') {
    return {
      quantity: null,
      error: `Keine Abrechnungsregel für Auftragstyp ${workType} vorhanden — interne Zertifizierung abgebrochen.`,
    }
  }

  const details = answers.details
  const meters =
    details && typeof details === 'object'
      ? positiveBillingQuantity((details as Record<string, unknown>).meters)
      : null
  if (meters === null) {
    return {
      quantity: null,
      error:
        'Keine gültige Abrechnungsmenge: In der Rückmeldung fehlen die geleisteten Meter (Wert muss größer als 0 sein).',
    }
  }
  return { quantity: meters, error: null }
}

/**
 * Create immutable billing snapshots immediately before internal
 * certification. Existing lines win unchanged: retrying certification must
 * neither duplicate them nor silently apply a newer catalog price.
 */
export async function materializeBillingLinesForInternalCertification(
  workOrderId: string,
): Promise<BillingMaterializationResult> {
  const { data: order, error: orderError } = await supabase
    .from('work_orders')
    .select('work_type, service_item_id')
    .eq('id', workOrderId)
    .single()
  if (orderError || !order) {
    return { created: false, error: 'Auftrag nicht gefunden — Abrechnung nicht möglich.' }
  }
  if (!order.service_item_id) {
    return {
      created: false,
      error: 'Kein Service-Posten am Auftrag hinterlegt — interne Zertifizierung abgebrochen.',
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('work_order_billing_lines')
    .select('id')
    .eq('work_order_id', workOrderId)
  if (existingError) return { created: false, error: existingError.message }
  if ((existing ?? []).length > 0) return { created: false, error: null }

  const { data: report, error: reportError } = await fetchCaptureReport(workOrderId)
  if (reportError) return { created: false, error: reportError }
  if (!report) {
    return {
      created: false,
      error: 'Keine Rückmeldung vorhanden — Abrechnungsmenge kann nicht ermittelt werden.',
    }
  }

  let reportedItems: ReportedServiceItemDraft[]
  if (order.work_type === 'alta') {
    const rawReportedItems = report.reported_service_items
    reportedItems = normalizeReportedServiceItems(rawReportedItems)
    if (!Array.isArray(rawReportedItems) || reportedItems.length === 0) {
      return {
        created: false,
        error: 'Keine geleisteten Service-Posten für diese Alta-Rückmeldung vorhanden.',
      }
    }
    if (reportedItems.length !== rawReportedItems.length) {
      return {
        created: false,
        error:
          'Ein oder mehrere gemeldete Service-Posten haben keine gültige Menge (Wert muss größer als 0 sein).',
      }
    }
  } else {
    const quantityResult = derivePrimaryBillingQuantity(
      order.work_type,
      report.answers as Record<string, unknown>,
    )
    if (quantityResult.error || quantityResult.quantity === null) {
      return { created: false, error: quantityResult.error }
    }
    reportedItems = [
      {
        service_item_id: order.service_item_id,
        qty: quantityResult.quantity,
        notes: null,
      },
    ]
  }

  const serviceItemIds = [...new Set(reportedItems.map((item) => item.service_item_id))]
  const { data: catalogRows, error: catalogError } = await supabase
    .from('service_items')
    .select('id, code, unit_price, unit_price_external')
    .in('id', serviceItemIds)
  if (catalogError) return { created: false, error: catalogError.message }

  const catalogById = new Map(
    (catalogRows ?? []).map((item) => [
      item.id,
      item as {
        id: string
        code: string
        unit_price: number | null
        unit_price_external: number | null
      },
    ]),
  )
  const drafts: BillingLineDraft[] = []
  for (const reportedItem of reportedItems) {
    const catalogItem = catalogById.get(reportedItem.service_item_id)
    if (!catalogItem) {
      return {
        created: false,
        error: `Gemeldeter Service-Posten ${reportedItem.service_item_id} wurde im Katalog nicht gefunden.`,
      }
    }
    if (catalogItem.unit_price == null) {
      return {
        created: false,
        error: `Service-Posten ${catalogItem.code} hat keinen internen Preis — interne Zertifizierung abgebrochen.`,
      }
    }
    drafts.push({
      service_item_id: reportedItem.service_item_id,
      qty: reportedItem.qty,
      unit_price_snapshot: Number(catalogItem.unit_price),
      unit_price_external_snapshot: catalogItem.unit_price_external,
      notes: reportedItem.notes ?? null,
    })
  }

  const { error: insertError } = await supabase.from('work_order_billing_lines').insert(
    drafts.map((draft) => ({
      work_order_id: workOrderId,
      service_item_id: draft.service_item_id,
      qty: draft.qty,
      unit_price_snapshot: draft.unit_price_snapshot,
      unit_price_external_snapshot: draft.unit_price_external_snapshot ?? null,
      notes: draft.notes ?? null,
    })) as never,
  )
  if (insertError) return { created: false, error: insertError.message }

  return { created: true, error: null }
}

export async function fetchBillingLines(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_billing_lines')
    .select(
      '*, service_items ( id, code, description_de, description_es, unit, unit_price, unit_price_external )',
    )
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return {
    data: (data ?? []) as unknown as Array<
      BillingLine & {
        service_items: {
          id: string
          code: string
          description_de: string
          description_es: string | null
          unit: string | null
          unit_price: number | null
          unit_price_external: number | null
        } | null
      }
    >,
    error: error?.message ?? null,
  }
}

/**
 * Replace the billing lines of a work order with the provided drafts.
 * Drafts without `id` are inserted; drafts with `id` are updated; rows in
 * DB whose id is not in drafts are deleted. `unit_price_snapshot` is
 * captured at insert time and never re-derived from service_items, so
 * historical billings survive catalog price edits.
 */
// TODO(db): replace this multi-step client-side delete/update/insert flow
// with an atomic Postgres RPC before billing is used in production accounting.
export async function upsertBillingLines(workOrderId: string, drafts: BillingLineDraft[]) {
  const { data: existing, error: fetchErr } = await supabase
    .from('work_order_billing_lines')
    .select('id')
    .eq('work_order_id', workOrderId)
  if (fetchErr) return { error: fetchErr.message }

  const existingIds = new Set((existing ?? []).map((r) => (r as { id: string }).id))
  const draftIds = new Set(drafts.filter((d) => d.id).map((d) => d.id as string))

  const toDelete = [...existingIds].filter((id) => !draftIds.has(id))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('work_order_billing_lines').delete().in('id', toDelete)
    if (error) return { error: error.message }
  }

  for (const draft of drafts) {
    if (draft.id) {
      const { error } = await supabase
        .from('work_order_billing_lines')
        .update({
          service_item_id: draft.service_item_id,
          qty: draft.qty,
          unit_price_snapshot: draft.unit_price_snapshot,
          unit_price_external_snapshot: draft.unit_price_external_snapshot ?? null,
          notes: draft.notes ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', draft.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('work_order_billing_lines').insert({
        work_order_id: workOrderId,
        service_item_id: draft.service_item_id,
        qty: draft.qty,
        unit_price_snapshot: draft.unit_price_snapshot,
        unit_price_external_snapshot: draft.unit_price_external_snapshot ?? null,
        notes: draft.notes ?? null,
      } as never)
      if (error) return { error: error.message }
    }
  }

  return { error: null }
}
