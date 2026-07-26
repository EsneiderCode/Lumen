import jsPDF from 'jspdf'
import i18n from '@/i18n'
import { labels } from '@/i18n/labels'
import type { CaptureDetailEntry } from '@/types/capture-plan'
import type { WorkOrderStatus, WorkType } from '@/types/enums'
import type { DossierSection, EntityDossier } from '@/services/complianceService'
import type { ComplianceReports } from '@/services/complianceReportsService'
import { documentTypeName } from '@/services/complianceHelpers'
import type { AptitudeLevel } from '@/types/compliance'

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
  /**
   * The technical data as captureDetailEntries() produced it. Each line carries
   * its own label key, so a plan can add a field without this file (or the
   * `detailField.*` catalog) having to know about it.
   */
  detail: CaptureDetailEntry[],
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
  if (detail.length > 0) {
    addSection(`Technische Daten — ${labels.workType(order.work_type as WorkType) || order.work_type}`)
    for (const { labelKey, value } of detail) {
      const strValue = typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : String(value)
      addRow(i18n.t(labelKey), strValue)
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

// ── Compliance-Dossier PDF (Fase 5) ─────────────────────────────────────────────

type TFunc = (key: string, opts?: Record<string, unknown>) => string

interface DossierPdfOptions {
  t: TFunc
  locale: string
}

const APTITUDE_RGB: Record<AptitudeLevel, [number, number, number]> = {
  green: [22, 140, 70],
  yellow: [180, 130, 0],
  red: [200, 40, 0],
}

/**
 * Inspection dossier PDF (Prüfungsdossier) for one compliance entity: identity,
 * aptitude semaphore and the full document checklist with statuses/validity. For
 * companies, each posted worker gets its own section. Read-only snapshot handed
 * to auditors (Zoll, client) — no files are embedded, only the record of record.
 */
export function generateComplianceDossierPdf(dossier: EntityDossier, opts: DossierPdfOptions): void {
  const { t, locale } = opts
  const dateLocale = locale === 'es' ? 'es-ES' : 'de-DE'
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function fmtDate(value: string | null | undefined): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString(dateLocale)
  }

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
    const textX = 70
    const lines = doc.splitTextToSize(value || '—', pageW - textX - 14)
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

  function aptitudeBadge(level: AptitudeLevel) {
    const [r, g, b] = APTITUDE_RGB[level]
    const label = t(`compliance.aptitude.${level}`).toUpperCase()
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    const w = doc.getTextWidth(label) + 8
    checkPage(9)
    doc.setDrawColor(r, g, b)
    doc.setFillColor(r, g, b)
    doc.rect(pageW - 14 - w, y - 4.5, w, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(label, pageW - 14 - w + 4, y)
    doc.setTextColor(0, 0, 0)
  }

  function docTable(section: DossierSection) {
    const items = section.items.filter((view) => view.item.status !== 'not_applicable')
    if (items.length === 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      checkPage(7)
      doc.text(t('compliance.dossier.noDocuments'), 16, y)
      doc.setTextColor(0, 0, 0)
      y += 8
      return
    }
    // Column layout: document | status | issued | expires | amount
    const cols = { doc: 16, status: 100, issued: 132, expires: 158, amount: 184 }
    checkPage(8)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text(t('compliance.dossier.colDocument').toUpperCase(), cols.doc, y)
    doc.text(t('compliance.dossier.colStatus').toUpperCase(), cols.status, y)
    doc.text(t('compliance.dossier.colIssued').toUpperCase(), cols.issued, y)
    doc.text(t('compliance.dossier.colExpires').toUpperCase(), cols.expires, y)
    doc.text(t('compliance.dossier.colAmount').toUpperCase(), cols.amount, y)
    y += 2
    doc.setDrawColor(200, 210, 220)
    doc.line(14, y, pageW - 14, y)
    y += 5

    for (const view of items) {
      const { item, documentType, requirement } = view
      const name = documentTypeName(documentType, locale)
      const nameLines = doc.splitTextToSize(
        requirement && !requirement.is_mandatory ? `${name} (${t('common.optional')})` : name,
        cols.status - cols.doc - 3,
      )
      checkPage(nameLines.length * 4.5 + 2)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(nameLines, cols.doc, y)
      const statusColor: [number, number, number] =
        item.status === 'approved' ? [22, 140, 70]
        : item.status === 'rejected' || item.status === 'expired' ? [200, 40, 0]
        : item.status === 'expiring' ? [180, 130, 0]
        : [110, 110, 110]
      doc.setTextColor(...statusColor)
      doc.text(t(`compliance.status.${item.status}`), cols.status, y)
      doc.setTextColor(0, 0, 0)
      doc.text(fmtDate(item.approved_issued_at), cols.issued, y)
      doc.text(fmtDate(item.approved_expires_at), cols.expires, y)
      doc.text(
        item.approved_amount != null ? `${item.approved_amount.toLocaleString(dateLocale)} €` : '—',
        cols.amount,
        y,
      )
      y += Math.max(nameLines.length * 4.5, 5) + 1
    }
    y += 3
  }

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 160)
  doc.text('LUMEN', 14, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('HMR Nexus Engineering GmbH', 14, y + 7)
  doc.text(
    `${t('compliance.dossier.generatedAt')}: ${new Date(dossier.generatedAt).toLocaleString(dateLocale)}`,
    14,
    y + 13,
  )

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(t('compliance.dossier.title'), pageW - 14, y, { align: 'right' })

  y += 20
  doc.setDrawColor(180, 200, 220)
  doc.line(14, y, pageW - 14, y)
  y += 10

  // ── Entity identity ─────────────────────────────────────────────────────────
  const entity = dossier.main.entity
  addSection(t('compliance.dossier.entitySection'))
  aptitudeBadge(dossier.main.aptitude.level)
  addRow(t('compliance.dossier.name'), entity.display_name)
  addRow(t('compliance.dossier.kind'), t(`compliance.kinds.${entity.kind}`))
  addRow(
    t('compliance.entity.country'),
    entity.nationality_country && entity.nationality_country !== entity.country_code
      ? `${entity.country_code} · ${t('compliance.entity.nationality')}: ${entity.nationality_country}`
      : entity.country_code,
  )
  if (entity.contact_email) addRow('E-Mail', entity.contact_email)
  if (entity.contact_phone) addRow(t('compliance.dossier.phone'), entity.contact_phone)
  if (entity.address) addRow(t('compliance.dossier.address'), entity.address)
  for (const [key, value] of Object.entries(entity.legal_ids ?? {})) {
    if (value) addRow(key.toUpperCase(), value)
  }
  y += 2

  // ── Entity documents ─────────────────────────────────────────────────────────
  addSection(t('compliance.dossier.documentsSection'))
  docTable(dossier.main)

  // ── Workers ─────────────────────────────────────────────────────────────────
  if (entity.kind === 'company') {
    addSection(t('compliance.dossier.workersSection'))
    if (dossier.workers.length === 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      checkPage(7)
      doc.text(t('compliance.dossier.noWorkers'), 16, y)
      doc.setTextColor(0, 0, 0)
      y += 8
    } else {
      for (const worker of dossier.workers) {
        checkPage(10)
        doc.setFontSize(9.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text(worker.entity.display_name, 16, y)
        aptitudeBadge(worker.aptitude.level)
        y += 6
        docTable(worker)
      }
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(
      `${t('compliance.dossier.footer')} — ${new Date(dossier.generatedAt).toLocaleString(dateLocale)} — ${p}/${pageCount}`,
      14,
      pageH - 10,
    )
  }

  const safeName = entity.display_name.replace(/\s+/g, '_')
  doc.save(`${safeName}_Compliance-Dossier.pdf`)
}

// ── Compliance-Informe PDF (Fase 5b) ────────────────────────────────────────────

function localizedName(map: Record<string, string>, locale: string, fallback: string): string {
  return map[locale] ?? map.de ?? map.es ?? map.en ?? fallback
}

/**
 * Aggregate compliance report PDF: KPI summary, documents expiring within the
 * window (incl. already expired) and the aptitude portfolio. Landscape so the
 * tables breathe. Companion to the per-entity dossier.
 */
export function generateComplianceReportsPdf(reports: ComplianceReports, opts: DossierPdfOptions): void {
  const { t, locale } = opts
  const dateLocale = locale === 'es' ? 'es-ES' : 'de-DE'
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 18

  function fmtDate(value: string | null | undefined): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString(dateLocale)
  }

  function checkPage(needed = 8) {
    if (y + needed > pageH - 16) {
      doc.addPage()
      y = 18
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

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 160)
  doc.text('LUMEN', 14, y)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('HMR Nexus Engineering GmbH', 14, y + 6)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(t('compliance.reports.title'), pageW - 14, y, { align: 'right' })
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(
    `${t('compliance.dossier.generatedAt')}: ${new Date(reports.generatedAt).toLocaleString(dateLocale)}`,
    pageW - 14,
    y + 6,
    { align: 'right' },
  )
  y += 14
  doc.setDrawColor(180, 200, 220)
  doc.line(14, y, pageW - 14, y)
  y += 10

  // ── Summary ─────────────────────────────────────────────────────────────
  addSection(t('compliance.reports.summarySection'))
  const s = reports.summary
  const kpis: Array<[string, string]> = [
    [t('compliance.reports.kpiEntities'), String(s.entities)],
    [t('compliance.aptitude.green'), String(s.green)],
    [t('compliance.aptitude.yellow'), String(s.yellow)],
    [t('compliance.aptitude.red'), String(s.red)],
    [t('compliance.reports.kpiExpiringSoon'), String(s.expiringSoon)],
    [t('compliance.reports.kpiExpired'), String(s.expired)],
  ]
  const kpiW = (pageW - 28) / kpis.length
  checkPage(18)
  kpis.forEach(([label, value], index) => {
    const x = 14 + index * kpiW
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(value, x + 2, y + 6)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110, 110, 110)
    doc.text(label.toUpperCase(), x + 2, y + 11)
  })
  y += 20

  // ── Expiring documents ──────────────────────────────────────────────────
  addSection(t('compliance.reports.expiringSection', { days: reports.windowDays }))
  {
    const cols = { doc: 16, entity: 100, parent: 165, status: 215, expires: 245, days: 275 }
    checkPage(8)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text(t('compliance.dossier.colDocument').toUpperCase(), cols.doc, y)
    doc.text(t('compliance.reports.colEntity').toUpperCase(), cols.entity, y)
    doc.text(t('compliance.reports.colParent').toUpperCase(), cols.parent, y)
    doc.text(t('compliance.dossier.colStatus').toUpperCase(), cols.status, y)
    doc.text(t('compliance.dossier.colExpires').toUpperCase(), cols.expires, y)
    doc.text(t('compliance.reports.colDaysLeft').toUpperCase(), cols.days, y)
    y += 2
    doc.setDrawColor(200, 210, 220)
    doc.line(14, y, pageW - 14, y)
    y += 5

    if (reports.expiring.length === 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text(t('compliance.reports.noExpiring'), 16, y)
      doc.setTextColor(0, 0, 0)
      y += 8
    } else {
      for (const row of reports.expiring) {
        checkPage(6)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        doc.text(doc.splitTextToSize(localizedName(row.docName, locale, row.code), cols.entity - cols.doc - 3), cols.doc, y)
        doc.text(doc.splitTextToSize(row.entityName, cols.parent - cols.entity - 3), cols.entity, y)
        doc.text(doc.splitTextToSize(row.parentName ?? '—', cols.status - cols.parent - 3), cols.parent, y)
        const expired = row.daysLeft < 0
        doc.setTextColor(...(expired ? [200, 40, 0] as [number, number, number] : [180, 130, 0] as [number, number, number]))
        doc.text(t(`compliance.status.${row.status}`), cols.status, y)
        doc.setTextColor(0, 0, 0)
        doc.text(fmtDate(row.expiresAt), cols.expires, y)
        doc.setTextColor(...(expired ? [200, 40, 0] as [number, number, number] : [0, 0, 0] as [number, number, number]))
        doc.text(
          expired ? t('compliance.reports.expiredBy', { days: Math.abs(row.daysLeft) }) : String(row.daysLeft),
          cols.days,
          y,
        )
        doc.setTextColor(0, 0, 0)
        y += 5.5
      }
    }
    y += 3
  }

  // ── Portfolio ───────────────────────────────────────────────────────────
  addSection(t('compliance.reports.portfolioSection'))
  {
    const cols = { entity: 16, kind: 110, country: 165, apt: 190, prob: 235, work: 258, exp: 278 }
    checkPage(8)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text(t('compliance.reports.colEntity').toUpperCase(), cols.entity, y)
    doc.text(t('compliance.dossier.kind').toUpperCase(), cols.kind, y)
    doc.text(t('compliance.entity.country').toUpperCase(), cols.country, y)
    doc.text(t('compliance.reports.colAptitude').toUpperCase(), cols.apt, y)
    doc.text(t('compliance.reports.colProblems').toUpperCase(), cols.prob, y)
    doc.text(t('compliance.reports.colWorkers').toUpperCase(), cols.work, y)
    doc.text(t('compliance.reports.colExpiring').toUpperCase(), cols.exp, y)
    y += 2
    doc.setDrawColor(200, 210, 220)
    doc.line(14, y, pageW - 14, y)
    y += 5

    for (const row of reports.portfolio) {
      checkPage(6)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(doc.splitTextToSize(row.entity.display_name, cols.kind - cols.entity - 3), cols.entity, y)
      doc.text(t(`compliance.kinds.${row.entity.kind}`), cols.kind, y)
      doc.text(row.entity.country_code, cols.country, y)
      const [r, g, b] = APTITUDE_RGB[row.level]
      doc.setTextColor(r, g, b)
      doc.setFont('helvetica', 'bold')
      doc.text(t(`compliance.aptitude.${row.level}`), cols.apt, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(String(row.problemCount), cols.prob, y)
      doc.text(String(row.workerCount), cols.work, y)
      doc.text(String(row.expiringCount), cols.exp, y)
      y += 5.5
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(
      `${t('compliance.reports.footer')} — ${new Date(reports.generatedAt).toLocaleString(dateLocale)} — ${p}/${pageCount}`,
      14,
      pageH - 8,
    )
  }

  doc.save(`LUMEN_Compliance-${t('compliance.reports.fileLabel')}_${reports.generatedAt.slice(0, 10)}.pdf`)
}
