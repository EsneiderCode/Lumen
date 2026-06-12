import type { ContractorDocument, ContractorDocumentType } from '@/types/contractor-documents'
import { REQUIRED_CONTRACTOR_DOCUMENT_TYPES } from '@/types/contractor-documents'

export type WorkOrderActionErrorCode =
  | 'invalid_transition'
  | 'permission_denied'
  | 'contractor_documents_missing'
  | 'contractor_documents_unapproved'
  | 'contractor_documents_expired'
  | 'incomplete_rueckmeldung'
  | 'missing_required_photos'
  | 'missing_internal_audit'
  | 'missing_client_audit'
  | 'not_client_backed'
  | 'not_direct_order'
  | 'not_found'
  | 'server_error'

export interface WorkOrderActionReason {
  code: WorkOrderActionErrorCode
  message: string
  requirementId?: string
  documentType?: ContractorDocumentType
  field?: string
}

export interface WorkOrderActionResult<T = unknown> {
  ok: boolean
  data: T | null
  reasons: WorkOrderActionReason[]
}

export function toSuccessResult<T>(data: T): WorkOrderActionResult<T> {
  return { ok: true, data, reasons: [] }
}

export function toFailureResult<T = unknown>(
  reasons: WorkOrderActionReason[],
): WorkOrderActionResult<T> {
  return { ok: false, data: null, reasons }
}

export function isDirectWorkOrder(order: {
  client_id: string | null
  [key: string]: unknown
}): boolean {
  return order.client_id === null
}

function isExpiredForDate(expiresAt: string | null, assignmentDate: string): boolean {
  if (!expiresAt) return false
  return expiresAt < assignmentDate
}

function contractorDocumentRequirementId(documentType: ContractorDocumentType): string {
  return `contractor_document:${documentType}`
}

const CONTRACTOR_DOCUMENT_LABELS: Record<ContractorDocumentType, string> = {
  gewerbeanmeldung: 'Gewerbeanmeldung',
  haftpflichtversicherung: 'Haftpflichtversicherung',
  unbedenklichkeit_finanzamt: 'Unbedenklichkeitsbescheinigung Finanzamt',
  unbedenklichkeit_sozialkasse: 'Unbedenklichkeitsbescheinigung Sozialkasse',
  id_passport: 'Ausweis/Reisepass',
  subcontractor_agreement: 'Subunternehmervertrag',
}

export function buildContractorDocumentFailureReasons(
  docs: ContractorDocument[],
  assignmentDate: string,
): WorkOrderActionReason[] {
  return REQUIRED_CONTRACTOR_DOCUMENT_TYPES.flatMap<WorkOrderActionReason>((documentType) => {
    const latest = docs
      .filter((doc) => doc.document_type === documentType)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0]

    const requirementId = contractorDocumentRequirementId(documentType)
    const label = CONTRACTOR_DOCUMENT_LABELS[documentType]

    if (!latest) {
      return [
        {
          code: 'contractor_documents_missing' as const,
          documentType,
          requirementId,
          message: `${label} fehlt`,
        },
      ]
    }

    if (latest.status !== 'approved') {
      return [
        {
          code: 'contractor_documents_unapproved' as const,
          documentType,
          requirementId,
          message: `${label} ist nicht freigegeben`,
        },
      ]
    }

    if (isExpiredForDate(latest.expires_at, assignmentDate)) {
      return [
        {
          code: 'contractor_documents_expired' as const,
          documentType,
          requirementId,
          message: `${label} ist abgelaufen`,
        },
      ]
    }

    return []
  })
}


export interface AssignablePerson {
  id: string
  role: string
}

export function buildPersonAssignmentFailureReasons(
  person: AssignablePerson,
  documents: ContractorDocument[],
  assignmentDate: string | null,
): WorkOrderActionReason[] {
  if (person.role !== 'contractor') return []
  const effectiveAssignmentDate = assignmentDate ?? new Date().toISOString().slice(0, 10)
  return buildContractorDocumentFailureReasons(documents, effectiveAssignmentDate)
}

export function reasonsToMessage(reasons: WorkOrderActionReason[]): string {
  return reasons.map((reason) => reason.message).join('; ')
}
