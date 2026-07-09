import jsPDF from 'jspdf'
import type { SubcontractorOnboardingPayload } from '@/types/subcontractor-onboarding'
import type { ContractorDocumentSlot, ContractorDocumentType } from '@/types/contractor-documents'

// Official bilingual (DE / ES) labels for the UMTELKOMD compliance checklist.
// These are part of a fixed legal form and are intentionally NOT localized via i18n.
const DOC_LABELS: Record<ContractorDocumentType, [de: string, es: string]> = {
  a1_bescheinigung: ['A1-Bescheinigung (pro Mitarbeiter)', 'Certificado A1 (por trabajador)'],
  unbedenklichkeit_finanzamt: ['Freistellungsbescheinigung § 48b EStG', 'Certificado de exención fiscal § 48b'],
  mindestlohn_meldung_gzd: ['Meldung Mindestlohn / AEntG (GZD)', 'Registro salario mínimo (GZD)'],
  unbedenklichkeit_sozialkasse: ['SOKA-BAU: Enthaftung / Präqualifikation', 'SOKA-BAU: exención / precalificación'],
  ust_id_reverse_charge: ['USt-IdNr. — Reverse Charge § 13b UStG', 'NIF-IVA — inversión sujeto pasivo § 13b'],
  gewerbeanmeldung: ['Gewerbeanmeldung / Handelsregister', 'Alta de actividad / registro mercantil'],
  haftpflichtversicherung: ['Betriebshaftpflicht (Nachweis)', 'Seguro de responsabilidad civil'],
  id_passport: ['Ausweis + Qualifikation (pro Mitarbeiter)', 'Documento de identidad + cualificación'],
  zusatzvereinbarung_mindestlohn: ['Zusatzvereinbarung Mindestlohn (DE/ES)', 'Anexo de salario mínimo (DE/ES)'],
  subcontractor_agreement: ['Nachunternehmervertrag + Klauseln', 'Contrato de subcontrata + cláusulas'],
}

const NAVY: [number, number, number] = [30, 41, 59]
const GREY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [240, 242, 245]

function fmtDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('de-DE')
}

export function generateOnboardingPdf(
  onboarding: SubcontractorOnboardingPayload,
  slots: ContractorDocumentSlot[],
  contractorName: string,
): void {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const M = 14
  let y = 16

  function checkPage(needed = 8) {
    if (y + needed > 280) {
      doc.addPage()
      y = 18
    }
  }

  function bandTitle(numDe: string, es: string) {
    checkPage(14)
    doc.setFillColor(...NAVY)
    doc.rect(M, y - 4, pageW - 2 * M, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(numDe, M + 2, y + 1.5)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text(es, pageW - M - 2, y + 1.5, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 11
  }

  function field(label: string, es: string, value: string, x: number, colW: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40, 40, 40)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(...GREY)
    doc.text(es, x, y + 3.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    const lines = doc.splitTextToSize(value || '—', colW - 2)
    doc.text(lines, x, y + 8)
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('UMTELKOMD GmbH', M, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Subunternehmer-Onboarding & Compliance-Checkliste', M, 17)
  doc.setFont('helvetica', 'italic')
  doc.text('Lista de verificación de subcontratistas', pageW - M, 17, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y = 30

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  doc.text('DE: Auszufüllen und mit allen Nachweisen VOR Arbeitsbeginn / Erstzahlung einzureichen.', M, y)
  doc.setFont('helvetica', 'italic')
  doc.text('ES: Completar y entregar con todos los soportes ANTES de iniciar la obra o del primer pago.', M, y + 4)
  doc.setTextColor(0, 0, 0)
  y += 12

  // ── §1 Angaben zum Subunternehmer ─────────────────────────────────────────────
  bandTitle('1  Angaben zum Subunternehmer', 'Datos del subcontratista')
  const colW = (pageW - 2 * M - 8) / 2
  const colX = [M, M + colW + 8]
  const pairs: Array<[string, string, string]> = [
    ['Firmenname', 'Razón social', onboarding.company_name || contractorName],
    ['USt-IdNr. (ES)', 'NIF-IVA', onboarding.ust_id_es || ''],
    ['Anschrift', 'Dirección', onboarding.address || ''],
    ['Steuernummer (DE)', 'N.º fiscal alemán', onboarding.tax_number_de || ''],
    ['Ansprechpartner', 'Persona de contacto', onboarding.contact_person || ''],
    ['E-Mail / Telefon', 'Correo / Teléfono', [onboarding.contact_email, onboarding.contact_phone].filter(Boolean).join(' · ')],
    ['Projekt / Baustelle', 'Proyecto / Obra', onboarding.project_site || ''],
    ['Einsatzzeitraum', 'Período de trabajo', onboarding.deployment_period || ''],
  ]
  for (let i = 0; i < pairs.length; i += 2) {
    checkPage(16)
    field(pairs[i][0], pairs[i][1], pairs[i][2], colX[0], colW)
    if (pairs[i + 1]) field(pairs[i + 1][0], pairs[i + 1][1], pairs[i + 1][2], colX[1], colW)
    y += 16
  }
  y += 2

  // ── §2 Pflichtdokumente ───────────────────────────────────────────────────────
  bandTitle('2  Pflichtdokumente', 'Documentos obligatorios')
  const cols = { doc: M + 2, recv: M + 108, chk: M + 126, valid: M + 144, obs: M + 168 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...GREY)
  doc.text('DOKUMENT / DOCUMENTO', cols.doc, y)
  doc.text('Eing.', cols.recv, y)
  doc.text('Gepr.', cols.chk, y)
  doc.text('Gültig bis', cols.valid, y)
  doc.text('Bemerkung', cols.obs, y)
  doc.setTextColor(0, 0, 0)
  y += 3
  doc.setDrawColor(...NAVY)
  doc.line(M, y, pageW - M, y)
  y += 4

  for (const slot of slots) {
    checkPage(9)
    const [de, es] = DOC_LABELS[slot.type]
    const latest = slot.latest
    const received = Boolean(latest)
    const checked = slot.isValid
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(doc.splitTextToSize(de, 100), cols.doc, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6)
    doc.setTextColor(...GREY)
    doc.text(doc.splitTextToSize(es, 100), cols.doc, y + 3)
    doc.setTextColor(0, 0, 0)

    const box = (x: number, on: boolean) => {
      doc.setDrawColor(120, 120, 120)
      doc.rect(x, y - 3, 3.5, 3.5)
      if (on) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('X', x + 0.5, y)
      }
    }
    box(cols.recv, received)
    box(cols.chk, checked)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(fmtDate(latest?.expires_at ?? null), cols.valid, y)
    doc.text(doc.splitTextToSize(latest?.review_notes ?? '', pageW - M - cols.obs - 2), cols.obs, y)
    y += 8
    doc.setDrawColor(225, 228, 232)
    doc.line(M, y - 2.5, pageW - M, y - 2.5)
  }
  y += 3

  // ── §3 Eingesetzte Mitarbeiter (A1) ───────────────────────────────────────────
  bandTitle('3  Eingesetzte Mitarbeiter (A1)', 'Trabajadores desplazados (A1)')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...GREY)
  doc.text('NAME / NOMBRE', M + 2, y)
  doc.text('A1 GÜLTIG BIS', M + 100, y)
  doc.text('AUSWEIS-NR.', M + 150, y)
  doc.setTextColor(0, 0, 0)
  y += 2
  doc.setDrawColor(...NAVY)
  doc.line(M, y, pageW - M, y)
  y += 5
  const workers = onboarding.a1_workers.filter((w) => w.name.trim() || w.id_number.trim())
  const rows = workers.length > 0 ? workers : [{ name: '', a1_valid_until: null, id_number: '' }]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const w of rows) {
    checkPage(8)
    doc.text(w.name || '—', M + 2, y)
    doc.text(fmtDate(w.a1_valid_until) || '—', M + 100, y)
    doc.text(w.id_number || '—', M + 150, y)
    y += 6
    doc.setDrawColor(225, 228, 232)
    doc.line(M, y - 2, pageW - M, y - 2)
  }
  y += 4

  // ── §4 Prüfung & Bestätigung ──────────────────────────────────────────────────
  bandTitle('4  Prüfung & Bestätigung', 'Verificación y confirmación')
  const confirmLine = (on: boolean, de: string, es: string) => {
    checkPage(10)
    doc.setDrawColor(120, 120, 120)
    doc.rect(M, y - 3, 3.5, 3.5)
    if (on) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('X', M + 0.5, y)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(0, 0, 0)
    doc.text(doc.splitTextToSize(de, pageW - 2 * M - 8), M + 6, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(...GREY)
    doc.text(doc.splitTextToSize(es, pageW - 2 * M - 8), M + 6, y + 3.5)
    doc.setTextColor(0, 0, 0)
    y += 9
  }
  confirmLine(
    onboarding.checked_48b,
    '§ 48b: Gültigkeit im EIBE-Portal des BZSt online geprüft (Sicherheitsnummer + Dienstsiegel).',
    '§ 48b: validez comprobada online en el portal EIBE del BZSt (n.º de seguridad + sello).',
  )
  confirmLine(
    onboarding.withhold_bauabzug,
    'Ohne gültige § 48b-Bescheinigung: 15 % Bauabzugsteuer einbehalten und abführen.',
    'Sin certificado § 48b vigente: retener y girar el 15 % de Bauabzugsteuer.',
  )
  confirmLine(
    onboarding.ust_id_confirmed,
    'USt-IdNr. beim BZSt bestätigt / Reverse Charge angewandt (Netto-Rechnung).',
    'NIF-IVA confirmado en el BZSt / inversión aplicada (factura sin IVA).',
  )
  y += 4

  // Signature block
  checkPage(30)
  const sigW = (pageW - 2 * M - 10) / 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(onboarding.place_date || '', M, y)
  doc.text(onboarding.verified_by || '', M + sigW + 10, y)
  y += 2
  doc.setDrawColor(120, 120, 120)
  doc.line(M, y, M + sigW, y)
  doc.line(M + sigW + 10, y, pageW - M, y)
  y += 4
  doc.setFontSize(7)
  doc.setTextColor(...GREY)
  doc.text('Ort, Datum / Lugar, fecha', M, y)
  doc.text('Geprüft durch (Name) / Verificado por', M + sigW + 10, y)
  y += 16
  doc.setDrawColor(120, 120, 120)
  doc.line(M, y, M + sigW, y)
  doc.line(M + sigW + 10, y, pageW - M, y)
  y += 4
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Subunternehmer (Unterschrift / Stempel)', M, y)
  doc.text('UMTELKOMD GmbH — Unterschrift / Datum', M + sigW + 10, y)

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...LIGHT)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    doc.text(
      'Interne Compliance-Unterlage. Alle Dokumente in deutscher Sprache und physisch auf der Baustelle bereitzuhalten (FKS-Kontrolle).',
      M,
      pageH - 8,
    )
    doc.text(`${p}/${pageCount}`, pageW - M, pageH - 8, { align: 'right' })
  }

  const safeName = (onboarding.company_name || contractorName || 'Subunternehmer').replace(/\s+/g, '_')
  doc.save(`${safeName}_Onboarding.pdf`)
}
