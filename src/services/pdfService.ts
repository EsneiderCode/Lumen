import jsPDF from 'jspdf'
import { labels } from '@/i18n/labels'
import type { WorkOrderStatus, WorkType } from '@/types/enums'

interface OrderData {
  order_number: string
  work_type: string
  status: string
  priority: string
  line: string
  address: string | null
  postal_code: string | null
  city: string | null
  assigned_date: string | null
  assigned_team: string | null
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
  operators: { name: string; code: string } | null
}

interface StateEntry {
  from_status: string | null
  to_status: string
  notes: string | null
  created_at: string
}

interface PhotoItem {
  storage_path: string
  photo_type: string
}


export function generateCertificatePdf(
  order: OrderData,
  detail: Record<string, unknown>,
  photos: PhotoItem[],
  history: StateEntry[],
  getPhotoUrl: (path: string) => string,
): void {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function checkPage(needed = 8) {
    if (y + needed > 275) {
      doc.addPage()
      y = 20
    }
  }

  function addSection(title: string) {
    checkPage(14)
    doc.setFillColor(230, 245, 255)
    doc.rect(14, y - 4, pageW - 28, 9, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 100, 160)
    doc.text(title.toUpperCase(), 16, y + 2)
    doc.setTextColor(0, 0, 0)
    y += 12
  }

  function addRow(label: string, value: string) {
    const strValue = value || '—'
    const textX = 70
    const lines = doc.splitTextToSize(strValue, pageW - textX - 14)
    checkPage(lines.length * 5 + 2)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    doc.text(label + ':', 16, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(lines, textX, y)
    y += Math.max(lines.length * 5, 6)
  }

  // ── Header ────────────────────────────────────────────────────
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 160)
  doc.text('LUMEN', 14, y)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('HMR Nexus Engineering GmbH', 14, y + 7)
  doc.text(`Zertifikat generiert: ${new Date().toLocaleString('de-DE')}`, 14, y + 13)

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(order.order_number, pageW - 14, y, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(labels.status(order.status as WorkOrderStatus) || order.status, pageW - 14, y + 7, { align: 'right' })

  y += 20
  doc.setDrawColor(180, 200, 220)
  doc.line(14, y, pageW - 14, y)
  y += 10

  // ── Auftragsdaten ─────────────────────────────────────────────
  addSection('Auftragsdaten')
  addRow('Auftragstyp', labels.workType(order.work_type as WorkType) || order.work_type)
  addRow('Linie', order.line)
  addRow('Priorität', order.priority)
  addRow('Kunde', `${order.clients?.name ?? '—'} (${order.clients?.code ?? '—'})`)
  addRow('Projekt', `${order.projects?.code ?? '—'} – ${order.projects?.name ?? '—'}`)
  addRow('Betreiber', order.operators?.name ?? '—')
  addRow('Team', order.assigned_team ?? '—')
  if (order.assigned_date) {
    addRow('Einsatzdatum', new Date(order.assigned_date).toLocaleDateString('de-DE'))
  }
  if (order.address || order.city) {
    addRow('Adresse', [order.address, order.postal_code, order.city].filter(Boolean).join(', '))
  }
  y += 4

  // ── Technische Daten ──────────────────────────────────────────
  const detailEntries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )
  if (detailEntries.length > 0) {
    addSection(`Technische Daten — ${labels.workType(order.work_type as WorkType) || order.work_type}`)
    for (const [key, value] of detailEntries) {
      const label = labels.detailField(key)
      const strValue = typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : String(value)
      addRow(label, strValue)
    }
    y += 4
  }

  // ── Techniker-Notizen ─────────────────────────────────────────
  const rmEntry = history.find((e) => e.to_status === 'rueckmeldung_sent')
  if (rmEntry?.notes && rmEntry.notes !== 'Rückmeldung gesendet') {
    addSection('Notizen vom Techniker')
    const lines = doc.splitTextToSize(rmEntry.notes, pageW - 28)
    checkPage(lines.length * 5 + 4)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(lines, 16, y)
    y += lines.length * 5 + 6
  }

  // ── Fotos ─────────────────────────────────────────────────────
  if (photos.length > 0) {
    addSection(`Fotos (${photos.length})`)
    for (const photo of photos) {
      const url = getPhotoUrl(photo.storage_path)
      const lines = doc.splitTextToSize(`[${photo.photo_type}]  ${url}`, pageW - 30)
      checkPage(lines.length * 4.5 + 1)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 80, 160)
      doc.text(lines, 16, y)
      doc.setTextColor(0, 0, 0)
      y += lines.length * 4.5
    }
    y += 4
  }

  // ── Statusverlauf ─────────────────────────────────────────────
  if (history.length > 0) {
    addSection('Statusverlauf')
    for (const entry of history) {
      const statusLabel = labels.status(entry.to_status as WorkOrderStatus) || entry.to_status
      const date = new Date(entry.created_at).toLocaleString('de-DE')
      checkPage(entry.notes ? 10 : 6)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`${date}  —  ${statusLabel}`, 16, y)
      y += 5
      if (entry.notes) {
        const noteLines = doc.splitTextToSize(entry.notes, pageW - 34)
        checkPage(noteLines.length * 4.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80, 80, 80)
        doc.text(noteLines, 22, y)
        doc.setTextColor(0, 0, 0)
        y += noteLines.length * 4.5 + 1
      }
    }
  }

  doc.save(`${order.order_number}_Zertifikat.pdf`)
}

// ── Gehaltsabrechnung PDF ──────────────────────────────────────────────────────

import type { Employee } from '@/services/employeeService'
import type { PayrollResult } from '@/lib/payrollCalculation'
import { formatEUR } from '@/lib/payrollCalculation'

const MONTHS_DE_PDF = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/**
 * Generates a Gehaltsabrechnung PDF for one employee / one month.
 *
 * ⚠ VALIDATION REQUIRED — calculations must be confirmed by Janet Martinez de Peglow
 * before this document is used for official payroll purposes.
 */
export function generatePayrollPdf(
  employee: Employee,
  result: PayrollResult,
  month: number,
  year: number,
): void {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function hr(color: [number, number, number] = [200, 210, 220]) {
    doc.setDrawColor(...color)
    doc.line(14, y, pageW - 14, y)
    y += 6
  }

  function section(title: string) {
    if (y + 12 > 275) { doc.addPage(); y = 20 }
    doc.setFillColor(240, 245, 255)
    doc.rect(14, y - 3, pageW - 28, 8, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 80, 150)
    doc.text(title.toUpperCase(), 16, y + 2)
    doc.setTextColor(0, 0, 0)
    y += 10
  }

  function row(label: string, value: string, mono = false) {
    if (y + 7 > 275) { doc.addPage(); y = 20 }
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(90, 90, 90)
    doc.text(label, 16, y)
    doc.setFont('helvetica', mono ? 'normal' : 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(value || '—', 90, y)
    y += 6
  }

  function payRow(
    label: string,
    amount: number,
    rate?: string,
    indent = false,
    bold = false,
  ) {
    if (y + 6 > 275) { doc.addPage(); y = 20 }
    doc.setFontSize(9)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(bold ? 0 : 60, 60, 60)
    doc.text(label, indent ? 20 : 16, y)
    if (rate) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text(rate, 120, y)
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(formatEUR(amount), pageW - 14, y, { align: 'right' })
    y += 6
  }

  // ── HEADER ─────────────────────────────────────────────────────────────────

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 80, 150)
  doc.text('LUMEN', 14, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text('HMR Nexus Engineering GmbH', 14, y + 7)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Gehaltsabrechnung', pageW - 14, y, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(`${MONTHS_DE_PDF[month - 1]} ${year}`, pageW - 14, y + 7, { align: 'right' })

  y += 18
  hr()

  // ── PRELIMINARY WATERMARK ─────────────────────────────────────────────────

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(200, 60, 0)
  doc.text(
    '⚠ VORLÄUFIG — Berechnungen wurden noch nicht von Janet Martinez de Peglow validiert.',
    14,
    y,
  )
  y += 8

  // ── MITARBEITERDATEN ───────────────────────────────────────────────────────

  section('Mitarbeiterdaten')
  row('Name', employee.full_name)
  if (employee.email) row('E-Mail', employee.email)
  if (employee.sv_nummer) row('SV-Nummer', employee.sv_nummer, true)
  if (employee.steuer_id) row('Steuer-ID', employee.steuer_id, true)
  row('Steuerklasse', employee.steuerklasse ? `Klasse ${employee.steuerklasse}` : '—')
  if (employee.iban) row('IBAN', employee.iban, true)
  row('Einstellungsdatum', new Date(employee.start_date).toLocaleDateString('de-DE'))
  y += 4

  // ── ABRECHNUNG ────────────────────────────────────────────────────────────

  section(`Abrechnung ${MONTHS_DE_PDF[month - 1]} ${year}`)

  payRow('Bruttolohn', result.grossMonthly, undefined, false, true)
  y += 2

  // SV block
  payRow('Sozialversicherung (Arbeitnehmeranteil)', -result.totalSV, undefined, false, true)
  payRow(
    'Krankenversicherung',
    -result.kv,
    `${result.effectiveKVRate.toFixed(2)} %`,
    true,
  )
  payRow('Pflegeversicherung', -result.pv, '1,70 %', true)
  payRow('Rentenversicherung', -result.rv, '9,30 %', true)
  payRow('Arbeitslosenversicherung', -result.av, '1,30 %', true)
  y += 2

  // Tax block
  payRow(
    `Lohnsteuer (Steuerklasse ${employee.steuerklasse ?? '?'})`,
    -result.lohnsteuer,
    undefined,
    false,
    true,
  )
  if (result.solidaritaetszuschlag > 0) {
    payRow('Solidaritätszuschlag', -result.solidaritaetszuschlag, '5,50 %', true)
  }
  y += 4

  // Net
  hr([0, 80, 150])
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 80, 150)
  doc.text('NETTOLOHN (AUSZAHLUNG)', 16, y)
  doc.text(formatEUR(result.netMonthly), pageW - 14, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 10
  hr()

  // ── ARBEITGEBERKOSTEN ─────────────────────────────────────────────────────

  section('Arbeitgeberkosten (Näherung)')
  payRow('Bruttolohn', result.grossMonthly)
  payRow('AG-Anteil SV (ca.)', result.totalSV, '≈ AN-Anteil')
  y += 1
  payRow('Gesamtkosten AG (ca.)', result.grossMonthly + result.totalSV, undefined, false, true)
  y += 4

  // ── FOOTER ────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Erstellt: ${new Date().toLocaleString('de-DE')} — Berechnungsbasis: ${result.yearUsed} — Seite ${p}/${pageCount}`,
      14,
      pageH - 10,
    )
  }

  const safeName = employee.full_name.replace(/\s+/g, '_')
  doc.save(`${safeName}_Gehaltsabrechnung_${year}-${String(month).padStart(2, '0')}.pdf`)
}
