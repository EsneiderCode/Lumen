import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock, FileText, Upload, XCircle } from 'lucide-react'
import {
  buildContractorDocumentSlots,
  fetchContractorDocuments,
  getContractorDocumentSignedUrls,
  reviewContractorDocument,
  uploadContractorDocument,
} from '@/services/contractorDocumentService'
import type { ContractorDocument, ContractorDocumentType } from '@/types/contractor-documents'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  contractorId: string
  canReview?: boolean
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(locale === 'es' ? 'es-ES' : 'de-DE')
}

function statusClass(doc: ContractorDocument | null, isValid: boolean, isExpired: boolean) {
  if (!doc) return 'border-err/40 text-err'
  if (isExpired) return 'border-err/40 text-err'
  if (isValid) return 'border-ok/40 text-ok'
  if (doc.status === 'pending_review') return 'border-warn/40 text-warn'
  return 'border-err/40 text-err'
}

export function ContractorDocumentsPanel({ contractorId, canReview = false }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [docs, setDocs] = useState<ContractorDocument[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [workingType, setWorkingType] = useState<ContractorDocumentType | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issuedDates, setIssuedDates] = useState<Record<string, string>>({})
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const slots = useMemo(() => buildContractorDocumentSlots(docs), [docs])
  const validCount = slots.filter((slot) => slot.isValid).length
  const isCompliant = validCount === slots.length

  async function applyLoadedDocs(data: ContractorDocument[], error: string | null) {
    if (error) setError(error)
    setDocs(data)
    const paths = data.map((doc) => doc.storage_path)
    setUrls(await getContractorDocumentSignedUrls(paths))
  }

  async function load() {
    setIsLoading(true)
    const { data, error } = await fetchContractorDocuments(contractorId)
    await applyLoadedDocs(data, error)
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      const { data, error } = await fetchContractorDocuments(contractorId)
      if (cancelled) return
      await applyLoadedDocs(data, error)
      if (!cancelled) setIsLoading(false)
    }
    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [contractorId])

  async function handleUpload(type: ContractorDocumentType, file: File | null) {
    if (!file || !user) return
    setWorkingType(type)
    setError(null)
    const { error } = await uploadContractorDocument({
      contractorId,
      documentType: type,
      file,
      uploadedBy: user.id,
      issuedAt: issuedDates[type] || null,
      expiresAt: expiryDates[type] || null,
    })
    if (error) setError(error)
    else {
      setIssuedDates((prev) => ({ ...prev, [type]: '' }))
      setExpiryDates((prev) => ({ ...prev, [type]: '' }))
      await load()
    }
    setWorkingType(null)
  }

  async function handleReview(doc: ContractorDocument, status: 'approved' | 'rejected') {
    if (!user) return
    setReviewingId(doc.id)
    setError(null)
    const { error } = await reviewContractorDocument({
      documentId: doc.id,
      status,
      reviewedBy: user.id,
      notes: reviewNotes[doc.id] ?? null,
    })
    if (error) setError(error)
    else await load()
    setReviewingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  return (
    <div className="rounded-l border border-line bg-bg-1 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-fg-1">
            {t('contractorDocs.title')}
          </h3>
          <p className="mt-1 text-xs text-fg-2">
            {t('contractorDocs.subtitle', { valid: validCount, total: slots.length })}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${isCompliant ? 'border-ok/40 text-ok' : 'border-warn/40 text-warn'}`}>
          {isCompliant ? t('contractorDocs.compliant') : t('contractorDocs.incomplete')}
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {slots.map((slot) => {
          const doc = slot.latest
          const pending = doc?.status === 'pending_review'
          const url = doc ? urls[doc.storage_path] : null
          return (
            <section key={slot.type} className="border border-line bg-bg-0 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-fg-1">{t(`contractorDocs.types.${slot.type}`)}</p>
                  <p className="mt-0.5 text-xs text-fg-2">
                    {doc
                      ? `${doc.file_name} · ${t('contractorDocs.expires')}: ${formatDate(doc.expires_at, i18n.language)}`
                      : t('contractorDocs.noFile')}
                  </p>
                  {doc?.review_notes && (
                    <p className="mt-1 text-xs text-fg-2">{doc.review_notes}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusClass(doc, slot.isValid, slot.isExpired)}`}>
                    {slot.isValid ? <Check size={12} strokeWidth={1.5} /> : pending ? <Clock size={12} strokeWidth={1.5} /> : <XCircle size={12} strokeWidth={1.5} />}
                    {slot.isExpired
                      ? t('contractorDocs.expired')
                      : slot.isExpiringSoon
                        ? t('contractorDocs.expiringSoon')
                        : doc
                          ? t(`contractorDocs.status.${doc.status}`)
                          : t('contractorDocs.missing')}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                    >
                      <FileText size={13} strokeWidth={1.5} />
                      {t('common.download')}
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1.2fr]">
                <label className="block">
                  <span className="mb-1 block text-xs text-fg-2">{t('contractorDocs.issuedAt')}</span>
                  <input
                    type="date"
                    value={issuedDates[slot.type] ?? ''}
                    onChange={(e) => setIssuedDates((prev) => ({ ...prev, [slot.type]: e.target.value }))}
                    className="w-full rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-fg-2">{t('contractorDocs.expiresAt')}</span>
                  <input
                    type="date"
                    value={expiryDates[slot.type] ?? ''}
                    onChange={(e) => setExpiryDates((prev) => ({ ...prev, [slot.type]: e.target.value }))}
                    className="w-full rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-fg-2">{t('contractorDocs.uploadReplacement')}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => void handleUpload(slot.type, e.target.files?.[0] ?? null)}
                      className="min-w-0 flex-1 text-xs text-fg-2 file:mr-2 file:rounded-s file:border file:border-line file:bg-bg-1 file:px-2 file:py-1 file:text-xs file:text-fg-1"
                    />
                    {workingType === slot.type && <Upload size={15} strokeWidth={1.5} className="animate-pulse text-accent" />}
                  </span>
                </label>
              </div>

              {canReview && doc && (
                <div className="mt-3 border-t border-line pt-3">
                  <textarea
                    rows={2}
                    value={reviewNotes[doc.id] ?? ''}
                    onChange={(e) => setReviewNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                    placeholder={t('contractorDocs.reviewNotes')}
                    className="w-full rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={reviewingId === doc.id}
                      onClick={() => void handleReview(doc, 'rejected')}
                      className="rounded-s border border-err/40 px-3 py-1.5 text-xs text-err transition-colors hover:border-err"
                    >
                      {t('contractorDocs.reject')}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === doc.id}
                      onClick={() => void handleReview(doc, 'approved')}
                      className="rounded-s bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {t('contractorDocs.approve')}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
