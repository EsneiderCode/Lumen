import { supabase } from '@/lib/supabase'
import { STORAGE_BUCKETS } from '@/config/storage'
import type {
  ContractorDocument,
  ContractorDocumentSlot,
  ContractorDocumentStatus,
  ContractorDocumentType,
} from '@/types/contractor-documents'
import { REQUIRED_CONTRACTOR_DOCUMENT_TYPES } from '@/types/contractor-documents'

const EXPIRY_WARNING_DAYS = 30

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt + 'T23:59:59').getTime() < Date.now()
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt || isExpired(expiresAt)) return false
  const ms = new Date(expiresAt + 'T23:59:59').getTime() - Date.now()
  return ms <= EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
}

export function buildContractorDocumentSlots(docs: ContractorDocument[]): ContractorDocumentSlot[] {
  return REQUIRED_CONTRACTOR_DOCUMENT_TYPES.map((type) => {
    const matching = docs
      .filter((doc) => doc.document_type === type)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
    const latest = matching[0] ?? null
    const expired = latest ? isExpired(latest.expires_at) : false
    return {
      type,
      latest,
      isExpired: expired,
      isExpiringSoon: latest ? isExpiringSoon(latest.expires_at) : false,
      isValid: Boolean(latest && latest.status === 'approved' && !expired),
    }
  })
}

export function contractorDocumentsAreCompliant(docs: ContractorDocument[]): boolean {
  return buildContractorDocumentSlots(docs).every((slot) => slot.isValid)
}

export async function fetchContractorDocuments(contractorId: string) {
  const { data, error } = await supabase
    .from('contractor_documents')
    .select('*')
    .eq('contractor_id', contractorId)
    .order('uploaded_at', { ascending: false })
  return {
    data: (data ?? []) as ContractorDocument[],
    error: error?.message ?? null,
  }
}

export async function fetchContractorDocumentCompliance(contractorId: string) {
  const { data, error } = await fetchContractorDocuments(contractorId)
  const slots = buildContractorDocumentSlots(data)
  return {
    data: {
      slots,
      isCompliant: slots.every((slot) => slot.isValid),
      missingTypes: slots.filter((slot) => !slot.isValid).map((slot) => slot.type),
    },
    error,
  }
}

export async function uploadContractorDocument(args: {
  contractorId: string
  documentType: ContractorDocumentType
  file: File
  uploadedBy: string
  issuedAt?: string | null
  expiresAt?: string | null
}) {
  const ext = args.file.name.split('.').pop() ?? 'bin'
  const filename = `${Date.now()}-${sanitizeFileName(args.file.name || `document.${ext}`)}`
  const storagePath = `${args.contractorId}/${args.documentType}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.CONTRACTOR_DOCUMENTS)
    .upload(storagePath, args.file, { contentType: args.file.type || undefined })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data, error } = await supabase
    .from('contractor_documents')
    .insert({
      contractor_id: args.contractorId,
      document_type: args.documentType,
      status: 'pending_review',
      file_name: args.file.name,
      storage_path: storagePath,
      mime_type: args.file.type || null,
      size_bytes: args.file.size,
      issued_at: args.issuedAt || null,
      expires_at: args.expiresAt || null,
      uploaded_by: args.uploadedBy,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(STORAGE_BUCKETS.CONTRACTOR_DOCUMENTS).remove([storagePath])
    return { data: null, error: error.message }
  }

  return { data: data as ContractorDocument, error: null }
}

export async function reviewContractorDocument(args: {
  documentId: string
  status: Exclude<ContractorDocumentStatus, 'pending_review'>
  reviewedBy: string
  notes?: string | null
}) {
  const { data, error } = await supabase
    .from('contractor_documents')
    .update({
      status: args.status,
      reviewed_by: args.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: args.notes?.trim() || null,
    })
    .eq('id', args.documentId)
    .select()
    .single()

  return { data: data as ContractorDocument | null, error: error?.message ?? null }
}

export async function getContractorDocumentSignedUrls(storagePaths: string[], expiresIn = 3600) {
  if (storagePaths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.CONTRACTOR_DOCUMENTS)
    .createSignedUrls(storagePaths, expiresIn)
  if (error || !data) return {}
  return Object.fromEntries(
    data
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  )
}
