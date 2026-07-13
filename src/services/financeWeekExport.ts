/**
 * Finance week export for FinControl F1 `/ops-semana` (async data load).
 * Pure builders live in `financeWeekExportCore.ts` (testable without Supabase).
 */

import { supabase } from '@/lib/supabase'
import { canonicalizeProjectCode } from '@/config/projectCodeAliases'
import { listCycleOrders } from '@/services/collaboratorCyclesService'
import type { CollaboratorCycle } from '@/services/collaboratorCyclesService'
import {
  buildClearRowsFromCycles,
  buildCxcRowsFromAccepted,
  buildFinControlOpsCsv,
  isoWeekLabel,
  type ClientAcceptedCxcInput,
  type CycleClearInput,
  type FinControlOpsRow,
} from '@/services/financeWeekExportCore'

export {
  buildClearRowsFromCycles,
  buildCxcRowsFromAccepted,
  buildFinControlOpsCsv,
  downloadCsv,
  FINCONTROL_OPS_CSV_HEADER,
  isoWeekFromIsoDate,
  isoWeekLabel,
  type FinControlOpsRow,
} from '@/services/financeWeekExportCore'

async function sumBillingForOrders(
  orderIds: string[],
  side: 'client' | 'external',
): Promise<{ total: number; projectCodes: string[] }> {
  if (orderIds.length === 0) return { total: 0, projectCodes: [] }

  const { data: lines, error } = await supabase
    .from('work_order_billing_lines')
    .select('work_order_id, qty, unit_price_snapshot, unit_price_external_snapshot')
    .in('work_order_id', orderIds)

  if (error) throw new Error(error.message)

  let total = 0
  for (const row of lines ?? []) {
    const qty = Number(row.qty) || 0
    if (side === 'client') {
      total += qty * (Number(row.unit_price_snapshot) || 0)
    } else {
      const ext = row.unit_price_external_snapshot
      if (ext == null) continue
      total += qty * (Number(ext) || 0)
    }
  }

  const { data: orders } = await supabase
    .from('work_orders')
    .select('id, projects ( code )')
    .in('id', orderIds)

  const projectCodes: string[] = []
  for (const o of orders ?? []) {
    const rel = o.projects as { code?: string } | { code?: string }[] | null
    const code = Array.isArray(rel) ? rel[0]?.code : rel?.code
    if (code) projectCodes.push(String(code))
  }

  return { total, projectCodes }
}

function dominantCode(codes: string[]): string {
  if (!codes.length) return ''
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

export interface FinanceWeekExportResult {
  csv: string
  rows: FinControlOpsRow[]
  clearCount: number
  cxcCount: number
  week: string
  errors: string[]
}

/**
 * - clear ← all **published** collaborator cycles (optional filter by collaborator)
 * - cxc  ← all work orders in **client_accepted**
 */
export async function buildFinanceWeekExport(options?: {
  collaboratorId?: string
  weekFallback?: string
}): Promise<FinanceWeekExportResult> {
  const errors: string[] = []
  const weekFallback = options?.weekFallback || isoWeekLabel()

  let cyclesQuery = supabase.from('collaborator_cycles').select('*').eq('status', 'published')
  if (options?.collaboratorId) {
    cyclesQuery = cyclesQuery.eq('collaborator_id', options.collaboratorId)
  }
  const { data: cycles, error: cyclesErr } = await cyclesQuery
  if (cyclesErr) errors.push(`cycles: ${cyclesErr.message}`)

  const collabIds = [
    ...new Set(
      (cycles ?? [])
        .map((c) => c.collaborator_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const nameById = new Map<string, string>()
  if (collabIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', collabIds)
    for (const p of profiles ?? []) {
      nameById.set(p.id, p.full_name || p.id)
    }
  }

  const clearInputs: CycleClearInput[] = []
  for (const cycle of (cycles ?? []) as CollaboratorCycle[]) {
    const { data: orderIds, error: ordErr } = await listCycleOrders(cycle.id)
    if (ordErr) {
      errors.push(`cycle ${cycle.id}: ${ordErr}`)
      continue
    }
    try {
      const { total, projectCodes } = await sumBillingForOrders(orderIds, 'external')
      clearInputs.push({
        cycle,
        collaboratorName: nameById.get(cycle.collaborator_id) || cycle.collaborator_id,
        externalTotal: total,
        projectCode: dominantCode(projectCodes),
      })
    } catch (e) {
      errors.push(`billing cycle ${cycle.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const clearRows = buildClearRowsFromCycles(clearInputs)

  const { data: accepted, error: woErr } = await supabase
    .from('work_orders')
    .select('id, order_number, clients ( name, code ), projects ( code )')
    .eq('status', 'client_accepted')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (woErr) errors.push(`client_accepted: ${woErr.message}`)

  const cxcInputs: ClientAcceptedCxcInput[] = []
  for (const wo of accepted ?? []) {
    try {
      const { total } = await sumBillingForOrders([wo.id], 'client')
      const clientRel = wo.clients as { name?: string; code?: string } | null
      const projRel = wo.projects as { code?: string } | null
      cxcInputs.push({
        orderNumber: wo.order_number,
        workOrderId: wo.id,
        clientName: clientRel?.name || clientRel?.code || 'Cliente',
        projectCode: projRel?.code || '',
        clientTotal: total,
        week: weekFallback,
      })
    } catch (e) {
      errors.push(`billing ${wo.order_number}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const cxcRows = buildCxcRowsFromAccepted(cxcInputs)
  const rows = [...clearRows, ...cxcRows]
  const csv = buildFinControlOpsCsv(rows)

  return {
    csv,
    rows,
    clearCount: clearRows.length,
    cxcCount: cxcRows.length,
    week: weekFallback,
    errors,
  }
}
