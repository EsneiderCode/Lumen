import { describe, expect, it } from 'vitest'
import {
  buildClearRowsFromCycles,
  buildCxcRowsFromAccepted,
  buildFinControlOpsCsv,
  FINCONTROL_OPS_CSV_HEADER,
  isoWeekFromIsoDate,
} from '@/services/financeWeekExportCore'
import { canonicalizeProjectCode, projectCodesMatch } from '@/config/projectCodeAliases'
import type { CollaboratorCycle } from '@/services/collaboratorCyclesService'

const baseCycle = (over: Partial<CollaboratorCycle> = {}): CollaboratorCycle => ({
  id: 'cycle-1',
  collaborator_id: 'c1',
  period_start: '2026-07-07',
  period_end: '2026-07-13',
  period_label: '2026-W28',
  emission_date: null,
  review_start_date: null,
  final_cert_date: '2026-07-13',
  payment_date: '2026-08-02',
  status: 'published',
  published_at: '2026-07-13T12:00:00Z',
  published_by: 'admin',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-13T12:00:00Z',
  ...over,
})

describe('projectCodeAliases', () => {
  it('maps FinControl PROY codes to Lumen codes', () => {
    expect(canonicalizeProjectCode('PROY-004')).toBe('NE4')
    expect(canonicalizeProjectCode('PROY-004 (NE4)')).toBe('NE4')
    expect(canonicalizeProjectCode('qff')).toBe('QFF')
    expect(projectCodesMatch('PROY-001 (QFF)', 'QFF')).toBe(true)
  })
})

describe('buildClearRowsFromCycles', () => {
  it('emits clear rows only for published cycles with external total', () => {
    const rows = buildClearRowsFromCycles([
      {
        cycle: baseCycle(),
        collaboratorName: 'Melgarejo',
        externalTotal: 5000,
        projectCode: 'QFF',
      },
      {
        cycle: baseCycle({ status: 'draft', id: 'c2' }),
        collaboratorName: 'Other',
        externalTotal: 1000,
      },
      {
        cycle: baseCycle({ id: 'c3' }),
        collaboratorName: 'Zero',
        externalTotal: 0,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('clear')
    expect(rows[0].counterparty).toBe('Melgarejo')
    expect(rows[0].amount).toBe(5000)
    expect(rows[0].week).toBe('2026-W28')
    expect(rows[0].project_code).toBe('QFF')
  })
})

describe('buildCxcRowsFromAccepted', () => {
  it('emits cxc rows for client_accepted totals', () => {
    const rows = buildCxcRowsFromAccepted([
      {
        orderNumber: 'WO-1',
        workOrderId: 'id-1',
        clientName: 'Insyte',
        projectCode: 'PROY-004',
        clientTotal: 15000,
        week: '2026-W28',
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('cxc')
    expect(rows[0].project_code).toBe('NE4')
    expect(rows[0].document_number).toBe('WO-1')
  })
})

describe('buildFinControlOpsCsv', () => {
  it('matches FinControl header', () => {
    const csv = buildFinControlOpsCsv([
      {
        kind: 'clear',
        week: '2026-W28',
        project_code: 'QFF',
        project_id: '',
        counterparty: 'Melgarejo',
        amount: 100,
        description: 'test',
        document_number: '',
        due_date: '',
        crew: 'Melgarejo',
      },
    ])
    expect(csv.startsWith(FINCONTROL_OPS_CSV_HEADER)).toBe(true)
    expect(csv).toContain('clear,2026-W28,QFF,,Melgarejo,100.00')
  })
})

describe('isoWeekFromIsoDate', () => {
  it('returns a YYYY-Www label', () => {
    expect(isoWeekFromIsoDate('2026-07-13')).toMatch(/^\d{4}-W\d{2}$/)
  })
})
