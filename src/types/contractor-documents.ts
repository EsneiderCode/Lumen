export type ContractorDocumentType =
  | 'gewerbeanmeldung'
  | 'haftpflichtversicherung'
  | 'unbedenklichkeit_finanzamt'
  | 'unbedenklichkeit_sozialkasse'
  | 'id_passport'
  | 'subcontractor_agreement'

export type ContractorDocumentStatus = 'pending_review' | 'approved' | 'rejected'

export interface ContractorDocument {
  id: string
  contractor_id: string
  document_type: ContractorDocumentType
  status: ContractorDocumentStatus
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  issued_at: string | null
  expires_at: string | null
  uploaded_by: string
  uploaded_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface ContractorDocumentSlot {
  type: ContractorDocumentType
  latest: ContractorDocument | null
  isValid: boolean
  isExpiringSoon: boolean
  isExpired: boolean
}

export const REQUIRED_CONTRACTOR_DOCUMENT_TYPES: ContractorDocumentType[] = [
  'gewerbeanmeldung',
  'haftpflichtversicherung',
  'unbedenklichkeit_finanzamt',
  'unbedenklichkeit_sozialkasse',
  'id_passport',
  'subcontractor_agreement',
]
