import { describe, it, expect } from 'vitest'
import { buildDatevCsv } from '@/services/datevExportService'
import type { WorkOrderWithRelations } from '@/services/workOrderService'

function makeOrder(overrides: Partial<WorkOrderWithRelations> = {}): WorkOrderWithRelations {
  return {
    id: 'wo-1',
    order_number: 'LUM-20260501-0042',
    client_id: 'c1',
    project_id: 'p1',
    operator_id: 'op1',
    line: 'NE3',
    work_type: 'alta',
    status: 'invoiced',
    priority: 'normal',
    assigned_team: 'rot',
    assigned_technician: 'tech-1',
    assigned_date: '2026-05-01',
    address: null,
    postal_code: null,
    city: null,
    internal_notes: null,
    assigned_detail_snapshot: null,
    service_item_id: 'si-1',
    created_by: 'admin',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    clients: { name: 'Insyte', code: 'INSYTE' },
    projects: { name: 'Höxter', code: 'HXT' },
    operators: { name: 'DGF', code: 'DGF' },
    ...overrides,
  } as WorkOrderWithRelations
}

describe('buildDatevCsv', () => {
  it('emits a CRLF-terminated CSV with the expected header columns', () => {
    const csv = buildDatevCsv([])
    expect(csv).toMatch(/^Umsatz;Soll\/Haben;WKZ;Kurs;Konto;Gegenkonto;BU;Belegdatum;Belegfeld 1;Buchungstext;Steuersatz\r\n/)
  })

  it('uses German decimal comma for amounts', () => {
    const csv = buildDatevCsv([
      { order: makeOrder(), totalClient: 1234.5, invoiceDate: '2026-05-01' },
    ])
    expect(csv).toContain('1234,50;')
  })

  it('formats Belegdatum as TTMM (no year)', () => {
    const csv = buildDatevCsv([
      { order: makeOrder(), totalClient: 100, invoiceDate: '2026-04-28' },
    ])
    expect(csv).toContain(';2804;')
  })

  it('uses order_number as Belegfeld 1 when no invoice number is provided', () => {
    const csv = buildDatevCsv([
      { order: makeOrder(), totalClient: 100, invoiceDate: '2026-05-01', invoiceNumber: null },
    ])
    expect(csv).toContain(';LUM-20260501-0042;')
  })

  it('uses the supplied invoiceNumber when present', () => {
    const csv = buildDatevCsv([
      { order: makeOrder(), totalClient: 100, invoiceDate: '2026-05-01', invoiceNumber: 'RE-2026-0042' },
    ])
    expect(csv).toContain(';RE-2026-0042;')
  })

  it('writes the project + operator codes into the Buchungstext', () => {
    const csv = buildDatevCsv([
      { order: makeOrder(), totalClient: 100, invoiceDate: '2026-05-01' },
    ])
    expect(csv).toContain('Auftrag LUM-20260501-0042 — HXT DGF')
  })

  it('respects custom Konto/Gegenkonto/Steuersatz options', () => {
    const csv = buildDatevCsv(
      [{ order: makeOrder(), totalClient: 100, invoiceDate: '2026-05-01' }],
      { defaultKonto: '11000', defaultGegenkonto: '8410', steuersatz: 7 },
    )
    expect(csv).toContain(';11000;8410;')
    expect(csv.trimEnd().endsWith(';7')).toBe(true)
  })

  it('quotes cells that contain semicolons', () => {
    const csv = buildDatevCsv([
      {
        order: makeOrder({ projects: { name: 'P', code: 'A;B' } }),
        totalClient: 100,
        invoiceDate: '2026-05-01',
      },
    ])
    expect(csv).toMatch(/"Auftrag LUM-20260501-0042 — A;B DGF"/)
  })
})
