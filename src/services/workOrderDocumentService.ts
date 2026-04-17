import { supabase } from '@/lib/supabase'
import type {
  DocumentType,
  WorkOrderDocument,
} from '@/types/work-order-documents'

const BUCKET = 'work-order-documents'

/** Sanitize a filename for safe storage-path use. */
function sanitize(name: string): string {
  return name.replace(/[^\w.\-]/g, '_').slice(0, 120)
}

/** Upload a file and insert the document row. Path: {work_order_id}/{timestamp}-{sanitized_filename} */
export async function uploadWorkOrderDocument(
  workOrderId: string,
  documentType: DocumentType,
  file: File,
  uploadedBy: string,
): Promise<{ data: WorkOrderDocument | null; error: string | null }> {
  const safeName = sanitize(file.name)
  const path = `${workOrderId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })

  if (uploadError) {
    return { data: null, error: uploadError.message }
  }

  const { data, error } = await supabase
    .from('work_order_documents')
    .insert({
      work_order_id: workOrderId,
      document_type: documentType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()

  if (error) {
    // Rollback the storage upload if the row insert failed
    await supabase.storage.from(BUCKET).remove([path])
    return { data: null, error: error.message }
  }

  return { data: data as WorkOrderDocument, error: null }
}

/** List documents attached to a work order, newest first. */
export async function fetchWorkOrderDocuments(
  workOrderId: string,
): Promise<{ data: WorkOrderDocument[]; error: string | null }> {
  const { data, error } = await supabase
    .from('work_order_documents')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('uploaded_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as WorkOrderDocument[], error: null }
}

/** Delete both the storage file and the metadata row. */
export async function deleteWorkOrderDocument(
  documentId: string,
  storagePath: string,
): Promise<{ error: string | null }> {
  const { error: dbError } = await supabase
    .from('work_order_documents')
    .delete()
    .eq('id', documentId)
  if (dbError) return { error: dbError.message }

  const { error: storageError } = await supabase
    .storage
    .from(BUCKET)
    .remove([storagePath])
  if (storageError) return { error: storageError.message }

  return { error: null }
}

/** Build short-lived signed URLs for previewing/downloading. */
export async function getDocumentSignedUrls(
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600)
  if (error || !data) return {}
  const out: Record<string, string> = {}
  for (const entry of data) {
    if (entry.signedUrl && entry.path) out[entry.path] = entry.signedUrl
  }
  return out
}
