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

// plano + cartas_empalme: PDF + Excel only
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.xlsx', '.xls'] as const

// diagrama_routing accepts images too (rack diagrams are often PNG/JPG)
export const ALLOWED_DIAGRAM_MIME_TYPES = [
  ...ALLOWED_DOCUMENT_MIME_TYPES,
  'image/png',
  'image/jpeg',
] as const

export const ALLOWED_DIAGRAM_EXTENSIONS = [
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
] as const
