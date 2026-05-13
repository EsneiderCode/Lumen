import { useEffect, useRef, useState } from 'react'
import {
  Paperclip,
  X,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  uploadWorkOrderDocument,
  fetchWorkOrderDocuments,
  deleteWorkOrderDocument,
  getDocumentSignedUrls,
} from '@/services/workOrderDocumentService'
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DIAGRAM_EXTENSIONS,
  ALLOWED_DIAGRAM_MIME_TYPES,
  type DocumentType,
  type WorkOrderDocument,
} from '@/types/work-order-documents'

/** Diagrams accept images too (rack layouts are often PNG/JPG). */
function allowedMimesFor(type: DocumentType): readonly string[] {
  return type === 'diagrama_routing' ? ALLOWED_DIAGRAM_MIME_TYPES : ALLOWED_DOCUMENT_MIME_TYPES
}
function allowedExtensionsFor(type: DocumentType): readonly string[] {
  return type === 'diagrama_routing' ? ALLOWED_DIAGRAM_EXTENSIONS : ALLOWED_DOCUMENT_EXTENSIONS
}

/**
 * Two modes:
 * - **Immediate** (workOrderId provided): uploads straight to Supabase
 *   storage + inserts the row. Used on edit / detail pages where the
 *   order already exists.
 * - **Staged** (no workOrderId; stagedFiles + onStagedFilesChange
 *   provided): holds File objects in the parent's state without touching
 *   Supabase. The parent uploads after it saves the order (flow: save
 *   order -> get id -> loop staged files through uploadWorkOrderDocument).
 */
interface BaseProps {
  documentType: DocumentType
  label: string
  hint?: string
  readOnly?: boolean
}

interface ImmediateProps extends BaseProps {
  workOrderId: string
  uploadedBy: string
  stagedFiles?: never
  onStagedFilesChange?: never
}

interface StagedProps extends BaseProps {
  workOrderId?: never
  uploadedBy?: never
  stagedFiles: File[]
  onStagedFilesChange: (files: File[]) => void
}

export type DocumentUploaderProps = ImmediateProps | StagedProps

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconForMime(mime: string | null): LucideIcon {
  if (!mime) return File
  if (mime.includes('pdf')) return FileText
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet
  if (mime.includes('image')) return ImageIcon
  return File
}

export function DocumentUploader(props: DocumentUploaderProps) {
  const { documentType, label, hint, readOnly = false } = props
  const isStaged = 'stagedFiles' in props && props.stagedFiles !== undefined
  const inputRef = useRef<HTMLInputElement>(null)

  // Immediate-mode state (server-backed)
  const [docs, setDocs] = useState<WorkOrderDocument[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load existing docs only in immediate mode
  useEffect(() => {
    if (isStaged || readOnly) return
    const workOrderId = (props as ImmediateProps).workOrderId
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
  }, [isStaged, readOnly, documentType, props])

  const allowedMimes = allowedMimesFor(documentType)
  const allowedExtensions = allowedExtensionsFor(documentType)

  function validateFile(file: File): string | null {
    if (!allowedMimes.includes(file.type)) {
      return `Dateityp nicht unterstützt: ${file.name}. Erlaubt: ${allowedExtensions.join(', ')}.`
    }
    return null
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || readOnly) return
    setError(null)

    // ── Staged mode — just push to parent state, no network ──
    if (isStaged) {
      const stagedProps = props as StagedProps
      const incoming = Array.from(files)
      for (const file of incoming) {
        const err = validateFile(file)
        if (err) { setError(err); return }
      }
      stagedProps.onStagedFilesChange([...stagedProps.stagedFiles, ...incoming])
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    // ── Immediate mode — upload to storage + insert row ──
    const immediateProps = props as ImmediateProps
    setIsUploading(true)
    for (const file of Array.from(files)) {
      const err = validateFile(file)
      if (err) { setError(err); continue }
      const { data, error: uploadErr } = await uploadWorkOrderDocument(
        immediateProps.workOrderId,
        documentType,
        file,
        immediateProps.uploadedBy,
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

  async function handleDeleteImmediate(doc: WorkOrderDocument) {
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

  function handleRemoveStaged(index: number) {
    if (!isStaged || readOnly) return
    const stagedProps = props as StagedProps
    stagedProps.onStagedFilesChange(stagedProps.stagedFiles.filter((_, i) => i !== index))
  }

  const stagedFiles = isStaged ? (props as StagedProps).stagedFiles : []

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        {hint && <span className="text-[10px] text-fg-4">{hint}</span>}
      </div>

      {/* Upload drop zone */}
      {!readOnly && (
        <label
          htmlFor={`doc-input-${documentType}`}
          className="flex items-center justify-center gap-2 rounded-s border border-dashed border-line bg-bg-0 px-4 py-3 text-sm text-fg-2 cursor-pointer hover:border-accent hover:text-accent transition-colors"
        >
          {isUploading ? (
            <>
              <div className="nx-loader-sm" />
              <span>Hochladen…</span>
            </>
          ) : (
            <>
              <Paperclip size={16} strokeWidth={1.5} />
              <span>
                {isStaged
                  ? `Dokument auswählen (${allowedExtensions.join(', ')})`
                  : `Hochladen (${allowedExtensions.join(', ')})`}
              </span>
            </>
          )}
          <input
            ref={inputRef}
            id={`doc-input-${documentType}`}
            type="file"
            accept={allowedExtensions.join(',')}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={isUploading}
          />
        </label>
      )}

      {error && <p className="text-xs text-err">{error}</p>}

      {isStaged ? (
        /* Staged list */
        stagedFiles.length === 0 ? (
          <p className="text-xs italic text-fg-4">
            Noch keine Dateien ausgewählt
          </p>
        ) : (
          <ul className="space-y-1">
            {stagedFiles.map((file, idx) => {
              const Icon = iconForMime(file.type)
              return (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-3 rounded-s border border-dashed border-accent/30 bg-accent/5 px-3 py-2"
                >
                  <Icon size={18} strokeWidth={1.5} className="text-fg-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg-1">
                      {file.name}
                    </span>
                    <p className="text-[10px] text-fg-2">
                      {formatBytes(file.size)} · wird beim Speichern hochgeladen
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStaged(idx)}
                      className="flex h-7 w-7 items-center justify-center rounded-s border border-line text-fg-2 hover:border-err/40 hover:text-err transition-colors"
                      aria-label="Entfernen"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )
      ) : docs.length === 0 ? (
        <p className="text-xs italic text-fg-4">
          {readOnly ? 'Keine Dokumente' : 'Noch keine Dokumente hochgeladen'}
        </p>
      ) : (
        <ul className="space-y-1">
          {docs.map((doc) => {
            const url = urls[doc.storage_path]
            const Icon = iconForMime(doc.mime_type)
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-s border border-line bg-bg-0 px-3 py-2"
              >
                <Icon size={18} strokeWidth={1.5} className="text-fg-2" aria-hidden />
                <div className="min-w-0 flex-1">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-accent hover:underline"
                    >
                      {doc.file_name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium text-fg-1">
                      {doc.file_name}
                    </span>
                  )}
                  <p className="text-[10px] text-fg-2">
                    {formatBytes(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleString('de-DE')}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteImmediate(doc)}
                    disabled={deletingId === doc.id}
                    className="flex h-7 w-7 items-center justify-center rounded-s border border-line text-fg-2 hover:border-err/40 hover:text-err disabled:opacity-50 transition-colors"
                    aria-label="Löschen"
                  >
                    {deletingId === doc.id ? '…' : <Trash2 size={14} strokeWidth={1.5} />}
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
