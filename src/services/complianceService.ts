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
import { MAX_UPLOAD_BYTES, sniffFileKind } from '@/services/complianceHelpers'
import type {
  AptitudeResult,
  ChecklistItemView,
  ComplianceEntity,
  ComplianceEntityKind,
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentReview,
  DocumentType,
  DocumentVersion,
  EntityAttributes,
  EntityDocument,
  RejectionReason,
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

export async function fetchDocumentTypes() {
  const { data, error } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_active', true)
  return { data: (data ?? []) as unknown as DocumentType[], error: msg(error) }
}

/** Active matrix rules with the document type code denormalized for the engine. */
export async function fetchRequirements() {
  const { data, error } = await supabase
    .from('document_requirements')
    .select('*, document_types:document_type_id(code)')
    .eq('is_active', true)
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
// Entities
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceEntityRecord extends ComplianceEntity {
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  legal_ids: Record<string, string>
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

export interface ApproveDocumentArgs {
  itemId: string
  versionId: string
  reviewerId: string
  approved: DocumentMetadataInput
  coverageConfirmed?: boolean
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
  return { error: msg(reviewError) }
}

export interface RejectDocumentArgs {
  itemId: string
  versionId: string
  reviewerId: string
  reasons: RejectionReason[]
  text: string
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
  return { error: msg(reviewError) }
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
