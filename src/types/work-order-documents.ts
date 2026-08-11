/**
 * Supporting document attached to a work order — plano, cartas de
 * empalme, or other supplementary material. Backed by
 * `public.work_order_documents` (migration `work_order_documents_v1`).
 */
export type DocumentType = 'plano' | 'cartas_empalme' | 'diagrama_routing' | 'other'

export interface WorkOrderDocument {
  id: string
  work_order_id: string
  document_type: DocumentType
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string
  uploaded_at: string
}

// Every document type accepts PDF, Excel or an image (plan 011 Gap D, owner
// request): a site photo or a scanned sheet is as much order context as a
// Trassenplan. Until then only diagrama_routing took images, which forced
// admins to misfile photos or leave them out.
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
] as const

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.xlsx',
  '.xls',
  '.png',
  '.jpg',
  '.jpeg',
] as const
