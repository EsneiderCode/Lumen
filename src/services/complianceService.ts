// Data access + orchestration for the personnel compliance module (Fase 2).
//
// Checklist materialization is the frontend's responsibility (see
// reconcileChecklist in complianceRequirementEngine.ts); the SQL side only
// validates what is materialized. Uploads go through the `compliance-upload`
// Edge Function, which re-validates file signature and size server-side.

import { supabase } from '@/lib/supabase'
import {
  computeAptitude,
  countryOriginBucket,
  reconcileChecklist,
} from '@/services/complianceRequirementEngine'
import {
  MAX_UPLOAD_BYTES,
  parseDocumentFields,
  scoreScheinselbst,
  sniffFileKind,
} from '@/services/complianceHelpers'
import type { OcrDocumentFields } from '@/services/complianceHelpers'
import type {
  AptitudeResult,
  ChecklistItemView,
  ComplianceEntity,
  ComplianceEntityKind,
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentReview,
  DocumentType,
  DocumentValidityRule,
  DocumentVersion,
  EntityAttributes,
  EntityDocument,
  RejectionReason,
  RequirementOrigin,
  RequirementScope,
  ScheinselbstCheck,
  ScheinselbstIndicator,
} from '@/types/compliance'

type Row = Record<string, unknown>

function msg(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in (error as Row)) {
    return String((error as Row).message)
  }
  return String(error)
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog + matrix
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDocumentTypes(includeInactive = false) {
  let query = supabase.from('document_types').select('*')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  return { data: (data ?? []) as unknown as DocumentType[], error: msg(error) }
}

/** Active matrix rules with the document type code denormalized for the engine. */
export async function fetchRequirements(includeInactive = false) {
  let query = supabase
    .from('document_requirements')
    .select('*, document_types:document_type_id(code)')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  const rows = ((data ?? []) as Row[]).map((row) => {
    const joined = row.document_types as { code?: string } | null
    return {
      ...row,
      document_type_code: joined?.code ?? '',
      conditions: (row.conditions ?? {}) as EntityAttributes,
    } as unknown as DocumentRequirement
  })
  return { data: rows, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix configurator CRUD (Fase 5c) — gated by RLS on compliance.configure_matrix
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentTypePayload {
  code: string
  name_i18n: Record<string, string>
  description_i18n: Record<string, string> | null
  metadata_schema?: Array<{ key: string; type: string }>
  template_storage_path?: string | null
  is_active?: boolean
}

export interface RequirementPayload {
  document_type_id: string
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
  is_active?: boolean
}

export async function createDocumentType(payload: DocumentTypePayload) {
  const { data, error } = await supabase
    .from('document_types')
    .insert({
      metadata_schema: [],
      template_storage_path: null,
      is_active: true,
      ...payload,
    } as never)
    .select('*')
    .single()
  return { data: (data as unknown as DocumentType) ?? null, error: msg(error) }
}

export async function updateDocumentType(id: string, payload: Partial<DocumentTypePayload>) {
  const { data, error } = await supabase
    .from('document_types')
    .update(payload as never)
    .eq('id', id)
    .select('*')
    .single()
  return { data: (data as unknown as DocumentType) ?? null, error: msg(error) }
}

export async function createRequirement(payload: RequirementPayload) {
  const { data, error } = await supabase
    .from('document_requirements')
    .insert({ is_active: true, ...payload } as never)
    .select('*')
    .single()
  return { data: (data as unknown as DocumentRequirement) ?? null, error: msg(error) }
}

export async function updateRequirement(id: string, payload: Partial<RequirementPayload>) {
  const { data, error } = await supabase
    .from('document_requirements')
    .update(payload as never)
    .eq('id', id)
    .select('*')
    .single()
  return { data: (data as unknown as DocumentRequirement) ?? null, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document type templates (Fase 5d) — blank official forms in compliance-documents
// under templates/<code>/<file>; read by any authenticated user (migration 049),
// write gated by compliance.configure_matrix RLS.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_BUCKET = 'compliance-documents'

/**
 * Uploads (or replaces) the PDF template of a document type and records its path
 * on document_types.template_storage_path. PDF-only, size-capped, validated by
 * magic bytes client-side (server RLS still enforces who may write).
 */
export async function uploadTemplate(
  docType: { id: string; code: string; template_storage_path?: string | null },
  file: File,
): Promise<{ data: string | null; error: string | null }> {
  if (file.size > MAX_UPLOAD_BYTES) return { data: null, error: 'file_too_large' }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (sniffFileKind(head) !== 'pdf') return { data: null, error: 'file_type_not_allowed' }

  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `templates/${docType.code}/${Date.now()}_${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(path, file, { upsert: true, contentType: 'application/pdf' })
  if (uploadError) return { data: null, error: msg(uploadError) }

  const { error: updateError } = await updateDocumentType(docType.id, { template_storage_path: path })
  if (updateError) return { data: null, error: updateError }

  // Best-effort cleanup of the previous file (never blocks the happy path).
  if (docType.template_storage_path && docType.template_storage_path !== path) {
    void supabase.storage.from(TEMPLATE_BUCKET).remove([docType.template_storage_path])
  }
  return { data: path, error: null }
}

export async function getTemplateSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return { data: null, error: msg(error) ?? 'no_signed_url' }
  return { data: data.signedUrl, error: null }
}

export async function removeTemplate(docType: { id: string; template_storage_path: string | null }) {
  if (docType.template_storage_path) {
    void supabase.storage.from(TEMPLATE_BUCKET).remove([docType.template_storage_path])
  }
  const { error } = await updateDocumentType(docType.id, { template_storage_path: null })
  return { error }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entities
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceEntityRecord extends ComplianceEntity {
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  legal_ids: Record<string, string>
  scheinselbst_check: ScheinselbstCheck | null
  notes: string | null
  created_at: string
}

export interface EntityPayload {
  kind: ComplianceEntityKind
  display_name: string
  country_code: string
  nationality_country?: string | null
  parent_entity_id?: string | null
  profile_id?: string | null
  employee_id?: string | null
  attributes?: EntityAttributes
  contact_email?: string | null
  contact_phone?: string | null
  address?: string | null
  legal_ids?: Record<string, string>
  notes?: string | null
  is_active?: boolean
}

/** Keeps attributes.non_eu_national in sync with nationality_country (Vander Elst). */
function withDerivedAttributes(payload: EntityPayload): EntityAttributes {
  const attributes = { ...(payload.attributes ?? {}) }
  const nationality = payload.nationality_country ?? null
  if (nationality) {
    attributes.non_eu_national = countryOriginBucket(nationality) === 'NON_EU'
  }
  return attributes
}

export async function fetchEntities(options: { kind?: ComplianceEntityKind; includeInactive?: boolean } = {}) {
  let query = supabase.from('compliance_entities').select('*').order('display_name')
  if (options.kind) query = query.eq('kind', options.kind)
  if (!options.includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  return { data: (data ?? []) as unknown as ComplianceEntityRecord[], error: msg(error) }
}

export async function fetchEntityByProfileId(profileId: string) {
  const { data, error } = await supabase
    .from('compliance_entities')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle()
  return { data: (data as unknown as ComplianceEntityRecord | null) ?? null, error: msg(error) }
}

export async function fetchEntityByEmployeeId(employeeId: string) {
  const { data, error } = await supabase
    .from('compliance_entities')
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle()
  return { data: (data as unknown as ComplianceEntityRecord | null) ?? null, error: msg(error) }
}

export async function fetchWorkers(parentEntityId: string, includeInactive = false) {
  let query = supabase
    .from('compliance_entities')
    .select('*')
    .eq('parent_entity_id', parentEntityId)
    .order('display_name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  return { data: (data ?? []) as unknown as ComplianceEntityRecord[], error: msg(error) }
}

export async function createEntity(payload: EntityPayload) {
  const { data, error } = await supabase
    .from('compliance_entities')
    .insert({
      kind: payload.kind,
      display_name: payload.display_name.trim(),
      country_code: payload.country_code.toUpperCase(),
      nationality_country: payload.nationality_country?.toUpperCase() || null,
      parent_entity_id: payload.parent_entity_id ?? null,
      profile_id: payload.profile_id ?? null,
      employee_id: payload.employee_id ?? null,
      attributes: withDerivedAttributes(payload),
      contact_email: payload.contact_email?.trim() || null,
      contact_phone: payload.contact_phone?.trim() || null,
      address: payload.address?.trim() || null,
      legal_ids: payload.legal_ids ?? {},
      notes: payload.notes?.trim() || null,
      is_active: payload.is_active ?? true,
    })
    .select()
    .single()
  return { data: data as unknown as ComplianceEntityRecord | null, error: msg(error) }
}

export async function updateEntity(id: string, payload: EntityPayload) {
  const { data, error } = await supabase
    .from('compliance_entities')
    .update({
      display_name: payload.display_name.trim(),
      country_code: payload.country_code.toUpperCase(),
      nationality_country: payload.nationality_country?.toUpperCase() || null,
      attributes: withDerivedAttributes(payload),
      contact_email: payload.contact_email?.trim() || null,
      contact_phone: payload.contact_phone?.trim() || null,
      address: payload.address?.trim() || null,
      legal_ids: payload.legal_ids ?? {},
      notes: payload.notes?.trim() || null,
      ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
      ...(payload.profile_id !== undefined ? { profile_id: payload.profile_id } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  return { data: data as unknown as ComplianceEntityRecord | null, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheinselbstständigkeit risk assessment (Fase 6a) — freelancers only.
// Informative decision-support persisted on compliance_entities.scheinselbst_check.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheinselbstCheckInput {
  answers: Partial<Record<ScheinselbstIndicator, boolean>>
  note: string | null
  assessedBy: string | null
}

/** Scores the checklist and stores the resulting snapshot on the entity. */
export async function saveScheinselbstCheck(entityId: string, input: ScheinselbstCheckInput) {
  const { score, maxScore, level } = scoreScheinselbst(input.answers)
  const check: ScheinselbstCheck = {
    answers: input.answers,
    note: input.note?.trim() || null,
    score,
    max_score: maxScore,
    level,
    assessed_by: input.assessedBy,
    assessed_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('compliance_entities')
    .update({ scheinselbst_check: check } as never)
    .eq('id', entityId)
    .select()
    .single()
  return { data: (data as unknown as ComplianceEntityRecord) ?? null, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// GDPR right-to-erasure (Fase 6b) — scrub a single entity's identifying PII.
// Admin action on an inactive entity whose legal retention period has lapsed;
// runs under the existing compliance RLS (admins may UPDATE compliance_entities).
// The compliance shell is kept (deactivated + pseudonymised) so the audit trail
// of past assignments stays referentially intact.
// ─────────────────────────────────────────────────────────────────────────────

export async function eraseEntityPersonalData(entityId: string, erasedBy: string | null) {
  const erasedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('compliance_entities')
    .update({
      display_name: '[RGPD]',
      nationality_country: null,
      contact_email: null,
      contact_phone: null,
      address: null,
      legal_ids: {},
      notes: null,
      scheinselbst_check: null,
      attributes: { erased: true, erased_at: erasedAt, erased_by: erasedBy },
      is_active: false,
    } as never)
    .eq('id', entityId)
    .select()
    .single()
  return { data: (data as unknown as ComplianceEntityRecord) ?? null, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist
// ─────────────────────────────────────────────────────────────────────────────

async function fetchEntityItems(entityId: string) {
  const { data, error } = await supabase
    .from('entity_documents')
    .select('*, document_types:document_type_id(*), document_versions:current_version_id(*)')
    .eq('entity_id', entityId)
  return { data: (data ?? []) as Row[], error: msg(error) }
}

/** Confirmed or draft obras of the entity — drives per_project checklist slots. */
export async function fetchAssignedProjectIds(entityId: string) {
  const { data, error } = await supabase
    .from('project_assignments')
    .select('project_id, status')
    .eq('entity_id', entityId)
    .in('status', ['draft', 'confirmed'])
  const ids = [...new Set(((data ?? []) as Row[]).map((row) => String(row.project_id)))]
  return { data: ids, error: msg(error) }
}

/**
 * Diff the entity's materialized checklist against the current matrix and
 * persist the result: missing slots inserted as `pending`, no-longer-applicable
 * ones marked `not_applicable`. Idempotent.
 */
export async function materializeChecklist(
  entity: ComplianceEntity,
  requirements: DocumentRequirement[],
) {
  const [{ data: itemRows, error: itemsError }, { data: projectIds, error: projectError }] =
    await Promise.all([fetchEntityItems(entity.id), fetchAssignedProjectIds(entity.id)])
  if (itemsError) return { error: itemsError }
  if (projectError) return { error: projectError }

  const existing = itemRows.map((row) => row as unknown as EntityDocument)
  const { toCreate, toMarkNotApplicable } = reconcileChecklist(
    entity,
    requirements,
    existing,
    projectIds,
  )

  if (toCreate.length > 0) {
    const { error } = await supabase.from('entity_documents').insert(
      toCreate.map((slot) => ({
        entity_id: entity.id,
        requirement_id: slot.requirement_id,
        document_type_id: slot.document_type_id,
        project_id: slot.project_id,
        status: 'pending' as const,
      })),
    )
    if (error) return { error: msg(error) }
  }
  if (toMarkNotApplicable.length > 0) {
    const { error } = await supabase
      .from('entity_documents')
      .update({ status: 'not_applicable' as const })
      .in('id', toMarkNotApplicable)
    if (error) return { error: msg(error) }
  }
  return { error: null }
}

/**
 * Checklist rows for one entity, joined with type, matrix rule, current
 * version and (for rejected items) the latest review. Call materializeChecklist
 * first when entity attributes/assignments may have changed.
 */
export async function fetchChecklist(
  entityId: string,
  requirements: DocumentRequirement[],
): Promise<{ data: ChecklistItemView[]; error: string | null }> {
  const { data: rows, error } = await fetchEntityItems(entityId)
  if (error) return { data: [], error }

  const requirementById = new Map(requirements.map((req) => [req.id, req]))
  const versionIds = rows
    .map((row) => (row.document_versions as Row | null)?.id)
    .filter((id): id is string => typeof id === 'string')

  let reviewsByVersion = new Map<string, DocumentReview>()
  if (versionIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from('document_reviews')
      .select('*')
      .in('version_id', versionIds)
      .order('created_at', { ascending: false })
    reviewsByVersion = new Map<string, DocumentReview>()
    for (const raw of (reviewRows ?? []) as Row[]) {
      const review = raw as unknown as DocumentReview
      if (!reviewsByVersion.has(review.version_id)) reviewsByVersion.set(review.version_id, review)
    }
  }

  const views: ChecklistItemView[] = rows.map((row) => {
    const { document_types: typeRow, document_versions: versionRow, ...item } = row
    const currentVersion = (versionRow as unknown as DocumentVersion | null) ?? null
    return {
      item: item as unknown as EntityDocument,
      documentType: typeRow as unknown as DocumentType,
      requirement: item.requirement_id
        ? (requirementById.get(String(item.requirement_id)) ?? null)
        : null,
      currentVersion,
      latestReview: currentVersion ? (reviewsByVersion.get(currentVersion.id) ?? null) : null,
    }
  })
  return { data: views, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload (via Edge Function — magic bytes + size re-checked server-side)
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadDocumentArgs {
  entityDocumentId: string
  file: File
  metadata: DocumentMetadataInput
  /** Admin one-step flow (internal personnel): upload + approve in one call. */
  directApprove?: boolean
}

export async function uploadDocument(args: UploadDocumentArgs) {
  if (args.file.size > MAX_UPLOAD_BYTES) {
    return { data: null, error: 'file_too_large' }
  }
  const head = new Uint8Array(await args.file.slice(0, 8).arrayBuffer())
  if (!sniffFileKind(head)) {
    return { data: null, error: 'file_type_not_allowed' }
  }

  const form = new FormData()
  form.append('entity_document_id', args.entityDocumentId)
  form.append('metadata', JSON.stringify(args.metadata))
  if (args.directApprove) form.append('direct_approve', 'true')
  form.append('file', args.file, args.file.name)

  const { data, error } = await supabase.functions.invoke<{ version: DocumentVersion }>(
    'compliance-upload',
    { method: 'POST', body: form },
  )
  return { data: data?.version ?? null, error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR field extraction (Fase 6c) — pre-fills the upload form. The compliance-ocr
// Edge Function returns raw text only; parsing is the shared pure helper so it is
// deterministic and unit-tested. Best-effort: a human always confirms the values.
// ─────────────────────────────────────────────────────────────────────────────

export interface OcrExtraction {
  fields: OcrDocumentFields
  rawText: string
}

export async function extractDocumentFields(
  file: File,
): Promise<{ data: OcrExtraction | null; error: string | null }> {
  if (file.size > MAX_UPLOAD_BYTES) return { data: null, error: 'file_too_large' }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!sniffFileKind(head)) return { data: null, error: 'file_type_not_allowed' }

  const form = new FormData()
  form.append('file', file, file.name)
  const { data, error } = await supabase.functions.invoke<{ text: string }>('compliance-ocr', {
    method: 'POST',
    body: form,
  })
  if (error) return { data: null, error: msg(error) }
  const rawText = data?.text ?? ''
  return { data: { fields: parseDocumentFields(rawText), rawText }, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Review (admin inbox)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewQueueEntry {
  item: EntityDocument
  documentType: DocumentType
  entity: ComplianceEntityRecord
  currentVersion: DocumentVersion | null
  projectCode: string | null
}

export async function fetchReviewQueue(): Promise<{
  data: ReviewQueueEntry[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('entity_documents')
    .select(
      '*, document_types:document_type_id(*), compliance_entities:entity_id(*), document_versions:current_version_id(*), projects:project_id(code)',
    )
    .eq('status', 'in_review')
    .order('updated_at', { ascending: true })
  const entries = ((data ?? []) as Row[]).map((row) => {
    const {
      document_types: typeRow,
      compliance_entities: entityRow,
      document_versions: versionRow,
      projects: projectRow,
      ...item
    } = row
    return {
      item: item as unknown as EntityDocument,
      documentType: typeRow as unknown as DocumentType,
      entity: entityRow as unknown as ComplianceEntityRecord,
      currentVersion: (versionRow as unknown as DocumentVersion | null) ?? null,
      projectCode: ((projectRow as { code?: string } | null)?.code ?? null),
    }
  })
  return { data: entries, error: msg(error) }
}

/** Optional real-time email to the entity owner after a review decision. */
export interface ReviewNotify {
  to: string | null
  entityName: string
  docName: string
  locale?: string
}

/**
 * Best-effort review-result email via the send-email Edge Function. The in-app
 * notification is written by the DB trigger (migration 048); this only adds the
 * email channel. Never throws — a failed send must not break the review flow.
 */
async function sendReviewEmail(
  action: 'approved' | 'rejected',
  notify: ReviewNotify | undefined,
  rejectionText?: string,
): Promise<void> {
  if (!notify?.to) return
  try {
    await supabase.functions.invoke('send-email', {
      body: {
        type: 'doc_review_result',
        to: notify.to,
        entityName: notify.entityName,
        docName: notify.docName,
        action,
        locale: notify.locale ?? 'es',
        ...(action === 'rejected' && rejectionText ? { rejectionText } : {}),
      },
    })
  } catch {
    // Non-critical — the in-app notification already covers the owner.
  }
}

export interface ApproveDocumentArgs {
  itemId: string
  versionId: string
  reviewerId: string
  approved: DocumentMetadataInput
  coverageConfirmed?: boolean
  /** When set, emails the entity owner that the document was approved. */
  notify?: ReviewNotify
}

/** Approve correcting metadata: the reviewer-confirmed values become approved_*. */
export async function approveDocument(args: ApproveDocumentArgs) {
  const approvedMetadata = {
    issued_at: args.approved.issued_at,
    expires_at: args.approved.expires_at,
    amount: args.approved.amount,
  }
  const { error: itemError } = await supabase
    .from('entity_documents')
    .update({
      status: 'approved',
      approved_issued_at: args.approved.issued_at,
      approved_expires_at: args.approved.expires_at,
      approved_amount: args.approved.amount,
      approved_metadata: approvedMetadata,
      coverage_confirmed: args.coverageConfirmed ?? false,
    })
    .eq('id', args.itemId)
  if (itemError) return { error: msg(itemError) }

  const { error: reviewError } = await supabase.from('document_reviews').insert({
    version_id: args.versionId,
    reviewer_id: args.reviewerId,
    action: 'approved',
    approved_metadata: approvedMetadata,
  })
  if (reviewError) return { error: msg(reviewError) }

  await sendReviewEmail('approved', args.notify)
  return { error: null }
}

export interface RejectDocumentArgs {
  itemId: string
  versionId: string
  reviewerId: string
  reasons: RejectionReason[]
  text: string
  /** When set, emails the entity owner that the document was rejected. */
  notify?: ReviewNotify
}

/** Reject with typed causes; the free-text explanation is mandatory. */
export async function rejectDocument(args: RejectDocumentArgs) {
  if (args.reasons.length === 0) return { error: 'rejection_reasons_required' }
  if (!args.text.trim()) return { error: 'rejection_text_required' }

  const { error: itemError } = await supabase
    .from('entity_documents')
    .update({ status: 'rejected' })
    .eq('id', args.itemId)
  if (itemError) return { error: msg(itemError) }

  const { error: reviewError } = await supabase.from('document_reviews').insert({
    version_id: args.versionId,
    reviewer_id: args.reviewerId,
    action: 'rejected',
    rejection_reasons: args.reasons,
    rejection_text: args.text.trim(),
  })
  if (reviewError) return { error: msg(reviewError) }

  await sendReviewEmail('rejected', args.notify, args.text.trim())
  return { error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Files (signed URLs + RGPD access log)
// ─────────────────────────────────────────────────────────────────────────────

export async function getVersionSignedUrl(
  version: Pick<DocumentVersion, 'id' | 'storage_bucket' | 'storage_path'>,
  accessedBy: string,
) {
  const { data, error } = await supabase.storage
    .from(version.storage_bucket)
    .createSignedUrl(version.storage_path, 3600)
  if (error || !data?.signedUrl) return { data: null, error: msg(error) ?? 'no_signed_url' }

  // RGPD trail — best effort, never blocks the download.
  void supabase
    .from('document_access_log')
    .insert({ version_id: version.id, accessed_by: accessedBy, action: 'download' })
    .then(() => undefined)

  return { data: data.signedUrl, error: null }
}

export async function fetchVersionHistory(entityDocumentId: string) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('entity_document_id', entityDocumentId)
    .order('version_number', { ascending: false })
  return { data: (data ?? []) as unknown as DocumentVersion[], error: msg(error) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aptitude pre-flight for work-order screens (twin of the 046 DB gates)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileComplianceResult {
  hasEntity: boolean
  aptitude: AptitudeResult | null
  /** Document type codes with problems — for the warning banner. */
  missingCodes: string[]
  isBlocked: boolean
}

/**
 * Frontend mirror of the DB assignment/cert gates: aptitude of the contractor's
 * entity for the given obra. Red (or no entity) blocks.
 */
export async function fetchProfileCompliance(
  profileId: string,
  projectId?: string | null,
): Promise<{ data: ProfileComplianceResult; error: string | null }> {
  const { data: entity, error: entityError } = await fetchEntityByProfileId(profileId)
  if (entityError) {
    return {
      data: { hasEntity: false, aptitude: null, missingCodes: [], isBlocked: true },
      error: entityError,
    }
  }
  if (!entity) {
    return {
      data: { hasEntity: false, aptitude: null, missingCodes: [], isBlocked: true },
      error: null,
    }
  }

  const [{ data: requirements, error: reqError }, { data: itemRows, error: itemsError }] =
    await Promise.all([fetchRequirements(), fetchEntityItems(entity.id)])
  if (reqError || itemsError) {
    return {
      data: { hasEntity: true, aptitude: null, missingCodes: [], isBlocked: true },
      error: reqError ?? itemsError,
    }
  }

  const items = itemRows.map(
    ({ document_types: _t, document_versions: _v, ...item }) => item as unknown as EntityDocument,
  )
  const aptitude = computeAptitude({
    entity,
    requirements,
    items,
    projectId: projectId ?? null,
  })
  const missingCodes = [
    ...new Set(
      aptitude.problems
        .filter((problem) => problem.severity === 'red')
        .map((problem) => problem.document_type ?? problem.reason),
    ),
  ]
  return {
    data: {
      hasEntity: true,
      aptitude,
      missingCodes,
      isBlocked: aptitude.level === 'red',
    },
    error: null,
  }
}

/** Stable map key for a (contractor, obra) aptitude result. */
export function assignmentKey(profileId: string, projectId: string | null): string {
  return `${profileId}:${projectId ?? ''}`
}

function redCodes(aptitude: AptitudeResult): string[] {
  return [
    ...new Set(
      aptitude.problems
        .filter((problem) => problem.severity === 'red')
        .map((problem) => problem.document_type ?? problem.reason),
    ),
  ]
}

/**
 * Batched twin of {@link fetchProfileCompliance} for the per-project semáforo on
 * the work-order board: computes aptitude for many (contractor, obra) pairs with
 * three round-trips total (requirements + entities + items) instead of N.
 * Mirrors the single-profile contract exactly, including its limitation of not
 * capping a company_worker by its parent (the DB gate remains authoritative).
 * Keyed by {@link assignmentKey}; each distinct pair is computed once.
 */
export async function fetchComplianceForAssignments(
  pairs: { profileId: string; projectId: string | null }[],
): Promise<{ data: Map<string, ProfileComplianceResult>; error: string | null }> {
  const result = new Map<string, ProfileComplianceResult>()
  const profileIds = [...new Set(pairs.map((pair) => pair.profileId))]
  if (profileIds.length === 0) return { data: result, error: null }

  const [{ data: requirements, error: reqError }, entitiesRes] = await Promise.all([
    fetchRequirements(),
    supabase.from('compliance_entities').select('*').in('profile_id', profileIds).eq('is_active', true),
  ])
  if (reqError) return { data: result, error: reqError }
  if (entitiesRes.error) return { data: result, error: msg(entitiesRes.error) }

  const entities = (entitiesRes.data ?? []) as unknown as ComplianceEntityRecord[]
  const entityByProfile = new Map<string, ComplianceEntityRecord>()
  for (const entity of entities) {
    if (entity.profile_id) entityByProfile.set(entity.profile_id, entity)
  }

  const entityIds = entities.map((entity) => entity.id)
  const itemsByEntity = new Map<string, EntityDocument[]>()
  if (entityIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('entity_documents')
      .select('*')
      .in('entity_id', entityIds)
    if (itemsError) return { data: result, error: msg(itemsError) }
    for (const row of (itemRows ?? []) as unknown as EntityDocument[]) {
      const list = itemsByEntity.get(row.entity_id) ?? []
      list.push(row)
      itemsByEntity.set(row.entity_id, list)
    }
  }

  for (const { profileId, projectId } of pairs) {
    const key = assignmentKey(profileId, projectId)
    if (result.has(key)) continue
    const entity = entityByProfile.get(profileId)
    if (!entity) {
      result.set(key, { hasEntity: false, aptitude: null, missingCodes: [], isBlocked: true })
      continue
    }
    const aptitude = computeAptitude({
      entity,
      requirements,
      items: itemsByEntity.get(entity.id) ?? [],
      projectId,
    })
    result.set(key, {
      hasEntity: true,
      aptitude,
      missingCodes: redCodes(aptitude),
      isBlocked: aptitude.level === 'red',
    })
  }
  return { data: result, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspection dossier (Fase 5) — read-only snapshot assembled for the PDF export
// ─────────────────────────────────────────────────────────────────────────────

/** One entity's compliance snapshot: its checklist + computed aptitude. */
export interface DossierSection {
  entity: ComplianceEntityRecord
  aptitude: AptitudeResult
  items: ChecklistItemView[]
}

/**
 * Full inspection dossier for an entity. For companies it also embeds each
 * posted worker's section, with the company aptitude passed as `parentAptitude`
 * so a worker cannot read greener than the company that fields it — mirroring
 * the DB gate.
 */
export interface EntityDossier {
  main: DossierSection
  workers: DossierSection[]
  generatedAt: string
}

/**
 * Assembles the {@link EntityDossier} for the entity (entity-scope aptitude,
 * projectId null). Reuses fetchChecklist / fetchWorkers / computeAptitude so it
 * stays consistent with the panels and the enforcement gates.
 */
export async function fetchEntityDossier(
  entity: ComplianceEntityRecord,
  requirements?: DocumentRequirement[],
): Promise<{ data: EntityDossier | null; error: string | null }> {
  let matrix = requirements
  if (!matrix) {
    const { data, error } = await fetchRequirements()
    if (error) return { data: null, error }
    matrix = data
  }

  const { data: items, error: itemsError } = await fetchChecklist(entity.id, matrix)
  if (itemsError) return { data: null, error: itemsError }

  const aptitude = computeAptitude({
    entity,
    requirements: matrix,
    items: items.map((view) => view.item),
    projectId: null,
  })
  const main: DossierSection = { entity, aptitude, items }

  const workers: DossierSection[] = []
  if (entity.kind === 'company') {
    const { data: roster, error: workersError } = await fetchWorkers(entity.id)
    if (workersError) return { data: null, error: workersError }
    for (const worker of roster) {
      const { data: workerItems, error: workerError } = await fetchChecklist(worker.id, matrix)
      if (workerError) return { data: null, error: workerError }
      workers.push({
        entity: worker,
        aptitude: computeAptitude({
          entity: worker,
          requirements: matrix,
          items: workerItems.map((view) => view.item),
          projectId: null,
          parentAptitude: aptitude,
        }),
        items: workerItems,
      })
    }
  }

  return { data: { main, workers, generatedAt: new Date().toISOString() }, error: null }
}
