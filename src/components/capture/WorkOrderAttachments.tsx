// Read-only list of the files the office attached to a work order, for the
// technician's screens (plan 011 Gap D). Upload and delete stay on the admin
// pages; here the assigned technician only opens what was attached for them —
// the 073 policies scope both the rows and the bucket to exactly that.
//
// Self-contained on purpose: it fetches its own rows and signed URLs, and when
// the order has no attachments it renders nothing at all — an empty box would
// be one more thing to scroll past in the field. Opening a file needs a
// network anyway (signed URLs), so this list is not part of the offline
// snapshot: offline it simply does not appear.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  type LucideIcon,
} from 'lucide-react'
import {
  fetchWorkOrderDocuments,
  getDocumentSignedUrls,
} from '@/services/workOrderDocumentService'
import type { WorkOrderDocument } from '@/types/work-order-documents'

function iconForMime(mime: string | null): LucideIcon {
  if (!mime) return File
  if (mime.includes('pdf')) return FileText
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet
  if (mime.includes('image')) return ImageIcon
  return File
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function WorkOrderAttachments({ workOrderId }: { workOrderId: string }) {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<WorkOrderDocument[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchWorkOrderDocuments(workOrderId).then(({ data }) => {
      if (cancelled) return
      setDocs(data)
      setLoading(false)
      if (data.length > 0) {
        getDocumentSignedUrls(data.map((doc) => doc.storage_path)).then((signed) => {
          if (!cancelled) setUrls(signed)
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [workOrderId])

  // Nothing attached (or no network): no box. The section only exists when
  // there is something in it.
  if (loading || docs.length === 0) return null

  return (
    <div className="rounded-l border border-line bg-bg-1 p-4">
      <h3 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-fg-1">
        <Paperclip size={16} strokeWidth={1.5} />
        {t('fieldAttachments.title')}
      </h3>
      <p className="mt-1 text-xs text-fg-2">{t('fieldAttachments.hint')}</p>
      <ul className="mt-3 space-y-1">
        {docs.map((doc) => {
          const url = urls[doc.storage_path]
          const Icon = iconForMime(doc.mime_type)
          return (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-s border border-line bg-bg-0 px-3 py-2"
            >
              <Icon size={18} strokeWidth={1.5} className="shrink-0 text-fg-2" aria-hidden />
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
                <p className="font-mono text-[10px] text-fg-3">
                  {t(`fieldAttachments.type.${doc.document_type}`, {
                    defaultValue: doc.document_type,
                  })}
                  {' · '}
                  {formatBytes(doc.size_bytes)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
