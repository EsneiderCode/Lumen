import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock, Download, FileDown, FileText, History, ScanLine, Upload, X, XCircle } from 'lucide-react'
import {
  extractDocumentFields,
  fetchChecklist,
  fetchRequirements,
  fetchVersionHistory,
  getTemplateSignedUrl,
  getVersionSignedUrl,
  materializeChecklist,
  uploadDocument,
} from '@/services/complianceService'
import type { ComplianceEntityRecord } from '@/services/complianceService'
import {
  ACCEPTED_UPLOAD_MIME,
  billingWithholding,
  checklistProgress,
  documentTypeName,
  metadataFieldsFor,
  missingMetadataFields,
  sortChecklist,
} from '@/services/complianceHelpers'
import type {
  ChecklistItemView,
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentVersion,
  EntityDocumentStatus,
} from '@/types/compliance'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  entity: ComplianceEntityRecord
  /** Admin one-step flow: upload counts as approved immediately. */
  directApprove?: boolean
  /** Called after any change (upload) so parents can refresh aptitude chips. */
  onChanged?: () => void
}

const STATUS_STYLE: Record<EntityDocumentStatus, string> = {
  approved: 'border-ok/40 text-ok',
  expiring: 'border-warn/40 text-warn',
  in_review: 'border-info/40 text-info',
  pending: 'border-line text-fg-3',
  rejected: 'border-err/40 text-err',
  expired: 'border-err/40 text-err',
  not_applicable: 'border-line text-fg-4',
}

function StatusChip({ status }: { status: EntityDocumentStatus }) {
  const { t } = useTranslation()
  const icon =
    status === 'approved' ? <Check size={12} strokeWidth={1.5} /> :
    status === 'in_review' ? <Clock size={12} strokeWidth={1.5} /> :
    status === 'rejected' || status === 'expired' ? <XCircle size={12} strokeWidth={1.5} /> :
    null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>
      {icon}
      {t(`compliance.status.${status}`)}
    </span>
  )
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale === 'es' ? 'es-ES' : 'de-DE')
}

interface RowProps {
  view: ChecklistItemView
  directApprove: boolean
  onUploaded: () => void
}

function ChecklistRow({ view, directApprove, onUploaded }: RowProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { item, documentType, requirement, currentVersion, latestReview } = view
  const [metadata, setMetadata] = useState<DocumentMetadataInput>({
    issued_at: null,
    expires_at: null,
    amount: null,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<DocumentVersion[] | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [ocrState, setOcrState] = useState<'idle' | 'working' | 'error'>('idle')

  const fields = useMemo(() => metadataFieldsFor(documentType, requirement), [documentType, requirement])
  const inactive = item.status === 'not_applicable'
  const canUpload = !inactive
  // Slots with date/amount fields benefit from OCR pre-fill → staged two-step
  // upload; field-less slots keep the original one-click upload.
  const staged = fields.length > 0

  async function handleOcr(file: File) {
    setOcrState('working')
    setError(null)
    const { data, error: ocrError } = await extractDocumentFields(file)
    if (ocrError || !data) {
      setOcrState('error')
      return
    }
    setMetadata((prev) => ({
      issued_at: data.fields.issued_at ?? prev.issued_at,
      expires_at: data.fields.expires_at ?? prev.expires_at,
      amount: data.fields.amount ?? prev.amount,
    }))
    setOcrState('idle')
  }

  async function handleUpload(file: File | null) {
    if (!file) return
    const missing = missingMetadataFields(fields, metadata)
    if (missing.length > 0) {
      setError(t('compliance.metadataRequired', { fields: missing.map((f) => t(`compliance.fields.${f}`)).join(', ') }))
      return
    }
    setIsUploading(true)
    setError(null)
    const { error: uploadError } = await uploadDocument({
      entityDocumentId: item.id,
      file,
      metadata,
      directApprove,
    })
    setIsUploading(false)
    if (uploadError) {
      setError(
        uploadError === 'file_too_large' || uploadError === 'file_type_not_allowed'
          ? t(`compliance.errors.${uploadError}`)
          : uploadError,
      )
      return
    }
    setMetadata({ issued_at: null, expires_at: null, amount: null })
    setStagedFile(null)
    setOcrState('idle')
    onUploaded()
  }

  async function handleDownload(version: DocumentVersion) {
    if (!user) return
    const { data: url, error: urlError } = await getVersionSignedUrl(version, user.id)
    if (urlError || !url) {
      setError(urlError ?? 'no_signed_url')
      return
    }
    window.open(url, '_blank', 'noreferrer')
  }

  async function handleTemplateDownload() {
    if (!documentType.template_storage_path) return
    const { data: url, error: urlError } = await getTemplateSignedUrl(documentType.template_storage_path)
    if (urlError || !url) {
      setError(urlError ?? 'no_signed_url')
      return
    }
    window.open(url, '_blank', 'noreferrer')
  }

  async function toggleHistory() {
    if (!showHistory && history === null) {
      const { data } = await fetchVersionHistory(item.id)
      setHistory(data)
    }
    setShowHistory((value) => !value)
  }

  const rejectionInfo =
    item.status === 'rejected' && latestReview?.action === 'rejected' ? latestReview : null

  return (
    <section className={`border border-line bg-bg-0 p-3 ${inactive ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-fg-1">
            {documentTypeName(documentType, i18n.language)}
            {requirement && !requirement.is_mandatory && (
              <span className="ml-2 font-mono text-[10px] text-fg-3">{t('common.optional').toUpperCase()}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-fg-2">
            {currentVersion
              ? `${currentVersion.file_name} · v${currentVersion.version_number}`
              : t('compliance.noFile')}
            {item.approved_expires_at && ` · ${t('compliance.validUntil')}: ${formatDate(item.approved_expires_at, i18n.language)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={item.status} />
          {documentType.template_storage_path && (
            <button
              type="button"
              onClick={() => void handleTemplateDownload()}
              className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
              title={t('compliance.templateAvailable')}
            >
              <FileDown size={13} strokeWidth={1.5} />
              {t('compliance.downloadTemplate')}
            </button>
          )}
          {currentVersion && (
            <button
              type="button"
              onClick={() => void handleDownload(currentVersion)}
              className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
            >
              <FileText size={13} strokeWidth={1.5} />
              {t('common.download')}
            </button>
          )}
          {currentVersion && (
            <button
              type="button"
              onClick={() => void toggleHistory()}
              className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
              title={t('compliance.versionHistory')}
            >
              <History size={13} strokeWidth={1.5} />
              v{currentVersion.version_number}
            </button>
          )}
        </div>
      </div>

      {rejectionInfo && (
        <div className="mt-2 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">
          <p className="font-medium">
            {t('compliance.rejectedBecause')}:{' '}
            {(rejectionInfo.rejection_reasons ?? []).map((reason) => t(`compliance.rejectionReasons.${reason}`)).join(', ')}
          </p>
          {rejectionInfo.rejection_text && <p className="mt-1">{rejectionInfo.rejection_text}</p>}
        </div>
      )}

      {showHistory && history && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2">
          {history.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-2 text-xs text-fg-2">
              <span className="min-w-0 truncate">
                v{version.version_number} · {version.file_name} · {formatDate(version.uploaded_at, i18n.language)}
              </span>
              <button
                type="button"
                onClick={() => void handleDownload(version)}
                className="text-fg-2 transition-colors hover:text-accent"
                aria-label={t('common.download')}
              >
                <Download size={13} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
      )}

      {canUpload && (
        <div className="mt-3 grid gap-2 md:grid-cols-[repeat(3,1fr)_1.2fr]">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-xs text-fg-2">
                {t(`compliance.fields.${field.key}`)}
                {field.required && ' *'}
              </span>
              <input
                type={field.key === 'amount' ? 'number' : 'date'}
                min={field.key === 'amount' ? 0 : undefined}
                step={field.key === 'amount' ? '0.01' : undefined}
                value={metadata[field.key] ?? ''}
                onChange={(e) =>
                  setMetadata((prev) => ({
                    ...prev,
                    [field.key]:
                      field.key === 'amount'
                        ? e.target.value === '' ? null : Number(e.target.value)
                        : e.target.value || null,
                  }))
                }
                className="w-full rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs text-fg-2">
              <Upload size={11} strokeWidth={1.5} className="mr-1 inline" />
              {currentVersion ? t('compliance.uploadReplacement') : t('compliance.uploadFile')}
            </span>
            {!staged ? (
              <span className="flex items-center gap-2">
                <input
                  type="file"
                  accept={ACCEPTED_UPLOAD_MIME}
                  disabled={isUploading}
                  onChange={(e) => {
                    void handleUpload(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                  className="min-w-0 flex-1 text-xs text-fg-2 file:mr-2 file:rounded-s file:border file:border-line file:bg-bg-1 file:px-2 file:py-1 file:text-xs file:text-fg-1"
                />
                {isUploading && <span className="nx-loader-sm" aria-label="[LOADING]" />}
              </span>
            ) : stagedFile ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-2">{stagedFile.name}</span>
                <button
                  type="button"
                  disabled={ocrState === 'working' || isUploading}
                  onClick={() => void handleOcr(stagedFile)}
                  className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  title={t('compliance.ocr.hint')}
                >
                  <ScanLine size={13} strokeWidth={1.5} />
                  {ocrState === 'working' ? t('compliance.ocr.scanning') : t('compliance.ocr.button')}
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => void handleUpload(stagedFile)}
                  className="inline-flex items-center gap-1 rounded-s bg-accent px-2 py-1 text-xs font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isUploading ? t('common.saving') : t('compliance.uploadConfirm')}
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setStagedFile(null)
                    setOcrState('idle')
                  }}
                  className="text-fg-3 transition-colors hover:text-fg-1"
                  aria-label={t('common.cancel')}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </span>
            ) : (
              <input
                type="file"
                accept={ACCEPTED_UPLOAD_MIME}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setStagedFile(file)
                  setOcrState('idle')
                  setError(null)
                  e.target.value = ''
                }}
                className="min-w-0 flex-1 text-xs text-fg-2 file:mr-2 file:rounded-s file:border file:border-line file:bg-bg-1 file:px-2 file:py-1 file:text-xs file:text-fg-1"
              />
            )}
            {ocrState === 'error' && (
              <span className="mt-1 block text-[10px] text-warn">{t('compliance.ocr.failed')}</span>
            )}
          </label>
        </div>
      )}
    </section>
  )
}

export function ComplianceChecklist({ entity, directApprove = false, onChanged }: Props) {
  const { t } = useTranslation()
  const [views, setViews] = useState<ChecklistItemView[]>([])
  const [requirements, setRequirements] = useState<DocumentRequirement[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    let matrix = requirements
    if (!matrix) {
      const { data, error: reqError } = await fetchRequirements()
      if (reqError) {
        setError(reqError)
        setIsLoading(false)
        return
      }
      matrix = data
      setRequirements(data)
    }
    const { error: materializeError } = await materializeChecklist(entity, matrix)
    if (materializeError) setError(materializeError)
    const { data, error: listError } = await fetchChecklist(entity.id, matrix)
    if (listError) setError(listError)
    setViews(sortChecklist(data))
    setIsLoading(false)
  }, [entity, requirements])

  useEffect(() => {
    setIsLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id])

  const progress = checklistProgress(views)
  const withholding = billingWithholding(views)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="nx-loader" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-2">
          {t('compliance.progress', { done: progress.done, total: progress.total })}
        </p>
        <div className="flex items-center gap-2">
          {withholding && (
            <span
              className="rounded-full border border-warn/40 px-2 py-0.5 text-xs text-warn"
              title={t('compliance.withholding15Hint')}
            >
              {t('compliance.withholding15')}
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${
              progress.done === progress.total ? 'border-ok/40 text-ok' : 'border-warn/40 text-warn'
            }`}
          >
            {progress.done === progress.total ? t('compliance.complete') : t('compliance.incomplete')}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">{error}</div>
      )}

      {views.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">{t('compliance.emptyChecklist')}</p>
      ) : (
        views.map((view) => (
          <ChecklistRow
            key={view.item.id}
            view={view}
            directApprove={directApprove}
            onUploaded={() => {
              void load()
              onChanged?.()
            }}
          />
        ))
      )}
    </div>
  )
}
