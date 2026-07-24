import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, Trash2, Upload } from 'lucide-react'
import {
  createDocumentType,
  createRequirement,
  fetchDocumentTypes,
  fetchRequirements,
  getTemplateSignedUrl,
  removeTemplate,
  updateDocumentType,
  updateRequirement,
  uploadTemplate,
} from '@/services/complianceService'
import type { DocumentTypePayload, RequirementPayload } from '@/services/complianceService'
import { documentTypeName } from '@/services/complianceHelpers'
import type {
  ComplianceEntityKind,
  DocumentRequirement,
  DocumentType,
  DocumentValidityRule,
  EntityAttributes,
  RequirementOrigin,
  RequirementScope,
} from '@/types/compliance'

const KINDS: ComplianceEntityKind[] = ['company', 'company_worker', 'freelancer', 'internal_employee']
const ORIGINS: RequirementOrigin[] = ['ALL', 'DE', 'ES', 'EU_OTHER', 'NON_EU']
const SCOPES: RequirementScope[] = ['entity', 'per_project']
const VALIDITY_RULES: DocumentValidityRule[] = [
  'no_expiry',
  'expiry_required',
  'days_from_issue',
  'must_cover_assignment',
]
const CONDITION_FLAGS = ['hires_workers', 'regulated_trade', 'short_stay', 'non_eu_national'] as const
const MISSING_ACTIONS = ['none', 'notify_billing_withholding'] as const

const inputClass =
  'w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 placeholder-fg-3 focus:border-accent focus:outline-none'
const labelClass = 'mb-1 block font-mono text-xs text-fg-2'

// ─────────────────────────────────────────────────────────────────────────────
// Document type modal
// ─────────────────────────────────────────────────────────────────────────────

function TypeModal({
  docType,
  onClose,
  onSaved,
}: {
  docType: DocumentType | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const isEdit = docType !== null
  const [code, setCode] = useState(docType?.code ?? '')
  const [nameEs, setNameEs] = useState(docType?.name_i18n?.es ?? '')
  const [nameDe, setNameDe] = useState(docType?.name_i18n?.de ?? '')
  const [nameEn, setNameEn] = useState(docType?.name_i18n?.en ?? '')
  const [descEs, setDescEs] = useState(docType?.description_i18n?.es ?? '')
  const [descDe, setDescDe] = useState(docType?.description_i18n?.de ?? '')
  const [isActive, setIsActive] = useState(docType?.is_active ?? true)
  const [templatePath, setTemplatePath] = useState<string | null>(docType?.template_storage_path ?? null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTemplateUpload(file: File | null) {
    if (!file || !docType) return
    setTemplateBusy(true)
    setTemplateError(null)
    const { data, error: upError } = await uploadTemplate(
      { id: docType.id, code: docType.code, template_storage_path: templatePath },
      file,
    )
    setTemplateBusy(false)
    if (upError) {
      setTemplateError(
        upError === 'file_too_large' || upError === 'file_type_not_allowed'
          ? t(`compliance.errors.${upError}`)
          : upError,
      )
      return
    }
    setTemplatePath(data)
  }

  async function handleTemplateDownload() {
    if (!templatePath) return
    const { data: url } = await getTemplateSignedUrl(templatePath)
    if (url) window.open(url, '_blank', 'noreferrer')
  }

  async function handleTemplateRemove() {
    if (!docType) return
    setTemplateBusy(true)
    const { error: rmError } = await removeTemplate({ id: docType.id, template_storage_path: templatePath })
    setTemplateBusy(false)
    if (rmError) {
      setTemplateError(rmError)
      return
    }
    setTemplatePath(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEdit && !/^[a-z0-9_]+$/.test(code.trim())) {
      setError(t('compliance.matrix.codeInvalid'))
      return
    }
    if (!nameDe.trim() || !nameEs.trim()) {
      setError(t('compliance.matrix.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const payload: DocumentTypePayload = {
      code: code.trim(),
      name_i18n: { es: nameEs.trim(), de: nameDe.trim(), ...(nameEn.trim() ? { en: nameEn.trim() } : {}) },
      description_i18n:
        descEs.trim() || descDe.trim() ? { es: descEs.trim(), de: descDe.trim() } : null,
      is_active: isActive,
    }
    const { error: saveError } = isEdit
      ? await updateDocumentType(docType.id, payload)
      : await createDocumentType(payload)
    setSaving(false)
    if (saveError) {
      setError(saveError)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">
            {isEdit ? t('compliance.matrix.editType') : t('compliance.matrix.newType')}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>}
          <div>
            <label className={labelClass}>{t('compliance.matrix.code').toUpperCase()} *</label>
            <input
              type="text"
              value={code}
              disabled={isEdit}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              placeholder="gewerbeanmeldung"
              className={`${inputClass} font-mono disabled:opacity-50`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('compliance.matrix.nameDe').toUpperCase()} *</label>
              <input type="text" value={nameDe} onChange={(e) => setNameDe(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('compliance.matrix.nameEs').toUpperCase()} *</label>
              <input type="text" value={nameEs} onChange={(e) => setNameEs(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('compliance.matrix.nameEn').toUpperCase()}</label>
            <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('compliance.matrix.descDe').toUpperCase()}</label>
              <textarea rows={2} value={descDe} onChange={(e) => setDescDe(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('compliance.matrix.descEs').toUpperCase()}</label>
              <textarea rows={2} value={descEs} onChange={(e) => setDescEs(e.target.value)} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-accent" />
            {t('compliance.matrix.active')}
          </label>

          {isEdit && (
            <div className="rounded-s border border-line bg-bg-0 p-3">
              <p className={labelClass}>{t('compliance.matrix.template').toUpperCase()}</p>
              <p className="mb-2 text-xs text-fg-3">{t('compliance.matrix.templateHint')}</p>
              {templateError && (
                <p className="mb-2 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{templateError}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {templatePath && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleTemplateDownload()}
                      className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                    >
                      <FileText size={13} strokeWidth={1.5} />
                      {t('compliance.matrix.templateDownload')}
                    </button>
                    <button
                      type="button"
                      disabled={templateBusy}
                      onClick={() => void handleTemplateRemove()}
                      className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-err hover:text-err disabled:opacity-50"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      {t('compliance.matrix.templateRemove')}
                    </button>
                  </>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent">
                  <Upload size={13} strokeWidth={1.5} />
                  {templatePath ? t('compliance.matrix.templateReplace') : t('compliance.matrix.templateUpload')}
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={templateBusy}
                    onChange={(e) => {
                      void handleTemplateUpload(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                </label>
                {templateBusy && <span className="nx-loader-sm" aria-label="[LOADING]" />}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement modal
// ─────────────────────────────────────────────────────────────────────────────

function RequirementModal({
  requirement,
  documentTypes,
  onClose,
  onSaved,
}: {
  requirement: DocumentRequirement | null
  documentTypes: DocumentType[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const isEdit = requirement !== null
  const [documentTypeId, setDocumentTypeId] = useState(requirement?.document_type_id ?? documentTypes[0]?.id ?? '')
  const [appliesTo, setAppliesTo] = useState<ComplianceEntityKind>(requirement?.applies_to ?? 'company')
  const [origin, setOrigin] = useState<RequirementOrigin>(requirement?.origin ?? 'ALL')
  const [scope, setScope] = useState<RequirementScope>(requirement?.scope ?? 'entity')
  const [isMandatory, setIsMandatory] = useState(requirement?.is_mandatory ?? true)
  const [validityRule, setValidityRule] = useState<DocumentValidityRule>(requirement?.validity_rule ?? 'no_expiry')
  const [validityDays, setValidityDays] = useState<string>(requirement?.validity_days != null ? String(requirement.validity_days) : '')
  const [minAmount, setMinAmount] = useState<string>(requirement?.min_amount != null ? String(requirement.min_amount) : '')
  const [coverage, setCoverage] = useState(requirement?.requires_coverage_confirmation ?? false)
  const [notifyDays, setNotifyDays] = useState<string>((requirement?.notify_days ?? [30]).join(', '))
  const [conditions, setConditions] = useState<EntityAttributes>(requirement?.conditions ?? {})
  const [missingAction, setMissingAction] = useState<string>(requirement?.on_missing_action ?? 'none')
  const [isActive, setIsActive] = useState(requirement?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectClass = inputClass

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!documentTypeId) {
      setError(t('compliance.matrix.docTypeRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const parsedNotify = notifyDays
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    const payload: RequirementPayload = {
      document_type_id: documentTypeId,
      applies_to: appliesTo,
      origin,
      scope,
      is_mandatory: isMandatory,
      conditions,
      validity_rule: validityRule,
      validity_days: validityRule === 'days_from_issue' && validityDays ? Number(validityDays) : null,
      min_amount: minAmount ? Number(minAmount) : null,
      requires_coverage_confirmation: coverage,
      notify_days: parsedNotify.length ? parsedNotify : [30],
      on_missing_action: missingAction === 'none' ? null : missingAction,
      is_active: isActive,
    }
    const { error: saveError } = isEdit
      ? await updateRequirement(requirement.id, payload)
      : await createRequirement(payload)
    setSaving(false)
    if (saveError) {
      setError(saveError)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">
            {isEdit ? t('compliance.matrix.editRequirement') : t('compliance.matrix.newRequirement')}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>}

          <div>
            <label className={labelClass}>{t('compliance.matrix.documentType').toUpperCase()} *</label>
            <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className={selectClass}>
              {documentTypes.map((docType) => (
                <option key={docType.id} value={docType.id}>
                  {documentTypeName(docType, i18n.language)} ({docType.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>{t('compliance.matrix.appliesTo').toUpperCase()}</label>
              <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as ComplianceEntityKind)} className={selectClass}>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>{t(`compliance.kinds.${kind}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('compliance.matrix.origin').toUpperCase()}</label>
              <select value={origin} onChange={(e) => setOrigin(e.target.value as RequirementOrigin)} className={selectClass}>
                {ORIGINS.map((o) => (
                  <option key={o} value={o}>{t(`compliance.matrix.origins.${o}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('compliance.matrix.scope').toUpperCase()}</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as RequirementScope)} className={selectClass}>
                {SCOPES.map((sc) => (
                  <option key={sc} value={sc}>{t(`compliance.matrix.scopes.${sc}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>{t('compliance.matrix.validityRule').toUpperCase()}</label>
              <select value={validityRule} onChange={(e) => setValidityRule(e.target.value as DocumentValidityRule)} className={selectClass}>
                {VALIDITY_RULES.map((rule) => (
                  <option key={rule} value={rule}>{t(`compliance.matrix.validityRules.${rule}`)}</option>
                ))}
              </select>
            </div>
            {validityRule === 'days_from_issue' && (
              <div>
                <label className={labelClass}>{t('compliance.matrix.validityDays').toUpperCase()}</label>
                <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className={inputClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>{t('compliance.matrix.minAmount').toUpperCase()}</label>
              <input type="number" min={0} step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="—" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('compliance.matrix.notifyDays').toUpperCase()}</label>
              <input type="text" value={notifyDays} onChange={(e) => setNotifyDays(e.target.value)} placeholder="30" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>{t('compliance.matrix.onMissingAction').toUpperCase()}</label>
              <select value={missingAction} onChange={(e) => setMissingAction(e.target.value)} className={selectClass}>
                {MISSING_ACTIONS.map((action) => (
                  <option key={action} value={action}>{t(`compliance.matrix.missingActions.${action}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('compliance.matrix.conditions').toUpperCase()}</label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITION_FLAGS.map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-sm text-fg-2">
                  <input
                    type="checkbox"
                    checked={Boolean(conditions[flag])}
                    onChange={(e) =>
                      setConditions((prev) => {
                        const next = { ...prev }
                        if (e.target.checked) next[flag] = true
                        else delete next[flag]
                        return next
                      })
                    }
                    className="accent-accent"
                  />
                  {t(`compliance.conditions.${flag}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="accent-accent" />
              {t('compliance.matrix.mandatory')}
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" checked={coverage} onChange={(e) => setCoverage(e.target.checked)} className="accent-accent" />
              {t('compliance.matrix.requiresCoverage')}
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-accent" />
              {t('compliance.matrix.active')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Configurator
// ─────────────────────────────────────────────────────────────────────────────

export function ComplianceMatrixConfig() {
  const { t, i18n } = useTranslation()
  const [section, setSection] = useState<'types' | 'requirements'>('requirements')
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeModal, setTypeModal] = useState<{ docType: DocumentType | null } | null>(null)
  const [reqModal, setReqModal] = useState<{ requirement: DocumentRequirement | null } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const [typesResult, reqResult] = await Promise.all([
      fetchDocumentTypes(true),
      fetchRequirements(true),
    ])
    if (typesResult.error ?? reqResult.error) setError(typesResult.error ?? reqResult.error)
    setDocumentTypes(typesResult.data)
    setRequirements(reqResult.data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const typeById = useMemo(() => new Map(documentTypes.map((d) => [d.id, d])), [documentTypes])

  const sectionClass = (value: 'types' | 'requirements') =>
    section === value
      ? 'rounded-s border border-accent bg-accent/10 px-3 py-1.5 font-sans text-xs text-accent transition-colors'
      : 'rounded-s border border-line px-3 py-1.5 font-sans text-xs text-fg-2 transition-colors hover:text-fg-1'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="nx-loader" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => setSection('requirements')} className={sectionClass('requirements')}>
            {t('compliance.matrix.requirements')} · {requirements.length}
          </button>
          <button type="button" onClick={() => setSection('types')} className={sectionClass('types')}>
            {t('compliance.matrix.types')} · {documentTypes.length}
          </button>
        </div>
        <button
          type="button"
          onClick={() =>
            section === 'types' ? setTypeModal({ docType: null }) : setReqModal({ requirement: null })
          }
          className="inline-flex items-center gap-1 rounded-s bg-accent px-3 py-1.5 text-xs font-semibold text-fg-1 transition-opacity hover:opacity-90"
        >
          <Plus size={13} strokeWidth={2} />
          {section === 'types' ? t('compliance.matrix.newType') : t('compliance.matrix.newRequirement')}
        </button>
      </div>

      {error && (
        <p className="rounded-l border border-err/30 bg-err/10 px-4 py-3 font-sans text-sm text-err">{error}</p>
      )}

      {section === 'types' ? (
        <div className="overflow-x-auto rounded-l border border-line">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.code').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.name').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">STATUS</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {documentTypes.map((docType) => (
                <tr key={docType.id} className={`border-b border-line last:border-b-0 ${docType.is_active ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-2 font-mono text-xs text-fg-2">{docType.code}</td>
                  <td className="px-4 py-2 font-sans text-sm text-fg-1">{documentTypeName(docType, i18n.language)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${docType.is_active ? 'border-ok/40 text-ok' : 'border-line text-fg-3'}`}>
                      {docType.is_active ? t('compliance.matrix.active').toUpperCase() : t('compliance.matrix.inactive').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setTypeModal({ docType })}
                      className="rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                    >
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-l border border-line">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.documentType').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.appliesTo').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.origin').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.scope').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.validityRule').toUpperCase()}</th>
                <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.matrix.mandatory').toUpperCase()}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => {
                const docType = typeById.get(req.document_type_id)
                return (
                  <tr key={req.id} className={`border-b border-line last:border-b-0 ${req.is_active ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-2 font-sans text-sm text-fg-1">
                      {docType ? documentTypeName(docType, i18n.language) : req.document_type_code}
                    </td>
                    <td className="px-4 py-2 font-sans text-xs text-fg-2">{t(`compliance.kinds.${req.applies_to}`)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-2">{t(`compliance.matrix.origins.${req.origin}`)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-2">{t(`compliance.matrix.scopes.${req.scope}`)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-2">{t(`compliance.matrix.validityRules.${req.validity_rule}`)}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {req.is_mandatory ? (
                        <span className="text-fg-2">{t('common.yes')}</span>
                      ) : (
                        <span className="text-fg-3">{t('common.optional')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setReqModal({ requirement: req })}
                        className="rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {typeModal && (
        <TypeModal
          docType={typeModal.docType}
          onClose={() => setTypeModal(null)}
          onSaved={() => {
            setTypeModal(null)
            void load()
          }}
        />
      )}
      {reqModal && (
        <RequirementModal
          requirement={reqModal.requirement}
          documentTypes={documentTypes.filter((d) => d.is_active)}
          onClose={() => setReqModal(null)}
          onSaved={() => {
            setReqModal(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
