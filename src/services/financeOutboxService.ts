/**
 * Finance outbox — enqueue domain events for FinControl (S5).
 * Idempotent: unique idempotency_key; re-enqueue is a silent no-op.
 */

import { supabase } from '@/lib/supabase'
import { canonicalizeProjectCode } from '@/config/projectCodeAliases'
import { listCycleOrders, type CollaboratorCycle } from '@/services/collaboratorCyclesService'
import { isoWeekFromIsoDate, isoWeekLabel } from '@/services/financeWeekExportCore'

export type FinanceEventType = 'finance.cxc_draft.v1' | 'finance.cxp_from_cycle.v1'

export interface FinanceOutboxRow {
  id: string
  event_type: FinanceEventType
  idempotency_key: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
}

function cxcKey(workOrderId: string): string {
  return `lumen:cxc:wo-${workOrderId}`
}

function cxpKey(cycleId: string): string {
  return `lumen:cxp:cycle-${cycleId}`
}

/**
 * Insert outbox row. On unique violation (already enqueued), returns ok with duplicate=true.
 */
export async function enqueueFinanceEvent(input: {
  eventType: FinanceEventType
  idempotencyKey: string
  payload: Record<string, unknown>
  createdBy?: string | null
}): Promise<{ ok: boolean; duplicate?: boolean; id?: string; error?: string }> {
  const { data: userData } = await supabase.auth.getUser()
  const createdBy = input.createdBy ?? userData.user?.id ?? null

  const { data, error } = await supabase
    .from('finance_outbox' as never)
    .insert({
      event_type: input.eventType,
      idempotency_key: input.idempotencyKey,
      payload: input.payload,
      status: 'pending',
      created_by: createdBy,
    } as never)
    .select('id')
    .single()

  if (error) {
    // 23505 unique_violation — already enqueued
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      return { ok: true, duplicate: true }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, id: (data as { id?: string } | null)?.id, duplicate: false }
}

async function sumBilling(
  orderIds: string[],
  side: 'client' | 'external',
): Promise<{ total: number; projectCodes: string[] }> {
  if (!orderIds.length) return { total: 0, projectCodes: [] }

  const { data: lines, error } = await supabase
    .from('work_order_billing_lines')
    .select('qty, unit_price_snapshot, unit_price_external_snapshot')
    .in('work_order_id', orderIds)
  if (error) throw new Error(error.message)

  let total = 0
  for (const row of lines ?? []) {
    const qty = Number(row.qty) || 0
    if (side === 'client') total += qty * (Number(row.unit_price_snapshot) || 0)
    else if (row.unit_price_external_snapshot != null) {
      total += qty * (Number(row.unit_price_external_snapshot) || 0)
    }
  }

  const { data: orders } = await supabase
    .from('work_orders')
    .select('id, projects ( code )')
    .in('id', orderIds)

  const projectCodes: string[] = []
  for (const o of orders ?? []) {
    const rel = o.projects as { code?: string } | null
    if (rel?.code) projectCodes.push(String(rel.code))
  }
  return { total, projectCodes }
}

function dominantCode(codes: string[]): string {
  const counts = new Map<string, number>()
  for (const c of codes) {
    const k = canonicalizeProjectCode(c)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best = ''
  let n = 0
  for (const [k, v] of counts) {
    if (v > n) {
      best = k
      n = v
    }
  }
  return best
}

/** After cycle publish — pay sub (CXP + opsCleared). */
export async function enqueueCxpFromPublishedCycle(
  cycle: CollaboratorCycle,
  collaboratorName: string,
): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  try {
    const { data: orderIds, error: ordErr } = await listCycleOrders(cycle.id)
    if (ordErr) return { ok: false, error: ordErr }

    const { total, projectCodes } = await sumBilling(orderIds, 'external')
    if (total <= 0) {
      return { ok: true, duplicate: false } // nothing billable — skip enqueue
    }

    const week =
      cycle.period_label && /^\d{4}-W\d{2}$/i.test(cycle.period_label.trim())
        ? cycle.period_label.trim().toUpperCase()
        : isoWeekFromIsoDate(cycle.period_start)

    const projectCode = dominantCode(projectCodes)
    const sourceKey = cxpKey(cycle.id)

    return enqueueFinanceEvent({
      eventType: 'finance.cxp_from_cycle.v1',
      idempotencyKey: sourceKey,
      payload: {
        event_type: 'finance.cxp_from_cycle.v1',
        source_key: sourceKey,
        cycle_id: cycle.id,
        week,
        period_start: cycle.period_start,
        period_end: cycle.period_end,
        project_code: projectCode,
        vendor_name: collaboratorName,
        currency: 'EUR',
        gross_amount: Math.round(total * 100) / 100,
        ops_cleared: true,
        ops_gate_required: true,
        production_week_ref: week,
        work_order_ids: orderIds,
        payment_date: cycle.payment_date,
        description: `Ciclo publicado ${cycle.period_start}→${cycle.period_end}`,
        document_number: cycle.id,
      },
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** After client_accepted — draft CXC. */
export async function enqueueCxcFromClientAccepted(
  workOrderId: string,
): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  try {
    const { data: wo, error: woErr } = await supabase
      .from('work_orders')
      .select('id, order_number, status, clients ( name, code ), projects ( code )')
      .eq('id', workOrderId)
      .single()
    if (woErr) return { ok: false, error: woErr.message }
    if (!wo) return { ok: false, error: 'work order not found' }
    if (wo.status !== 'client_accepted') {
      return { ok: false, error: `status is ${wo.status}, expected client_accepted` }
    }

    const { total } = await sumBilling([workOrderId], 'client')
    if (total <= 0) return { ok: true, duplicate: false }

    const clientRel = wo.clients as { name?: string; code?: string } | null
    const projRel = wo.projects as { code?: string } | null
    const sourceKey = cxcKey(workOrderId)
    const week = isoWeekLabel()

    return enqueueFinanceEvent({
      eventType: 'finance.cxc_draft.v1',
      idempotencyKey: sourceKey,
      payload: {
        event_type: 'finance.cxc_draft.v1',
        source_key: sourceKey,
        work_order_id: workOrderId,
        order_number: wo.order_number,
        week,
        project_code: canonicalizeProjectCode(projRel?.code ?? ''),
        client_name: clientRel?.name || clientRel?.code || 'Cliente',
        client_code: clientRel?.code ?? null,
        currency: 'EUR',
        gross_amount: Math.round(total * 100) / 100,
        description: `client_accepted ${wo.order_number}`,
        document_number: wo.order_number,
        due_date: null,
      },
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** List recent outbox rows (admin UI). */
export async function listFinanceOutbox(limit = 50): Promise<{
  data: FinanceOutboxRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('finance_outbox' as never)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  return {
    data: (data as FinanceOutboxRow[] | null) ?? [],
    error: error?.message ?? null,
  }
}

/**
 * Invoke Edge Function to push pending events to FinControl / Firestore.
 * Requires secrets on the function (see dispatch-finance-outbox).
 */
export async function dispatchFinanceOutbox(options?: {
  limit?: number
}): Promise<{ ok: boolean; processed?: number; sent?: number; failed?: number; error?: string; detail?: unknown }> {
  const { data, error } = await supabase.functions.invoke('dispatch-finance-outbox', {
    method: 'POST',
    body: { limit: options?.limit ?? 25 },
  })
  if (error) return { ok: false, error: error.message }
  const body = data as {
    processed?: number
    sent?: number
    failed?: number
    error?: string
  } | null
  if (body?.error) return { ok: false, error: body.error, detail: body }
  return {
    ok: true,
    processed: body?.processed,
    sent: body?.sent,
    failed: body?.failed,
    detail: body,
  }
}
