import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Building2, Check, ChevronRight, Inbox, Plus, Settings2, UserRound, X } from 'lucide-react'
import {
  approveDocument,
  createEntity,
  fetchDocumentTypes,
  fetchEntities,
  fetchRequirements,
  fetchReviewQueue,
  getVersionSignedUrl,
  materializeChecklist,
  rejectDocument,
} from '@/services/complianceService'
import type {
  ComplianceEntityRecord,
  EntityPayload,
  ReviewQueueEntry,
} from '@/services/complianceService'
import {
  documentTypeName,
  metadataFieldsFor,
  missingMetadataFields,
} from '@/services/complianceHelpers'
import { applicableRequirements } from '@/services/complianceRequirementEngine'
import { ComplianceEntityPanel } from '@/components/compliance/ComplianceEntityPanel'
import { ComplianceReports } from '@/components/compliance/ComplianceReports'
import { ComplianceMatrixConfig } from '@/components/compliance/ComplianceMatrixConfig'
import { usePermissions } from '@/hooks/usePermissions'
import { createOperationalUser } from '@/services/userService'
import { useAuth } from '@/hooks/useAuth'
import { REJECTION_REASONS } from '@/types/compliance'
import type {
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentType,
  RejectionReason,
} from '@/types/compliance'

// ─────────────────────────────────────────────────────────────────────────────
// Review modal — file and metadata side by side
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewModalProps {
  entry: ReviewQueueEntry
  requirement: DocumentRequirement | null
  onClose: () => void
  onDone: () => void
}

function ReviewModal({ entry, requirement, onClose, onDone }: ReviewModalProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const version = entry.currentVersion
  const submitted = (version?.submitted_metadata ?? {}) as Partial<DocumentMetadataInput>
  const [approved, setApproved] = useState<DocumentMetadataInput>({
    issued_at: (submitted.issued_at as string | null) ?? null,
    expires_at: (submitted.expires_at as string | null) ?? null,
    amount: typeof submitted.amount === 'number' ? submitted.amount : null,
  })
  const [coverageConfirmed, setCoverageConfirmed] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'approve' | 'reject'>('approve')
  const [reasons, setReasons] = useState<RejectionReason[]>([])
  const [rejectionText, setRejectionText] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = useMemo(
    () => metadataFieldsFor(entry.documentType, requirement),
    [entry.documentType, requirement],
  )

  useEffect(() => {
    if (!version || !user) return
    let cancelled = false
    void getVersionSignedUrl(version, user.id).then(({ data }) => {
      if (!cancelled) setPreviewUrl(data)
    })
    return () => {
      cancelled = true
    }
  }, [version, user])

  async function handleApprove() {
    if (!user || !version) return
    const missing = missingMetadataFields(fields, approved)
    if (missing.length > 0) {
      setError(
        t('compliance.metadataRequired', {
          fields: missing.map((f) => t(`compliance.fields.${f}`)).join(', '),
        }),
      )
      return
    }
    setWorking(true)
    setError(null)
    const { error: approveError } = await approveDocument({
      itemId: entry.item.id,
      versionId: version.id,
      reviewerId: user.id,
      approved,
      coverageConfirmed,
      notify: {
        to: entry.entity.contact_email,
        entityName: entry.entity.display_name,
        docName: documentTypeName(entry.documentType, i18n.language),
        locale: i18n.language.slice(0, 2),
      },
    })
    setWorking(false)
    if (approveError) {
      setError(approveError)
      return
    }
    onDone()
  }

  async function handleReject() {
    if (!user || !version) return
    if (reasons.length === 0) {
      setError(t('compliance.review.reasonsRequired'))
      return
    }
    if (!rejectionText.trim()) {
      setError(t('compliance.review.textRequired'))
      return
    }
    setWorking(true)
    setError(null)
    const { error: rejectError } = await rejectDocument({
      itemId: entry.item.id,
      versionId: version.id,
      reviewerId: user.id,
      reasons,
      text: rejectionText,
      notify: {
        to: entry.entity.contact_email,
        entityName: entry.entity.display_name,
        docName: documentTypeName(entry.documentType, i18n.language),
        locale: i18n.language.slice(0, 2),
      },
    })
    setWorking(false)
    if (rejectError) {
      setError(rejectError)
      return
    }
    onDone()
  }

  const isImage = version?.mime_type?.startsWith('image/') ?? false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-sans text-sm font-medium text-fg-1">
              {documentTypeName(entry.documentType, i18n.language)}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-fg-3">
              {entry.entity.display_name}
              {entry.projectCode && ` · ${t('compliance.project')}: ${entry.projectCode}`}
              {version && ` · v${version.version_number} · ${version.file_name}`}
            </p>
          </div>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden md:grid-cols-[1.4fr_1fr]">
          {/* File preview */}
          <div className="min-h-[300px] overflow-auto border-b border-line bg-bg-0 md:border-b-0 md:border-r">
            {previewUrl ? (
              isImage ? (
                <img src={previewUrl} alt={version?.file_name ?? ''} className="max-w-full" />
              ) : (
                <iframe src={previewUrl} title={version?.file_name ?? 'document'} className="h-full min-h-[420px] w-full" />
              )
            ) : (
              <div className="flex h-full items-center justify-center py-16">
                <div className="nx-loader" />
              </div>
            )}
          </div>

          {/* Metadata + decision */}
          <div className="overflow-auto p-4">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('approve')}
                className={`flex-1 rounded-s border px-3 py-2 text-sm transition-colors ${
                  mode === 'approve' ? 'border-ok/50 bg-ok/10 text-ok' : 'border-line text-fg-2 hover:text-fg-1'
                }`}
              >
                <Check size={13} strokeWidth={1.5} className="mr-1 inline" />
                {t('compliance.review.approve')}
              </button>
              <button
                type="button"
                onClick={() => setMode('reject')}
                className={`flex-1 rounded-s border px-3 py-2 text-sm transition-colors ${
                  mode === 'reject' ? 'border-err/50 bg-err/10 text-err' : 'border-line text-fg-2 hover:text-fg-1'
                }`}
              >
                <X size={13} strokeWidth={1.5} className="mr-1 inline" />
                {t('compliance.review.reject')}
              </button>
            </div>

            {error && (
              <p className="mb-3 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
            )}

            {mode === 'approve' ? (
              <div className="space-y-3">
                <p className="text-xs text-fg-2">{t('compliance.review.approveHint')}</p>
                {fields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-xs text-fg-2">
                      {t(`compliance.fields.${field.key}`)}
                      {field.required && ' *'}
                      {submitted[field.key] != null && (
                        <span className="ml-2 font-mono text-[10px] text-fg-3">
                          {t('compliance.review.declared')}: {String(submitted[field.key])}
                        </span>
                      )}
                    </span>
                    <input
                      type={field.key === 'amount' ? 'number' : 'date'}
                      min={field.key === 'amount' ? 0 : undefined}
                      step={field.key === 'amount' ? '0.01' : undefined}
                      value={approved[field.key] ?? ''}
                      onChange={(e) =>
                        setApproved((prev) => ({
                          ...prev,
                          [field.key]:
                            field.key === 'amount'
                              ? e.target.value === '' ? null : Number(e.target.value)
                              : e.target.value || null,
                        }))
                      }
                      className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
                    />
                  </label>
                ))}
                {requirement?.requires_coverage_confirmation && (
                  <label className="flex items-center gap-2 text-sm text-fg-2">
                    <input
                      type="checkbox"
                      checked={coverageConfirmed}
                      onChange={(e) => setCoverageConfirmed(e.target.checked)}
                      className="accent-accent"
                    />
                    {t('compliance.review.coverageConfirmed')}
                  </label>
                )}
                {requirement?.min_amount != null && (
                  <p className="font-mono text-xs text-fg-3">
                    {t('compliance.review.minAmount')}: {requirement.min_amount.toLocaleString()} €
                  </p>
                )}
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void handleApprove()}
                  className="w-full rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {working ? t('common.saving') : t('compliance.review.approveConfirm')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-fg-2">{t('compliance.review.rejectHint')}</p>
                <div className="space-y-1">
                  {REJECTION_REASONS.map((reason) => (
                    <label key={reason} className="flex items-center gap-2 text-sm text-fg-2">
                      <input
                        type="checkbox"
                        checked={reasons.includes(reason)}
                        onChange={(e) =>
                          setReasons((prev) =>
                            e.target.checked ? [...prev, reason] : prev.filter((r) => r !== reason),
                          )
                        }
                        className="accent-accent"
                      />
                      {t(`compliance.rejectionReasons.${reason}`)}
                    </label>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={rejectionText}
                  onChange={(e) => setRejectionText(e.target.value)}
                  placeholder={t('compliance.review.textPlaceholder')}
                  className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void handleReject()}
                  className="w-full rounded-s border border-err/50 bg-err/10 px-4 py-2 text-sm font-semibold text-err transition-colors hover:border-err disabled:opacity-50"
                >
                  {working ? t('common.saving') : t('compliance.review.rejectConfirm')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding wizard — country → conditions → checklist preview
// ─────────────────────────────────────────────────────────────────────────────

interface WizardProps {
  requirements: DocumentRequirement[]
  documentTypes: DocumentType[]
  onClose: () => void
  onCreated: (entity: ComplianceEntityRecord) => void
}

function OnboardingWizard({ requirements, documentTypes, onClose, onCreated }: WizardProps) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<'company' | 'freelancer'>('company')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('ES')
  const [nationality, setNationality] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [hiresWorkers, setHiresWorkers] = useState(false)
  const [regulatedTrade, setRegulatedTrade] = useState(false)
  const [shortStay, setShortStay] = useState(false)
  const [createAccount, setCreateAccount] = useState(false)
  const [accountPassword, setAccountPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeById = useMemo(
    () => new Map(documentTypes.map((docType) => [docType.id, docType])),
    [documentTypes],
  )

  const draftEntity = useMemo(
    () => ({
      kind,
      country_code: country,
      attributes: {
        ...(kind === 'company' && hiresWorkers ? { hires_workers: true } : {}),
        ...(regulatedTrade ? { regulated_trade: true } : {}),
        ...(kind === 'freelancer' && shortStay ? { short_stay: true } : {}),
      },
    }),
    [kind, country, hiresWorkers, regulatedTrade, shortStay],
  )

  const preview = useMemo(
    () => applicableRequirements(requirements, draftEntity),
    [requirements, draftEntity],
  )

  function validateStep1(): boolean {
    if (!name.trim()) {
      setError(t('compliance.wizard.nameRequired'))
      return false
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      setError(t('compliance.wizard.countryRequired'))
      return false
    }
    setError(null)
    return true
  }

  async function handleCreate() {
    setWorking(true)
    setError(null)

    let profileId: string | null = null
    if (createAccount) {
      if (!contactEmail.trim() || !accountPassword) {
        setError(t('compliance.wizard.accountFieldsRequired'))
        setWorking(false)
        return
      }
      const { data: users, error: userError } = await createOperationalUser({
        email: contactEmail.trim(),
        fullName: name.trim(),
        password: accountPassword,
        role: 'contractor',
      })
      if (userError) {
        setError(userError)
        setWorking(false)
        return
      }
      profileId = users.find((u) => u.email === contactEmail.trim())?.id ?? null
    }

    const payload: EntityPayload = {
      kind,
      display_name: name,
      country_code: country,
      nationality_country: kind === 'freelancer' ? nationality || null : null,
      profile_id: profileId,
      attributes: draftEntity.attributes,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      address: address || null,
    }
    const { data: entity, error: createError } = await createEntity(payload)
    if (createError || !entity) {
      setError(createError ?? 'create_failed')
      setWorking(false)
      return
    }
    const { error: materializeError } = await materializeChecklist(entity, requirements)
    setWorking(false)
    if (materializeError) {
      setError(materializeError)
      return
    }
    onCreated(entity)
  }

  const inputClass =
    'w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 placeholder-fg-3 focus:border-accent focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">
            {t('compliance.wizard.title')} · {t('compliance.wizard.step', { step, total: 3 })}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}

          {step === 1 && (
            <>
              <div className="flex gap-2">
                {(['company', 'freelancer'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    className={`flex-1 rounded-s border px-3 py-2 text-sm transition-colors ${
                      kind === option ? 'border-accent bg-accent/10 text-accent' : 'border-line text-fg-2 hover:text-fg-1'
                    }`}
                  >
                    {option === 'company' ? <Building2 size={13} strokeWidth={1.5} className="mr-1 inline" /> : <UserRound size={13} strokeWidth={1.5} className="mr-1 inline" />}
                    {t(`compliance.kinds.${option}`)}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.wizard.name').toUpperCase()} *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.country').toUpperCase()} *</label>
                  <input type="text" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="ES" className={inputClass} />
                </div>
                {kind === 'freelancer' && (
                  <div>
                    <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.nationality').toUpperCase()}</label>
                    <input type="text" maxLength={2} value={nationality} onChange={(e) => setNationality(e.target.value.toUpperCase())} placeholder="ES" className={inputClass} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-xs text-fg-2">E-MAIL</label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.wizard.phone').toUpperCase()}</label>
                  <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.wizard.address').toUpperCase()}</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-fg-2">{t('compliance.wizard.conditionsHint')}</p>
              {kind === 'company' && (
                <label className="flex items-center gap-2 text-sm text-fg-2">
                  <input type="checkbox" checked={hiresWorkers} onChange={(e) => setHiresWorkers(e.target.checked)} className="accent-accent" />
                  {t('compliance.conditions.hires_workers')}
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-fg-2">
                <input type="checkbox" checked={regulatedTrade} onChange={(e) => setRegulatedTrade(e.target.checked)} className="accent-accent" />
                {t('compliance.conditions.regulated_trade')}
              </label>
              {kind === 'freelancer' && (
                <label className="flex items-center gap-2 text-sm text-fg-2">
                  <input type="checkbox" checked={shortStay} onChange={(e) => setShortStay(e.target.checked)} className="accent-accent" />
                  {t('compliance.conditions.short_stay')}
                </label>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-fg-2">
                {t('compliance.wizard.previewHint', { count: preview.length })}
              </p>
              <ul className="max-h-56 space-y-1 overflow-y-auto border border-line bg-bg-0 p-3">
                {preview.map((req) => {
                  const docType = typeById.get(req.document_type_id)
                  return (
                    <li key={req.id} className="flex items-center justify-between gap-2 text-xs text-fg-2">
                      <span className="min-w-0 truncate">
                        {docType ? documentTypeName(docType, i18n.language) : req.document_type_code}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-fg-3">
                        {req.scope === 'per_project' ? t('compliance.perProject') : ''}
                        {!req.is_mandatory ? ` ${t('common.optional')}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <label className="flex items-center gap-2 text-sm text-fg-2">
                <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="accent-accent" />
                {t('compliance.wizard.createAccount')}
              </label>
              {createAccount && (
                <div>
                  <p className="mb-2 text-xs text-fg-3">{t('compliance.wizard.accountHint', { email: contactEmail || '—' })}</p>
                  <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.wizard.tempPassword').toUpperCase()} *</label>
                  <input type="text" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} className={inputClass} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
            >
              {step === 1 ? t('common.cancel') : t('common.back')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !validateStep1()) return
                  setStep(step + 1)
                }}
                className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90"
              >
                {t('common.next')}
              </button>
            ) : (
              <button
                type="button"
                disabled={working}
                onClick={() => void handleCreate()}
                className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {working ? t('common.saving') : t('compliance.wizard.create')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function CompliancePage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canConfigureMatrix = can('compliance.configure_matrix')
  const [activeTab, setActiveTab] = useState<'inbox' | 'entities' | 'reports' | 'matrix'>('inbox')
  const [queue, setQueue] = useState<ReviewQueueEntry[]>([])
  const [entities, setEntities] = useState<ComplianceEntityRecord[]>([])
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [reviewEntry, setReviewEntry] = useState<ReviewQueueEntry | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const [queueResult, entitiesResult, requirementsResult, typesResult] = await Promise.all([
      fetchReviewQueue(),
      fetchEntities({ includeInactive: true }),
      fetchRequirements(),
      fetchDocumentTypes(),
    ])
    const firstError =
      queueResult.error ?? entitiesResult.error ?? requirementsResult.error ?? typesResult.error
    if (firstError) setError(firstError)
    setQueue(queueResult.data)
    setEntities(entitiesResult.data.filter((entity) => entity.kind === 'company' || entity.kind === 'freelancer'))
    setRequirements(requirementsResult.data)
    setDocumentTypes(typesResult.data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const requirementById = useMemo(
    () => new Map(requirements.map((req) => [req.id, req])),
    [requirements],
  )
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null

  const tabClass = (tab: 'inbox' | 'entities' | 'reports' | 'matrix') =>
    activeTab === tab
      ? 'rounded-s border border-accent bg-accent/10 px-3 py-2 font-sans text-sm text-accent transition-colors'
      : 'rounded-s border border-line px-3 py-2 font-sans text-sm text-fg-2 transition-colors hover:text-fg-1'

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-fg-1">{t('compliance.pageTitle')}</h1>
          <p className="mt-0.5 font-sans text-xs text-fg-2">{t('compliance.pageSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 font-sans text-sm text-fg-1 transition-opacity hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2} />
          {t('compliance.wizard.title')}
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveTab('inbox')} className={tabClass('inbox')}>
          <Inbox size={13} strokeWidth={1.5} className="mr-1 inline" />
          {t('compliance.tabs.inbox')}
          {queue.length > 0 && (
            <span className="ml-2 rounded-full border border-warn/40 px-1.5 font-mono text-[10px] text-warn">
              {queue.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setActiveTab('entities')} className={tabClass('entities')}>
          {t('compliance.tabs.entities')}
        </button>
        <button type="button" onClick={() => setActiveTab('reports')} className={tabClass('reports')}>
          <BarChart3 size={13} strokeWidth={1.5} className="mr-1 inline" />
          {t('compliance.tabs.reports')}
        </button>
        {canConfigureMatrix && (
          <button type="button" onClick={() => setActiveTab('matrix')} className={tabClass('matrix')}>
            <Settings2 size={13} strokeWidth={1.5} className="mr-1 inline" />
            {t('compliance.tabs.matrix')}
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-l border border-err/30 bg-err/10 px-4 py-3 font-sans text-sm text-err">{error}</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="nx-loader" />
        </div>
      ) : activeTab === 'inbox' ? (
        <div className="rounded-l border border-line">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Inbox size={32} strokeWidth={1} className="text-fg-2" />
              <p className="font-sans text-sm text-fg-2">{t('compliance.review.emptyQueue')}</p>
            </div>
          ) : (
            <ul>
              {queue.map((entry) => (
                <li key={entry.item.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setReviewEntry(entry)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-2/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-sm text-fg-1">
                        {documentTypeName(entry.documentType, i18n.language)}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-fg-3">
                        {entry.entity.display_name}
                        {entry.projectCode && ` · ${entry.projectCode}`}
                        {entry.currentVersion && ` · v${entry.currentVersion.version_number}`}
                      </p>
                    </div>
                    <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-fg-2" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : activeTab === 'reports' ? (
        <ComplianceReports />
      ) : activeTab === 'matrix' ? (
        canConfigureMatrix ? <ComplianceMatrixConfig /> : null
      ) : (
        <div className="space-y-4">
          <div className="rounded-l border border-line">
            {entities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Building2 size={32} strokeWidth={1} className="text-fg-2" />
                <p className="font-sans text-sm text-fg-2">{t('compliance.entitiesEmpty')}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 text-left font-mono text-xs text-fg-3">{t('compliance.entityColumn').toUpperCase()}</th>
                    <th className="px-4 py-3 text-left font-mono text-xs text-fg-3">{t('compliance.kindColumn').toUpperCase()}</th>
                    <th className="px-4 py-3 text-left font-mono text-xs text-fg-3">{t('compliance.entity.country').toUpperCase()}</th>
                    <th className="px-4 py-3 text-left font-mono text-xs text-fg-3">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity) => (
                    <tr
                      key={entity.id}
                      onClick={() => setSelectedEntityId(entity.id === selectedEntityId ? null : entity.id)}
                      className={`cursor-pointer border-b border-line transition-colors hover:bg-bg-2/40 ${
                        entity.id === selectedEntityId ? 'bg-bg-2/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-sans text-sm text-fg-1">{entity.display_name}</td>
                      <td className="px-4 py-3 font-sans text-xs text-fg-2">{t(`compliance.kinds.${entity.kind}`)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-fg-2">{entity.country_code}</td>
                      <td className="px-4 py-3">
                        {entity.is_active ? (
                          <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 font-mono text-xs uppercase text-ok">{t('compliance.entity.active')}</span>
                        ) : (
                          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs uppercase text-fg-2">{t('compliance.entity.inactive')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedEntity && (
            <ComplianceEntityPanel
              entity={selectedEntity}
              directApprove
              riskAssessment
              allowErasure={canConfigureMatrix}
              allowEdit={canConfigureMatrix}
              onChanged={() => void load()}
            />
          )}
        </div>
      )}

      {reviewEntry && (
        <ReviewModal
          entry={reviewEntry}
          requirement={
            reviewEntry.item.requirement_id
              ? (requirementById.get(reviewEntry.item.requirement_id) ?? null)
              : null
          }
          onClose={() => setReviewEntry(null)}
          onDone={() => {
            setReviewEntry(null)
            void load()
          }}
        />
      )}

      {showWizard && (
        <OnboardingWizard
          requirements={requirements}
          documentTypes={documentTypes}
          onClose={() => setShowWizard(false)}
          onCreated={(entity) => {
            setShowWizard(false)
            setActiveTab('entities')
            setSelectedEntityId(entity.id)
            void load()
          }}
        />
      )}
    </div>
  )
}
