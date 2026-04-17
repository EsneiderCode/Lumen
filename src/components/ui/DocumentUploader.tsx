import { useEffect, useRef, useState } from 'react'
import {
  uploadWorkOrderDocument,
  fetchWorkOrderDocuments,
  deleteWorkOrderDocument,
  getDocumentSignedUrls,
} from '@/services/workOrderDocumentService'
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  type DocumentType,
  type WorkOrderDocument,
} from '@/types/work-order-documents'

interface DocumentUploaderProps {
  workOrderId: string
  uploadedBy: string
  /** Which document bucket this uploader is for. */
  documentType: DocumentType
  /** Human-readable label shown above the uploader. */
  label: string
  /** Short helper text describing what to upload. */
  hint?: string
  /** Read-only mode — show docs but disable upload/delete. */
  readOnly?: boolean
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconForMime(mime: string | null): string {
  if (!mime) return '📄'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊'
  return '📄'
}

export function DocumentUploader({
  workOrderId,
  uploadedBy,
  documentType,
  label,
  hint,
  readOnly = false,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<WorkOrderDocument[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workOrderId) return
    let cancelled = false
    fetchWorkOrderDocuments(workOrderId).then(({ data }) => {
      if (cancelled) return
      const scoped = data.filter((d) => d.document_type === documentType)
      setDocs(scoped)
      getDocumentSignedUrls(scoped.map((d) => d.storage_path)).then((u) => {
        if (!cancelled) setUrls(u)
      })
    })
    return () => { cancelled = true }
  }, [workOrderId, documentType])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || readOnly) return
    setError(null)
    setIsUploading(true)
    for (const file of Array.from(files)) {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as typeof ALLOWED_DOCUMENT_MIME_TYPES[number])) {
        setError(`Dateityp nicht unterstützt: ${file.name}. Nur PDF oder Excel.`)
        continue
      }
      const { data, error: uploadErr } = await uploadWorkOrderDocument(
        workOrderId,
        documentType,
        file,
        uploadedBy,
      )
      if (uploadErr) {
        setError(uploadErr)
        break
      }
      if (data) {
        setDocs((prev) => [data, ...prev])
        const signed = await getDocumentSignedUrls([data.storage_path])
        setUrls((prev) => ({ ...prev, ...signed }))
      }
    }
    setIsUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(doc: WorkOrderDocument) {
    if (readOnly) return
    if (!confirm(`Dokument „${doc.file_name}" wirklich löschen?`)) return
    setDeletingId(doc.id)
    const { error: delErr } = await deleteWorkOrderDocument(doc.id, doc.storage_path)
    if (delErr) {
      setError(delErr)
    } else {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gf-text-muted">{label}</span>
        {hint && <span className="text-[10px] text-gf-text-placeholder">{hint}</span>}
      </div>

      {/* Upload drop zone */}
      {!readOnly && (
        <label
          htmlFor={`doc-input-${documentType}`}
          className="flex items-center justify-center gap-2 rounded-gf-btn border border-dashed border-gf-border bg-gf-surface px-4 py-3 text-sm text-gf-text-muted cursor-pointer hover:border-gf-primary hover:text-gf-primary transition-colors"
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
              <span>Hochladen…</span>
            </>
          ) : (
            <>
              <span>📎</span>
              <span>PDF oder Excel hochladen ({ALLOWED_DOCUMENT_EXTENSIONS.join(', ')})</span>
            </>
          )}
          <input
            ref={inputRef}
            id={`doc-input-${documentType}`}
            type="file"
            accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={isUploading}
          />
        </label>
      )}

      {error && (
        <p className="text-xs text-gf-danger">{error}</p>
      )}

      {/* List */}
      {docs.length === 0 ? (
        <p className="text-xs italic text-gf-text-placeholder">
          {readOnly ? 'Keine Dokumente' : 'Noch keine Dokumente hochgeladen'}
        </p>
      ) : (
        <ul className="space-y-1">
          {docs.map((doc) => {
            const url = urls[doc.storage_path]
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2"
              >
                <span className="text-lg" aria-hidden>{iconForMime(doc.mime_type)}</span>
                <div className="min-w-0 flex-1">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-gf-primary hover:underline"
                    >
                      {doc.file_name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium text-gf-text">
                      {doc.file_name}
                    </span>
                  )}
                  <p className="text-[10px] text-gf-text-muted">
                    {formatBytes(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleString('de-DE')}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="rounded-gf-btn border border-gf-border px-2 py-1 text-xs text-gf-text-muted hover:border-gf-danger/40 hover:text-gf-danger disabled:opacity-50 transition-colors"
                    aria-label="Löschen"
                  >
                    {deletingId === doc.id ? '…' : '🗑'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
