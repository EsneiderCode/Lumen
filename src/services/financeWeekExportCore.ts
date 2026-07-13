/**
 * Pure builders for FinControl ops-week CSV (no Supabase import).
 */

import { canonicalizeProjectCode } from '@/config/projectCodeAliases'
import type { CollaboratorCycle } from '@/services/collaboratorCyclesService'

export const FINCONTROL_OPS_CSV_HEADER =
  'kind,week,project_code,project_id,counterparty,amount,description,document_number,due_date,crew'

export type FinControlOpsKind = 'clear' | 'cxc'

export interface FinControlOpsRow {
  kind: FinControlOpsKind
  week: string
  project_code: string
  project_id: string
  counterparty: string
  amount: number
  description: string
  document_number: string
  due_date: string
  crew: string
  meta?: Record<string, string>
}

export function isoWeekLabel(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function isoWeekFromIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoWeekLabel()
  return isoWeekLabel(new Date(y, m - 1, d))
}

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildFinControlOpsCsv(rows: FinControlOpsRow[]): string {
  const lines = [
    FINCONTROL_OPS_CSV_HEADER,
    ...rows.map((r) =>
      [
        r.kind,
        r.week,
        r.project_code,
        r.project_id,
        r.counterparty,
        r.amount.toFixed(2),
        r.description,
        r.document_number,
        r.due_date,
        r.crew,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ]
  return lines.join('\n') + '\n'
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface CycleClearInput {
  cycle: CollaboratorCycle
  collaboratorName: string
  externalTotal: number
  projectCode?: string
}

export function buildClearRowsFromCycles(inputs: CycleClearInput[]): FinControlOpsRow[] {
  return inputs
    .filter((i) => i.cycle.status === 'published' && i.externalTotal > 0)
    .map((i) => {
      const week =
        i.cycle.period_label && /^\d{4}-W\d{2}$/i.test(i.cycle.period_label.trim())
          ? i.cycle.period_label.trim().toUpperCase()
          : isoWeekFromIsoDate(i.cycle.period_start)
      return {
        kind: 'clear' as const,
        week,
        project_code: canonicalizeProjectCode(i.projectCode ?? ''),
        project_id: '',
        counterparty: i.collaboratorName,
        amount: Math.round(i.externalTotal * 100) / 100,
        description: `Ciclo ${i.cycle.period_start}→${i.cycle.period_end} (publicado)`,
        document_number: i.cycle.id.slice(0, 8),
        due_date: i.cycle.payment_date ?? '',
        crew: i.collaboratorName,
        meta: { cycle_id: i.cycle.id },
      }
    })
}

export interface ClientAcceptedCxcInput {
  orderNumber: string
  workOrderId: string
  clientName: string
  projectCode: string
  clientTotal: number
  week: string
  dueDate?: string
}

export function buildCxcRowsFromAccepted(inputs: ClientAcceptedCxcInput[]): FinControlOpsRow[] {
  return inputs
    .filter((i) => i.clientTotal > 0)
    .map((i) => ({
      kind: 'cxc' as const,
      week: i.week,
      project_code: canonicalizeProjectCode(i.projectCode),
      project_id: '',
      counterparty: i.clientName,
      amount: Math.round(i.clientTotal * 100) / 100,
      description: `client_accepted ${i.orderNumber}`,
      document_number: i.orderNumber,
      due_date: i.dueDate ?? '',
      crew: '',
      meta: { work_order_id: i.workOrderId },
    }))
}
