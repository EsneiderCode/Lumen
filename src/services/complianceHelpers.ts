// Pure UI/validation helpers for the compliance portals (Fase 2).
// No Supabase imports — everything here is exercised by the vitest suite.
//
// The file-signature check is the TypeScript twin of the one enforced in the
// `compliance-upload` Edge Function; keep both in sync. The client-side copy
// only exists to reject bad files before the round-trip.

import type {
  ChecklistItemView,
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentType,
  EntityDocumentStatus,
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
