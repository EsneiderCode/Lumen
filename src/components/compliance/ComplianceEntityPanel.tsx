import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, FileDown, Pencil, Plus, ShieldAlert, Trash2, UserRound } from 'lucide-react'
import { ComplianceChecklist } from './ComplianceChecklist'
import {
  createEntity,
  deleteEntity,
  eraseEntityPersonalData,
  fetchEntityDeletionImpact,
  fetchEntityDossier,
  fetchWorkers,
  saveScheinselbstCheck,
  updateEntity,
} from '@/services/complianceService'
import type {
  ComplianceEntityRecord,
  EntityDeletionImpact,
  EntityPayload,
} from '@/services/complianceService'
import { scoreScheinselbst } from '@/services/complianceHelpers'
import { SCHEINSELBST_INDICATORS } from '@/types/compliance'
import type {
  ScheinselbstCheck,
  ScheinselbstIndicator,
  ScheinselbstRiskLevel,
} from '@/types/compliance'
import { useAuth } from '@/hooks/useAuth'
import { generateComplianceDossierPdf } from '@/services/pdfService'

const RISK_CHIP: Record<ScheinselbstRiskLevel, string> = {
  low: 'border-ok/40 bg-ok/10 text-ok',
  medium: 'border-warn/40 bg-warn/10 text-warn',
  high: 'border-err/40 bg-err/10 text-err',
}

interface WorkerModalProps {
  parent: ComplianceEntityRecord
  worker: ComplianceEntityRecord | null
  onClose: () => void
  onSaved: () => void
}

function WorkerModal({ parent, worker, onClose, onSaved }: WorkerModalProps) {
  const { t } = useTranslation()
  const isEdit = worker !== null
  const [name, setName] = useState(worker?.display_name ?? '')
  const [country, setCountry] = useState(worker?.country_code ?? parent.country_code)
  const [nationality, setNationality] = useState(worker?.nationality_country ?? '')
  const [shortStay, setShortStay] = useState(Boolean(worker?.attributes?.short_stay))
  const [isActive, setIsActive] = useState(worker?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('compliance.workers.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const payload: EntityPayload = {
      kind: 'company_worker',
      display_name: name,
      country_code: country || parent.country_code,
      nationality_country: nationality || null,
      parent_entity_id: parent.id,
      attributes: { ...(worker?.attributes ?? {}), short_stay: shortStay },
      is_active: isActive,
    }
    const { error: saveError } = isEdit
      ? await updateEntity(worker.id, payload)
      : await createEntity(payload)
    setSaving(false)
    if (saveError) {
      setError(saveError)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="w-full max-w-md rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">
            {isEdit ? t('compliance.workers.edit') : t('compliance.workers.add')}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.workers.name').toUpperCase()} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.country').toUpperCase()}</label>
              <input
                type="text"
                value={country}
                maxLength={2}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="ES"
                className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 font-mono text-sm text-fg-1 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.nationality').toUpperCase()}</label>
              <input
                type="text"
                value={nationality}
                maxLength={2}
                onChange={(e) => setNationality(e.target.value.toUpperCase())}
                placeholder="ES"
                className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 font-mono text-sm text-fg-1 focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input
              type="checkbox"
              checked={shortStay}
              onChange={(e) => setShortStay(e.target.checked)}
              className="accent-accent"
            />
            {t('compliance.conditions.short_stay')}
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-accent"
              />
              {t('compliance.workers.active')}
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ScheinselbstModalProps {
  entity: ComplianceEntityRecord
  current: ScheinselbstCheck | null
  onClose: () => void
  onSaved: (check: ScheinselbstCheck) => void
}

/** Informative anti-Scheinselbstständigkeit checklist — decision-support only. */
function ScheinselbstModal({ entity, current, onClose, onSaved }: ScheinselbstModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [answers, setAnswers] = useState<Partial<Record<ScheinselbstIndicator, boolean>>>(
    current?.answers ?? {},
  )
  const [note, setNote] = useState(current?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => scoreScheinselbst(answers), [answers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data, error: saveError } = await saveScheinselbstCheck(entity.id, {
      answers,
      note: note.trim() || null,
      assessedBy: user?.id ?? null,
    })
    setSaving(false)
    if (saveError || !data?.scheinselbst_check) {
      setError(saveError ?? 'save_failed')
      return
    }
    onSaved(data.scheinselbst_check)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">
            {t('compliance.scheinselbst.title')} · {entity.display_name}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="rounded-s border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            {t('compliance.scheinselbst.disclaimer')}
          </p>
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}
          <div className="space-y-2">
            {SCHEINSELBST_INDICATORS.map((indicator) => (
              <label key={indicator} className="flex items-start gap-2 text-sm text-fg-2">
                <input
                  type="checkbox"
                  checked={Boolean(answers[indicator])}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [indicator]: e.target.checked }))
                  }
                  className="mt-0.5 accent-accent"
                />
                {t(`compliance.scheinselbst.indicators.${indicator}`)}
              </label>
            ))}
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">
              {t('compliance.scheinselbst.note').toUpperCase()}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${RISK_CHIP[preview.level]}`}>
              {t(`compliance.scheinselbst.levels.${preview.level}`)} · {preview.score}/{preview.maxScore}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EraseModalProps {
  entity: ComplianceEntityRecord
  onClose: () => void
  onErased: () => void
}

/** GDPR right-to-erasure confirmation — irreversible scrub of identifying PII. */
function EraseModal({ entity, onClose, onErased }: EraseModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyword = t('compliance.erase.keyword')

  async function handleErase() {
    setWorking(true)
    setError(null)
    const { error: eraseError } = await eraseEntityPersonalData(entity.id, user?.id ?? null)
    setWorking(false)
    if (eraseError) {
      setError(eraseError)
      return
    }
    onErased()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="w-full max-w-md rounded-l border border-err/40 bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-1.5 font-sans text-sm font-medium text-err">
            <Trash2 size={14} strokeWidth={1.5} />
            {t('compliance.erase.title')}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-fg-2">{t('compliance.erase.warning', { name: entity.display_name })}</p>
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">
              {t('compliance.erase.confirmLabel', { keyword })}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 font-mono text-sm text-fg-1 focus:border-err focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={working || confirmText.trim() !== keyword}
              onClick={() => void handleErase()}
              className="rounded-s border border-err/50 bg-err/10 px-4 py-2 text-sm font-semibold text-err transition-colors hover:border-err disabled:opacity-40"
            >
              {working ? t('common.saving') : t('compliance.erase.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeleteModalProps {
  entity: ComplianceEntityRecord
  onClose: () => void
  onDeleted: () => void
}

/** Irreversible removal of a company/freelancer: the whole tree plus its files.
 *  Unlike the GDPR scrub this leaves nothing behind, so the exact name must be
 *  typed and the real impact is shown before the button unlocks. */
function DeleteEntityModal({ entity, onClose, onDeleted }: DeleteModalProps) {
  const { t } = useTranslation()
  const [confirmText, setConfirmText] = useState('')
  const [impact, setImpact] = useState<EntityDeletionImpact | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: impactError } = await fetchEntityDeletionImpact(entity.id)
      if (cancelled) return
      setImpact(data)
      if (impactError) setError(impactError)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [entity.id])

  async function handleDelete() {
    setWorking(true)
    setError(null)
    const { error: deleteError } = await deleteEntity(entity)
    setWorking(false)
    if (deleteError) {
      setError(deleteError)
      return
    }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="w-full max-w-md rounded-l border border-err/40 bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-1.5 font-sans text-sm font-medium text-err">
            <Trash2 size={14} strokeWidth={1.5} />
            {t('compliance.delete.title')}
          </h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-fg-2">{t('compliance.delete.warning', { name: entity.display_name })}</p>
          {impact && (
            <ul className="space-y-1 rounded-s border border-line bg-bg-2 px-3 py-2 font-mono text-xs text-fg-2">
              <li>{t('compliance.delete.impactWorkers', { count: impact.workers })}</li>
              <li>{t('compliance.delete.impactDocuments', { count: impact.documents })}</li>
              <li>{t('compliance.delete.impactFiles', { count: impact.files })}</li>
              <li>{t('compliance.delete.impactAssignments', { count: impact.assignments })}</li>
            </ul>
          )}
          <p className="text-xs text-fg-3">{t('compliance.delete.keepsLogin')}</p>
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">
              {t('compliance.delete.confirmLabel', { name: entity.display_name })}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-err focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={working || confirmText.trim() !== entity.display_name.trim()}
              onClick={() => void handleDelete()}
              className="rounded-s border border-err/50 bg-err/10 px-4 py-2 text-sm font-semibold text-err transition-colors hover:border-err disabled:opacity-40"
            >
              {working ? t('compliance.delete.working') : t('compliance.delete.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EntityModalProps {
  entity: ComplianceEntityRecord
  onClose: () => void
  onSaved: () => void
}

/** Edit a top-level entity (company/freelancer/employee), incl. active toggle.
 *  Deactivating an entity is the gate that unlocks GDPR erasure. */
function EntityModal({ entity, onClose, onSaved }: EntityModalProps) {
  const { t } = useTranslation()
  const isFreelancer = entity.kind === 'freelancer'
  const [name, setName] = useState(entity.display_name)
  const [country, setCountry] = useState(entity.country_code)
  const [nationality, setNationality] = useState(entity.nationality_country ?? '')
  const [email, setEmail] = useState(entity.contact_email ?? '')
  const [phone, setPhone] = useState(entity.contact_phone ?? '')
  const [address, setAddress] = useState(entity.address ?? '')
  const [isActive, setIsActive] = useState(entity.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full rounded-s border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('compliance.workers.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const payload: EntityPayload = {
      kind: entity.kind,
      display_name: name,
      country_code: country || entity.country_code,
      nationality_country: isFreelancer ? nationality || null : entity.nationality_country,
      attributes: entity.attributes ?? {},
      contact_email: email || null,
      contact_phone: phone || null,
      address: address || null,
      is_active: isActive,
    }
    const { error: saveError } = await updateEntity(entity.id, payload)
    setSaving(false)
    if (saveError) {
      setError(saveError)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
      <div className="w-full max-w-md rounded-l border border-line bg-bg-1">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-fg-1">{t('compliance.entity.edit')}</h2>
          <button onClick={onClose} className="text-fg-2 transition-colors hover:text-fg-1" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>
          )}
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.workers.name').toUpperCase()} *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.country').toUpperCase()}</label>
              <input
                type="text"
                value={country}
                maxLength={2}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="ES"
                className={`${inputClass} font-mono`}
              />
            </div>
            {isFreelancer && (
              <div>
                <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.nationality').toUpperCase()}</label>
                <input
                  type="text"
                  value={nationality}
                  maxLength={2}
                  onChange={(e) => setNationality(e.target.value.toUpperCase())}
                  placeholder="ES"
                  className={`${inputClass} font-mono`}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.email').toUpperCase()}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.phone').toUpperCase()}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs text-fg-2">{t('compliance.entity.address').toUpperCase()}</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-accent"
              />
              {t('compliance.entity.active')}
            </label>
            {!isActive && (
              <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-fg-3">
                {t('compliance.entity.deactivateHint')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:text-fg-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface Props {
  entity: ComplianceEntityRecord
  /** Admin one-step upload+approve (internal personnel). */
  directApprove?: boolean
  /** Show + manage the worker roster (companies). */
  manageWorkers?: boolean
  /** Admin-only anti-Scheinselbstständigkeit assessment (freelancers). */
  riskAssessment?: boolean
  /** Admin-only GDPR erasure of identifying PII (inactive entities). */
  allowErasure?: boolean
  /** Admin-only edit + activate/deactivate of the top-level entity. */
  allowEdit?: boolean
  /** Admin-only irreversible deletion of a company/freelancer and its tree. */
  allowDelete?: boolean
  /** Called after a successful hard delete — the entity no longer exists. */
  onDeleted?: () => void
  onChanged?: () => void
}

export function ComplianceEntityPanel({
  entity,
  directApprove = false,
  manageWorkers = true,
  riskAssessment = false,
  allowErasure = false,
  allowEdit = false,
  allowDelete = false,
  onDeleted,
  onChanged,
}: Props) {
  const { t, i18n } = useTranslation()
  const [workers, setWorkers] = useState<ComplianceEntityRecord[]>([])
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null)
  const [workerModal, setWorkerModal] = useState<{ worker: ComplianceEntityRecord | null } | null>(null)
  const [dossierState, setDossierState] = useState<'idle' | 'working' | 'error'>('idle')
  // Freshly-saved assessments, keyed by entity id, overlay the prop value so a
  // re-assessment shows immediately without waiting for the parent to reload.
  const [savedChecks, setSavedChecks] = useState<Record<string, ScheinselbstCheck>>({})
  const [showSchein, setShowSchein] = useState(false)
  const [showErase, setShowErase] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const scheinCheck = savedChecks[entity.id] ?? entity.scheinselbst_check

  const isCompany = entity.kind === 'company'
  const showRisk = riskAssessment && entity.kind === 'freelancer'
  const canErase = allowErasure && !entity.is_active && !entity.attributes?.erased
  // Workers are removed with their company; internal employees are mirrored
  // from `employees` by trigger and must be deleted there.
  const canDelete = allowDelete && (entity.kind === 'company' || entity.kind === 'freelancer')

  async function handleDossier() {
    setDossierState('working')
    const { data, error } = await fetchEntityDossier(entity)
    if (error || !data) {
      setDossierState('error')
      return
    }
    generateComplianceDossierPdf(data, { t, locale: i18n.language.slice(0, 2) })
    setDossierState('idle')
  }

  const loadWorkers = useCallback(async () => {
    if (!isCompany) return
    const { data } = await fetchWorkers(entity.id)
    setWorkers(data)
  }, [entity.id, isCompany])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkers()
  }, [loadWorkers])

  return (
    <div className="space-y-5">
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-display text-sm font-semibold text-fg-1">
              {t('compliance.entityDocuments', { name: entity.display_name })}
              {!entity.is_active && (
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] font-normal uppercase text-fg-3">
                  {t('compliance.entity.inactive')}
                </span>
              )}
            </h3>
            <p className="mt-1 font-mono text-xs text-fg-3">
              {t(`compliance.kinds.${entity.kind}`)} · {entity.country_code}
              {entity.nationality_country && entity.nationality_country !== entity.country_code
                ? ` · ${t('compliance.entity.nationality')}: ${entity.nationality_country}`
                : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {allowEdit && !entity.attributes?.erased && (
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
              >
                <Pencil size={13} strokeWidth={1.5} />
                {t('common.edit')}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1 rounded-s border border-err/40 px-3 py-1.5 text-xs text-err transition-colors hover:border-err"
                title={t('compliance.delete.hint')}
              >
                <Trash2 size={13} strokeWidth={1.5} />
                {t('compliance.delete.button')}
              </button>
            )}
            {canErase && (
              <button
                type="button"
                onClick={() => setShowErase(true)}
                className="inline-flex items-center gap-1 rounded-s border border-err/40 px-3 py-1.5 text-xs text-err transition-colors hover:border-err"
                title={t('compliance.erase.hint')}
              >
                <Trash2 size={13} strokeWidth={1.5} />
                {t('compliance.erase.button')}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDossier()}
              disabled={dossierState === 'working'}
              className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              title={t('compliance.dossier.hint')}
            >
              <FileDown size={13} strokeWidth={1.5} />
              {dossierState === 'working' ? t('compliance.dossier.generating') : t('compliance.dossier.button')}
            </button>
          </div>
        </div>
        {dossierState === 'error' && (
          <p className="mb-3 rounded-s border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">
            {t('compliance.dossier.error')}
          </p>
        )}
        <ComplianceChecklist entity={entity} directApprove={directApprove} onChanged={onChanged} />
      </div>

      {showRisk && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-fg-1">
                <ShieldAlert size={14} strokeWidth={1.5} className="text-fg-2" />
                {t('compliance.scheinselbst.title')}
              </h3>
              <p className="mt-1 text-xs text-fg-2">{t('compliance.scheinselbst.subtitle')}</p>
              {scheinCheck ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${RISK_CHIP[scheinCheck.level]}`}>
                    {t(`compliance.scheinselbst.levels.${scheinCheck.level}`)} · {scheinCheck.score}/{scheinCheck.max_score}
                  </span>
                  <span className="font-mono text-[10px] text-fg-3">
                    {t('compliance.scheinselbst.assessedAt', {
                      date: new Date(scheinCheck.assessed_at).toLocaleDateString(i18n.language),
                    })}
                  </span>
                </div>
              ) : (
                <p className="mt-2 font-mono text-xs text-fg-3">{t('compliance.scheinselbst.notAssessed')}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSchein(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
            >
              {scheinCheck ? t('compliance.scheinselbst.reassess') : t('compliance.scheinselbst.assess')}
            </button>
          </div>
        </div>
      )}

      {isCompany && manageWorkers && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-fg-1">{t('compliance.workers.title')}</h3>
              <p className="mt-1 text-xs text-fg-2">{t('compliance.workers.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setWorkerModal({ worker: null })}
              className="inline-flex items-center gap-1 rounded-s bg-accent px-3 py-1.5 text-xs font-semibold text-fg-1 transition-opacity hover:opacity-90"
            >
              <Plus size={13} strokeWidth={2} />
              {t('compliance.workers.add')}
            </button>
          </div>

          {workers.length === 0 ? (
            <p className="py-4 text-center text-sm text-fg-2">{t('compliance.workers.empty')}</p>
          ) : (
            <div className="space-y-2">
              {workers.map((worker) => {
                const expanded = expandedWorkerId === worker.id
                return (
                  <div key={worker.id} className="border border-line bg-bg-0">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedWorkerId(expanded ? null : worker.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <UserRound size={14} strokeWidth={1.5} className="shrink-0 text-fg-2" />
                        <span className="truncate text-sm text-fg-1">{worker.display_name}</span>
                        <span className="font-mono text-xs text-fg-3">{worker.nationality_country ?? worker.country_code}</span>
                        {expanded ? (
                          <ChevronUp size={14} strokeWidth={1.5} className="ml-auto shrink-0 text-fg-2" />
                        ) : (
                          <ChevronDown size={14} strokeWidth={1.5} className="ml-auto shrink-0 text-fg-2" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkerModal({ worker })}
                        className="rounded-s border border-line px-2 py-1 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {t('common.edit')}
                      </button>
                    </div>
                    {expanded && (
                      <div className="border-t border-line p-3">
                        <ComplianceChecklist entity={worker} directApprove={directApprove} onChanged={onChanged} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {workerModal && (
        <WorkerModal
          parent={entity}
          worker={workerModal.worker}
          onClose={() => setWorkerModal(null)}
          onSaved={() => {
            setWorkerModal(null)
            void loadWorkers()
            onChanged?.()
          }}
        />
      )}

      {showSchein && (
        <ScheinselbstModal
          entity={entity}
          current={scheinCheck}
          onClose={() => setShowSchein(false)}
          onSaved={(check) => {
            setSavedChecks((prev) => ({ ...prev, [entity.id]: check }))
            setShowSchein(false)
            onChanged?.()
          }}
        />
      )}

      {showErase && (
        <EraseModal
          entity={entity}
          onClose={() => setShowErase(false)}
          onErased={() => {
            setShowErase(false)
            onChanged?.()
          }}
        />
      )}

      {showEdit && (
        <EntityModal
          entity={entity}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false)
            onChanged?.()
          }}
        />
      )}

      {showDelete && (
        <DeleteEntityModal
          entity={entity}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {
            setShowDelete(false)
            onDeleted?.()
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}
