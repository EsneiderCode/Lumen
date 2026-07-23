import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, UserRound } from 'lucide-react'
import { ComplianceChecklist } from './ComplianceChecklist'
import {
  createEntity,
  fetchWorkers,
  updateEntity,
} from '@/services/complianceService'
import type { ComplianceEntityRecord, EntityPayload } from '@/services/complianceService'

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

interface Props {
  entity: ComplianceEntityRecord
  /** Admin one-step upload+approve (internal personnel). */
  directApprove?: boolean
  /** Show + manage the worker roster (companies). */
  manageWorkers?: boolean
  onChanged?: () => void
}

export function ComplianceEntityPanel({ entity, directApprove = false, manageWorkers = true, onChanged }: Props) {
  const { t } = useTranslation()
  const [workers, setWorkers] = useState<ComplianceEntityRecord[]>([])
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null)
  const [workerModal, setWorkerModal] = useState<{ worker: ComplianceEntityRecord | null } | null>(null)

  const isCompany = entity.kind === 'company'

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
        <div className="mb-3 border-b border-line pb-3">
          <h3 className="font-display text-sm font-semibold text-fg-1">
            {t('compliance.entityDocuments', { name: entity.display_name })}
          </h3>
          <p className="mt-1 font-mono text-xs text-fg-3">
            {t(`compliance.kinds.${entity.kind}`)} · {entity.country_code}
            {entity.nationality_country && entity.nationality_country !== entity.country_code
              ? ` · ${t('compliance.entity.nationality')}: ${entity.nationality_country}`
              : ''}
          </p>
        </div>
        <ComplianceChecklist entity={entity} directApprove={directApprove} onChanged={onChanged} />
      </div>

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
    </div>
  )
}
