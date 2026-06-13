import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import { defaultPaymentDate } from '@/lib/businessDays'

export type CycleStatus = 'draft' | 'published'

export interface CollaboratorCycle {
  id: string
  collaborator_id: string
  period_start: string
  period_end: string
  period_label: string | null
  emission_date: string | null
  review_start_date: string | null
  final_cert_date: string | null
  payment_date: string | null
  status: CycleStatus
  published_at: string | null
  published_by: string | null
  created_at: string
  updated_at: string
}

export interface CollaboratorCycleOrder {
  cycle_id: string
  work_order_id: string
}

/** Milestone date fields an admin can set on a cycle. */
export interface CycleMilestoneInput {
  emission_date?: string | null
  review_start_date?: string | null
  final_cert_date?: string | null
  payment_date?: string | null
}

export interface CreateCycleInput extends CycleMilestoneInput {
  collaborator_id: string
  period_start: string
  period_end: string
  period_label?: string | null
}

export type UpdateCycleInput = CycleMilestoneInput & {
  period_start?: string
  period_end?: string
  period_label?: string | null
}

type CycleRow = Database['public']['Tables']['collaborator_cycles']['Row']
type CycleInsert = Database['public']['Tables']['collaborator_cycles']['Insert']
type CycleUpdate = Database['public']['Tables']['collaborator_cycles']['Update']

const CYCLES = 'collaborator_cycles'
const BRIDGE = 'collaborator_cycle_orders'

/**
 * D4 rule — apply the payment date derived from the final certification date.
 *
 * Returns the payment_date that should be persisted. When `finalCertDate` is
 * being set/changed, the payment date is ALWAYS re-fixed to cert + 20 calendar
 * days (any prior manual adjustment is discarded). When the cert date is being
 * cleared, the payment date is cleared too. When the cert date is NOT part of
 * the patch (`undefined`), the caller's explicit payment_date (if any) is kept.
 */
export function resolvePaymentDate(
  finalCertDate: string | null | undefined,
  explicitPayment: string | null | undefined,
): string | null | undefined {
  if (finalCertDate === undefined) {
    // Cert not touched in this patch — keep whatever payment value was provided.
    return explicitPayment
  }
  if (finalCertDate === null) return null
  return defaultPaymentDate(finalCertDate)
}

function isPublishGateOpen(cycle: Pick<CollaboratorCycle, 'status'>): boolean {
  return cycle.status === 'published'
}

/**
 * Visibility gate (mirrors RLS): a contractor may only see their own published
 * cycles. Used by the demo client (no RLS) and as a defensive client filter.
 */
export function filterVisibleToContractor(
  rows: CollaboratorCycle[],
  contractorId: string,
): CollaboratorCycle[] {
  return rows.filter((c) => c.collaborator_id === contractorId && isPublishGateOpen(c))
}

// ── Admin reads ───────────────────────────────────────────────────────────────

/** List all cycles for a collaborator (admin view), newest period first. */
export async function listCyclesForCollaborator(
  collaboratorId: string,
): Promise<{ data: CollaboratorCycle[]; error: string | null }> {
  const { data, error } = await supabase
    .from(CYCLES)
    .select('*')
    .eq('collaborator_id', collaboratorId)
    .order('period_start', { ascending: false })

  return { data: (data as CollaboratorCycle[] | null) ?? [], error: error?.message ?? null }
}

/** Work order ids attached to a cycle. */
export async function listCycleOrders(
  cycleId: string,
): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from(BRIDGE)
    .select('work_order_id')
    .eq('cycle_id', cycleId)

  const ids = ((data as CollaboratorCycleOrder[] | null) ?? []).map((r) => r.work_order_id)
  return { data: ids, error: error?.message ?? null }
}

// ── Contractor read (publish-gated) ────────────────────────────────────────────

/**
 * Published cycles visible to a contractor. The `.eq('status', 'published')`
 * filter mirrors the RLS policy so the demo client behaves like production.
 */
export async function listPublishedCyclesForContractor(
  contractorId: string,
): Promise<{ data: CollaboratorCycle[]; error: string | null }> {
  const { data, error } = await supabase
    .from(CYCLES)
    .select('*')
    .eq('collaborator_id', contractorId)
    .eq('status', 'published')
    .order('period_start', { ascending: false })

  return { data: (data as CollaboratorCycle[] | null) ?? [], error: error?.message ?? null }
}

// ── Admin writes ────────────────────────────────────────────────────────────────

export async function createCycle(
  input: CreateCycleInput,
): Promise<{ data: CollaboratorCycle | null; error: string | null }> {
  if (!input.collaborator_id) return { data: null, error: 'collaborator_id is required' }
  if (!input.period_start || !input.period_end) {
    return { data: null, error: 'period_start and period_end are required' }
  }
  if (input.period_end < input.period_start) {
    return { data: null, error: 'period_end must be on or after period_start' }
  }

  const payment = resolvePaymentDate(input.final_cert_date, input.payment_date)

  const payload: CycleInsert = {
    collaborator_id: input.collaborator_id,
    period_start: input.period_start,
    period_end: input.period_end,
    period_label: input.period_label?.trim() || null,
    emission_date: input.emission_date ?? null,
    review_start_date: input.review_start_date ?? null,
    final_cert_date: input.final_cert_date ?? null,
    payment_date: payment ?? null,
    status: 'draft',
  }

  const { data, error } = await supabase
    .from(CYCLES)
    .insert(payload as never)
    .select('*')
    .single()

  return { data: (data as CollaboratorCycle | null) ?? null, error: error?.message ?? null }
}

/**
 * Update a cycle's period and/or milestone dates. Enforces D4: when
 * `final_cert_date` is included in the patch, `payment_date` is recalculated to
 * cert + 20 (discarding any explicit payment_date in the same patch). To edit
 * the payment date manually, send `payment_date` WITHOUT `final_cert_date`.
 */
export async function updateCycle(
  cycleId: string,
  patch: UpdateCycleInput,
): Promise<{ data: CollaboratorCycle | null; error: string | null }> {
  const update: CycleUpdate = {}

  if (patch.period_start !== undefined) update.period_start = patch.period_start
  if (patch.period_end !== undefined) update.period_end = patch.period_end
  if (patch.period_label !== undefined) update.period_label = patch.period_label?.trim() || null
  if (patch.emission_date !== undefined) update.emission_date = patch.emission_date
  if (patch.review_start_date !== undefined) update.review_start_date = patch.review_start_date
  if (patch.final_cert_date !== undefined) update.final_cert_date = patch.final_cert_date

  const payment = resolvePaymentDate(patch.final_cert_date, patch.payment_date)
  if (payment !== undefined) update.payment_date = payment

  if (
    update.period_start !== undefined &&
    update.period_end !== undefined &&
    update.period_end < update.period_start
  ) {
    return { data: null, error: 'period_end must be on or after period_start' }
  }

  const { data, error } = await supabase
    .from(CYCLES)
    .update(update as never)
    .eq('id', cycleId)
    .select('*')
    .single()

  return { data: (data as CollaboratorCycle | null) ?? null, error: error?.message ?? null }
}

export async function deleteCycle(cycleId: string): Promise<{ error: string | null }> {
  // Bridge rows cascade via the FK ON DELETE CASCADE.
  const { error } = await supabase.from(CYCLES).delete().eq('id', cycleId)
  return { error: error?.message ?? null }
}

// ── Order attach / detach (D2) ──────────────────────────────────────────────────

export async function attachOrder(
  cycleId: string,
  workOrderId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(BRIDGE)
    .insert({ cycle_id: cycleId, work_order_id: workOrderId } as never)
  return { error: error?.message ?? null }
}

export async function detachOrder(
  cycleId: string,
  workOrderId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(BRIDGE)
    .delete()
    .eq('cycle_id', cycleId)
    .eq('work_order_id', workOrderId)
  return { error: error?.message ?? null }
}

// ── Publish / unpublish (D5) ─────────────────────────────────────────────────────

export async function publishCycle(
  cycleId: string,
  publishedBy: string,
): Promise<{ data: CollaboratorCycle | null; error: string | null }> {
  const update: CycleUpdate = {
    status: 'published',
    published_at: new Date().toISOString(),
    published_by: publishedBy,
  }
  const { data, error } = await supabase
    .from(CYCLES)
    .update(update as never)
    .eq('id', cycleId)
    .select('*')
    .single()

  return { data: (data as CollaboratorCycle | null) ?? null, error: error?.message ?? null }
}

export async function unpublishCycle(
  cycleId: string,
): Promise<{ data: CollaboratorCycle | null; error: string | null }> {
  const update: CycleUpdate = {
    status: 'draft',
    published_at: null,
    published_by: null,
  }
  const { data, error } = await supabase
    .from(CYCLES)
    .update(update as never)
    .eq('id', cycleId)
    .select('*')
    .single()

  return { data: (data as CollaboratorCycle | null) ?? null, error: error?.message ?? null }
}

export type { CycleRow }
