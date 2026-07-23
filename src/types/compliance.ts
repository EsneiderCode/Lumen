// Domain types for the personnel compliance module (migrations 042–045).
// Mirrors the SQL schema; regenerate database.types.ts after applying the
// migrations for the raw table types — these are the app-facing shapes.

export type ComplianceEntityKind =
  | 'company'
  | 'company_worker'
  | 'freelancer'
  | 'internal_employee'

export type RequirementOrigin = 'DE' | 'ES' | 'EU_OTHER' | 'NON_EU' | 'ALL'

export type RequirementScope = 'entity' | 'per_project'

export type DocumentValidityRule =
  | 'expiry_required'
  | 'days_from_issue'
  | 'must_cover_assignment'
  | 'no_expiry'

export type EntityDocumentStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expiring'
  | 'expired'
  | 'not_applicable'

export type ComplianceAssignmentStatus = 'draft' | 'confirmed' | 'ended' | 'cancelled'

export type AptitudeLevel = 'green' | 'yellow' | 'red'

/** Flat evaluable flags matched via subset semantics against requirement conditions. */
export type EntityAttributes = Record<string, boolean | string | number>

export interface DocumentType {
  id: string
  code: string
  name_i18n: Record<string, string>
  description_i18n: Record<string, string> | null
  metadata_schema: Array<{ key: string; type: string }>
  template_storage_path: string | null
  is_active: boolean
}

export interface DocumentRequirement {
  id: string
  document_type_id: string
  /** Denormalized for engine output; joined in queries. */
  document_type_code: string
  applies_to: ComplianceEntityKind
  origin: RequirementOrigin
  scope: RequirementScope
  is_mandatory: boolean
  conditions: EntityAttributes
  validity_rule: DocumentValidityRule
  validity_days: number | null
  min_amount: number | null
  requires_coverage_confirmation: boolean
  notify_days: number[]
  on_missing_action: string | null
  is_active: boolean
}

export interface ComplianceEntity {
  id: string
  kind: ComplianceEntityKind
  parent_entity_id: string | null
  profile_id: string | null
  employee_id: string | null
  display_name: string
  country_code: string
  nationality_country: string | null
  attributes: EntityAttributes
  is_active: boolean
}

export interface EntityDocument {
  id: string
  entity_id: string
  requirement_id: string | null
  document_type_id: string
  project_id: string | null
  status: EntityDocumentStatus
  current_version_id: string | null
  approved_issued_at: string | null
  approved_expires_at: string | null
  approved_amount: number | null
  coverage_confirmed: boolean
}

/** Assignment window (ISO dates) used by must_cover_assignment validation. */
export interface AssignmentWindow {
  start_date: string
  end_date: string
}

export interface AptitudeProblem {
  severity: 'red' | 'yellow'
  document_type: string | null
  reason: string
}

export interface AptitudeResult {
  level: AptitudeLevel
  problems: AptitudeProblem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Review workflow (Fase 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Typed rejection causes offered in the admin review inbox. */
export const REJECTION_REASONS = [
  'ilegible',
  'caducado',
  'importe_insuficiente',
  'no_cubre_alemania',
  'formato_incorrecto',
  'fechas_no_cubren_obra',
  'otro',
] as const

export type RejectionReason = (typeof REJECTION_REASONS)[number]

export interface DocumentVersion {
  id: string
  entity_document_id: string
  version_number: number
  file_name: string
  storage_bucket: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  submitted_metadata: Record<string, unknown>
  uploaded_by: string
  uploaded_at: string
}

export interface DocumentReview {
  id: string
  version_id: string
  reviewer_id: string
  action: 'approved' | 'rejected'
  approved_metadata: Record<string, unknown> | null
  rejection_reasons: RejectionReason[] | null
  rejection_text: string | null
  created_at: string
}

/** Metadata the uploader declares and the reviewer confirms/corrects. */
export interface DocumentMetadataInput {
  issued_at: string | null
  expires_at: string | null
  amount: number | null
  notes?: string | null
}

/** Checklist row as rendered by the portals: item + joined context. */
export interface ChecklistItemView {
  item: EntityDocument
  documentType: DocumentType
  requirement: DocumentRequirement | null
  currentVersion: DocumentVersion | null
  latestReview: DocumentReview | null
}

/** Slot the checklist materializer must ensure exists in entity_documents. */
export interface ChecklistSlot {
  requirement_id: string
  document_type_id: string
  project_id: string | null
}

export interface ChecklistReconciliation {
  /** Missing slots to insert as `pending`. */
  toCreate: ChecklistSlot[]
  /** Existing item ids whose requirement no longer applies (approved ones are kept untouched). */
  toMarkNotApplicable: string[]
}
