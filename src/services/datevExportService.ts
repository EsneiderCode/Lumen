/**
 * DATEV-Export — generates a Buchungsstapel CSV that Beatriz / Janet can
 * import in DATEV. Format defaults to EXTF v9-style headered CSV (the
 * common modern format) until Beatriz confirms a different layout.
 *
 * Columns (minimum viable — extend once the real DATEV mapping is locked):
 *   Umsatz · Soll/Haben · WKZ · Kurs · Konto · Gegenkonto · BU
 *   · Belegdatum · Belegfeld 1 · Buchungstext · Steuersatz
 *
 * Defaults applied here (PLACEHOLDERS — replace once we have real mapping):
 *   Konto       = 10000  (sammeldebitor placeholder)
 *   Gegenkonto  = 8400   (Erlöse 19% USt placeholder)
 *   Steuersatz  = 19
 *   WKZ         = EUR
 *
 * Each input order produces ONE row at its client-side total
 * (sum(qty * unit_price_snapshot)). A future Phase will extend this to
 * also book the external-collaborator side via a Gegenkonto for Subkontrato.
 */

import type { WorkOrderWithRelations } from './workOrderService'

export interface DatevExportInput {
  order: WorkOrderWithRelations
  totalClient: number
  invoiceDate?: string  // ISO date YYYY-MM-DD; defaults to today
  invoiceNumber?: string | null
}

export interface DatevExportOptions {
  /** DATEV customer account (Sammeldebitor or per-client). Default: 10000. */
  defaultKonto?: string
  /** Revenue account (Erlöse 19% USt by default → 8400). */
  defaultGegenkonto?: string
  /** Tax rate (Steuersatz). Default: 19. */
  steuersatz?: number
  /** Currency. Default: EUR. */
  wkz?: string
}

const HEADER = [
  'Umsatz',
  'Soll/Haben',
  'WKZ',
  'Kurs',
  'Konto',
  'Gegenkonto',
  'BU',
  'Belegdatum',
  'Belegfeld 1',
  'Buchungstext',
  'Steuersatz',
] as const

/** Format a number for DATEV: comma decimal separator, no thousands separator. */
function fmtAmount(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** Format a date for DATEV: TTMM (4 digits, no year — DATEV convention for Belegdatum). */
function fmtDatevDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}${mm}`
}

/** Quote a CSV cell that contains the separator, a quote, or a newline. */
function csvCell(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildDatevCsv(
  inputs: DatevExportInput[],
  options: DatevExportOptions = {},
): string {
  const {
    defaultKonto = '10000',
    defaultGegenkonto = '8400',
    steuersatz = 19,
    wkz = 'EUR',
  } = options

  const today = new Date().toISOString().slice(0, 10)

  const rows: string[][] = inputs.map(({ order, totalClient, invoiceDate, invoiceNumber }) => {
    const buchungstext = `Auftrag ${order.order_number} — ${order.projects?.code ?? ''} ${order.operators?.code ?? ''}`.trim()
    const belegfeld = invoiceNumber?.trim() || order.order_number
    const dateIso = invoiceDate ?? today
    return [
      fmtAmount(totalClient),                    // Umsatz
      'S',                                       // Soll/Haben — debit on customer account
      wkz,                                       // WKZ
      '',                                        // Kurs (empty for EUR)
      defaultKonto,                              // Konto
      defaultGegenkonto,                         // Gegenkonto
      '',                                        // BU (empty unless special tax key)
      fmtDatevDate(dateIso),                     // Belegdatum (TTMM)
      belegfeld,                                 // Belegfeld 1
      buchungstext,                              // Buchungstext
      String(steuersatz),                        // Steuersatz
    ]
  })

  const lines = [
    HEADER.map(csvCell).join(';'),
    ...rows.map((r) => r.map(csvCell).join(';')),
  ]
  return lines.join('\r\n') + '\r\n'
}

/**
 * Trigger a browser download of the DATEV CSV. UTF-8 with BOM so Excel
 * and DATEV both pick up the encoding correctly.
 */
export function downloadDatevCsv(csv: string, filename = 'lumen-datev-export.csv'): void {
  const BOM = '﻿'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
