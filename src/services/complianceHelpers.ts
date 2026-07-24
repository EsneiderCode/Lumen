// Pure UI/validation helpers for the compliance portals (Fase 2).
// No Supabase imports — everything here is exercised by the vitest suite.
//
// The file-signature check is the TypeScript twin of the one enforced in the
// `compliance-upload` Edge Function; keep both in sync. The client-side copy
// only exists to reject bad files before the round-trip.

import {
  SCHEINSELBST_INDICATORS,
  type ChecklistItemView,
  type DocumentMetadataInput,
  type DocumentRequirement,
  type DocumentType,
  type EntityDocumentStatus,
  type ScheinselbstIndicator,
  type ScheinselbstRiskLevel,
} from '@/types/compliance'

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15 MB, mirrored in the Edge Function

export type UploadFileKind = 'pdf' | 'jpeg' | 'png'

export const ACCEPTED_UPLOAD_MIME = 'application/pdf,image/jpeg,image/png'

/** Detect the real file type from its magic bytes (not the declared MIME). */
export function sniffFileKind(bytes: Uint8Array): UploadFileKind | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf' // %PDF
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png'
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata form derivation
// ─────────────────────────────────────────────────────────────────────────────

export interface MetadataFieldSpec {
  key: 'issued_at' | 'expires_at' | 'amount'
  required: boolean
}

/**
 * Which metadata inputs the upload/review form shows for a checklist slot,
 * derived from the requirement's validity rule and amount threshold. Ad-hoc
 * items (no requirement) fall back to the document type's metadata_schema
 * plus optional issue/expiry dates.
 */
export function metadataFieldsFor(
  documentType: Pick<DocumentType, 'metadata_schema'>,
  requirement: Pick<DocumentRequirement, 'validity_rule' | 'min_amount'> | null,
): MetadataFieldSpec[] {
  const schemaKeys = new Set(
    (documentType.metadata_schema ?? []).map((field) => field.key),
  )

  if (!requirement) {
    return [
      { key: 'issued_at', required: false },
      { key: 'expires_at', required: false },
      ...(schemaKeys.has('amount') ? [{ key: 'amount' as const, required: false }] : []),
    ]
  }

  const fields: MetadataFieldSpec[] = []
  switch (requirement.validity_rule) {
    case 'days_from_issue':
      fields.push({ key: 'issued_at', required: true })
      break
    case 'expiry_required':
      fields.push({ key: 'issued_at', required: false }, { key: 'expires_at', required: true })
      break
    case 'must_cover_assignment':
      fields.push({ key: 'issued_at', required: true }, { key: 'expires_at', required: true })
      break
    case 'no_expiry':
      fields.push({ key: 'issued_at', required: false })
      break
  }
  if (requirement.min_amount !== null || schemaKeys.has('amount')) {
    fields.push({ key: 'amount', required: requirement.min_amount !== null })
  }
  return fields
}

/** Returns the keys of required fields that are missing/invalid, [] when ok. */
export function missingMetadataFields(
  fields: MetadataFieldSpec[],
  values: DocumentMetadataInput,
): string[] {
  const missing: string[] = []
  for (const field of fields) {
    if (!field.required) continue
    const value = values[field.key]
    if (value === null || value === undefined || value === '') missing.push(field.key)
  }
  if (
    values.issued_at &&
    values.expires_at &&
    values.expires_at < values.issued_at
  ) {
    missing.push('expires_at')
  }
  return missing
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist presentation
// ─────────────────────────────────────────────────────────────────────────────

/** i18n name of a document type with sensible fallbacks. */
export function documentTypeName(
  documentType: Pick<DocumentType, 'code' | 'name_i18n'>,
  language: string,
): string {
  const names = documentType.name_i18n ?? {}
  const lang = language.slice(0, 2)
  return names[lang] ?? names.es ?? names.de ?? names.en ?? documentType.code
}

/** Portal display order: action needed first, then valid, then inapplicable. */
const STATUS_ORDER: Record<EntityDocumentStatus, number> = {
  rejected: 0,
  expired: 1,
  pending: 2,
  expiring: 3,
  in_review: 4,
  approved: 5,
  not_applicable: 6,
}

export function sortChecklist(items: ChecklistItemView[]): ChecklistItemView[] {
  return [...items].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.item.status] - STATUS_ORDER[b.item.status]
    if (byStatus !== 0) return byStatus
    const aMandatory = a.requirement?.is_mandatory ?? false
    const bMandatory = b.requirement?.is_mandatory ?? false
    if (aMandatory !== bMandatory) return aMandatory ? -1 : 1
    return a.documentType.code.localeCompare(b.documentType.code)
  })
}

export interface ChecklistProgress {
  /** Mandatory slots satisfied (approved or expiring). */
  done: number
  /** Total mandatory slots (not_applicable excluded). */
  total: number
}

export function checklistProgress(items: ChecklistItemView[]): ChecklistProgress {
  const relevant = items.filter(
    (row) =>
      row.item.status !== 'not_applicable' &&
      (row.requirement === null || row.requirement.is_mandatory),
  )
  const done = relevant.filter(
    (row) => row.item.status === 'approved' || row.item.status === 'expiring',
  ).length
  return { done, total: relevant.length }
}

/** Document type code that drives the §48b Bauabzugsteuer withholding notice. */
export const WITHHOLDING_DOC_CODE = 'freistellung_48b'

/**
 * §48b EStG: whether billing must withhold the 15% Bauabzugsteuer for this
 * entity. True when an applicable Freistellungsbescheinigung slot exists in the
 * checklist but is not currently approved/valid (missing, in review, rejected,
 * expiring or expired). The requirement is optional, so it never blocks
 * aptitude — this is a purely informative flag surfaced as a chip.
 */
export function billingWithholding(items: ChecklistItemView[]): boolean {
  return items.some(
    (row) =>
      row.documentType.code === WITHHOLDING_DOC_CODE &&
      row.item.status !== 'not_applicable' &&
      row.item.status !== 'approved',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheinselbstständigkeit risk scoring (Fase 6a)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weight per risk marker. The four strongest § 7 SGB IV markers (single client,
 * bound by instructions, integrated into the org, no entrepreneurial risk) count
 * double; the rest count once. Max score = 4·2 + 6·1 = 14.
 */
export const SCHEINSELBST_WEIGHTS: Record<ScheinselbstIndicator, number> = {
  single_client: 2,
  client_instructions: 2,
  integrated_org: 2,
  no_entrepreneurial_risk: 2,
  fixed_hours: 1,
  client_equipment: 1,
  no_own_employees: 1,
  no_market_presence: 1,
  reporting_duty: 1,
  same_as_employees: 1,
}

export interface ScheinselbstScore {
  score: number
  maxScore: number
  flaggedCount: number
  level: ScheinselbstRiskLevel
}

/**
 * Weighted risk score for the anti-Scheinselbstständigkeit checklist. Unanswered
 * markers count as "no" (no risk). Thresholds on the score ratio: <0.3 low,
 * <0.6 medium, otherwise high. Informative only — never a legal determination.
 */
export function scoreScheinselbst(
  answers: Partial<Record<ScheinselbstIndicator, boolean>>,
): ScheinselbstScore {
  let score = 0
  let maxScore = 0
  let flaggedCount = 0
  for (const indicator of SCHEINSELBST_INDICATORS) {
    maxScore += SCHEINSELBST_WEIGHTS[indicator]
    if (answers[indicator]) {
      score += SCHEINSELBST_WEIGHTS[indicator]
      flaggedCount += 1
    }
  }
  const ratio = maxScore === 0 ? 0 : score / maxScore
  const level: ScheinselbstRiskLevel = ratio >= 0.6 ? 'high' : ratio >= 0.3 ? 'medium' : 'low'
  return { score, maxScore, flaggedCount, level }
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR field extraction (Fase 6c) — deterministic parser over OCR'd text.
//
// The Edge Function `compliance-ocr` only turns the file into raw text; ALL
// field parsing lives here so there is a single, unit-tested source of truth
// (the German/Spanish document conventions are what matter, not the OCR engine).
// The result only ever PRE-FILLS the upload form — a human always confirms it.
// ─────────────────────────────────────────────────────────────────────────────

export interface OcrDocumentFields {
  issued_at: string | null
  expires_at: string | null
  amount: number | null
}

const EXPIRY_LABELS = /(g[üu]ltig\s+bis|ablauf\w*|v[áa]lido\s+hasta|vence|caduca|expir\w*|valid\s+until)/i
const ISSUE_LABELS = /(ausgestellt\w*|ausstellungsdatum|emitido\w*|fecha\s+de\s+emisi[óo]n|date\s+of\s+issue|issued\w*|ausgabedatum)/i
const AMOUNT_LABELS = /(deckungssumme|versicherungssumme|deckung|betrag|summe|importe|suma\s+asegurada|cobertura|amount|coverage)/i

/** Two-digit years map to 2000–2099. Returns an ISO date or null if invalid. */
function toIso(day: number, month: number, year: number): string | null {
  const fullYear = year < 100 ? 2000 + year : year
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : iso
}

interface FoundDate {
  iso: string
  index: number
}

/** All DD.MM.YYYY / DD/MM/YY / YYYY-MM-DD dates with their positions. */
function findDates(text: string): FoundDate[] {
  const dates: FoundDate[] = []
  const dmy = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = iso.exec(text)) !== null) {
    const value = toIso(Number(m[3]), Number(m[2]), Number(m[1]))
    if (value) dates.push({ iso: value, index: m.index })
  }
  while ((m = dmy.exec(text)) !== null) {
    // Skip ISO matches already captured (their year-first shape won't match here anyway).
    const value = toIso(Number(m[1]), Number(m[2]), Number(m[3]))
    if (value) dates.push({ iso: value, index: m.index })
  }
  return dates
}

/** Parses a German/Spanish or English numeric token into a number. */
export function parseAmountToken(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  const hasComma = s.includes(',')
  const dots = (s.match(/\./g) ?? []).length
  if (hasComma && dots > 0) {
    // Whichever separator comes last is the decimal one.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const after = s.length - s.lastIndexOf(',') - 1
    s = after >= 1 && after <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (dots > 0) {
    const after = s.length - s.lastIndexOf('.') - 1
    // A single dot with 1–2 trailing digits is a decimal point; otherwise thousands.
    if (!(dots === 1 && after >= 1 && after <= 2)) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Best-effort extraction of issue/expiry dates and a monetary amount from OCR
 * text. Label-guided first (e.g. "gültig bis", "Deckungssumme"); falls back to
 * the earliest/latest date pair when unlabelled. Any field may be null.
 */
export function parseDocumentFields(text: string): OcrDocumentFields {
  const result: OcrDocumentFields = { issued_at: null, expires_at: null, amount: null }
  if (!text) return result

  const dates = findDates(text)
  for (const date of dates) {
    const prefix = text.slice(Math.max(0, date.index - 48), date.index)
    if (!result.expires_at && EXPIRY_LABELS.test(prefix)) result.expires_at = date.iso
    else if (!result.issued_at && ISSUE_LABELS.test(prefix)) result.issued_at = date.iso
  }
  const sorted = [...dates].sort((a, b) => a.iso.localeCompare(b.iso))
  if (!result.expires_at && sorted.length > 0) result.expires_at = sorted[sorted.length - 1].iso
  if (!result.issued_at && sorted.length >= 2) {
    const earliest = sorted.find((d) => d.iso !== result.expires_at)
    if (earliest) result.issued_at = earliest.iso
  }

  // Blank out date spans so their digits are not mistaken for amounts.
  let amountText = text
  for (const date of dates) {
    amountText = amountText.slice(0, date.index) + ' '.repeat(10) + amountText.slice(date.index + 10)
  }
  const tokenRe = /\d[\d.,]*\d|\d/g
  let best: number | null = null
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(amountText)) !== null) {
    const prefix = amountText.slice(Math.max(0, m.index - 30), m.index)
    const suffix = amountText.slice(m.index + m[0].length, m.index + m[0].length + 4)
    const nearMarker = AMOUNT_LABELS.test(prefix) || /^\s*(€|eur|euro)/i.test(suffix)
    if (!nearMarker) continue
    const value = parseAmountToken(m[0])
    if (value !== null && (best === null || value > best)) best = value
  }
  result.amount = best
  return result
}
