import jsPDF from 'jspdf'
import { STATUS_LABELS, WORK_TYPE_LABELS, DETAIL_FIELD_LABELS } from '@/constants/labels'

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
  doc.text(STATUS_LABELS[order.status] ?? order.status, pageW - 14, y + 7, { align: 'right' })

  y += 20
  doc.setDrawColor(180, 200, 220)
  doc.line(14, y, pageW - 14, y)
  y += 10

  // ── Auftragsdaten ─────────────────────────────────────────────
  addSection('Auftragsdaten')
  addRow('Auftragstyp', WORK_TYPE_LABELS[order.work_type] ?? order.work_type)
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
    addSection(`Technische Daten — ${WORK_TYPE_LABELS[order.work_type] ?? order.work_type}`)
    for (const [key, value] of detailEntries) {
      const label = DETAIL_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
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
      const statusLabel = STATUS_LABELS[entry.to_status] ?? entry.to_status
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
