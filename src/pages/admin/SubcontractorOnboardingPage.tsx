import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchTechnicians, type TechnicianProfile } from '@/services/workOrderService'
import {
  fetchSubcontractorOnboarding,
  saveSubcontractorOnboarding,
} from '@/services/subcontractorOnboardingService'
import {
  buildContractorDocumentSlots,
  fetchContractorDocuments,
} from '@/services/contractorDocumentService'
import { generateOnboardingPdf } from '@/services/onboardingPdfService'
import { ContractorDocumentsPanel } from '@/components/contractor/ContractorDocumentsPanel'
import {
  emptyA1Worker,
  emptyOnboarding,
  type SubcontractorOnboardingPayload,
} from '@/types/subcontractor-onboarding'
const inputClass =
  'w-full rounded-s border border-line bg-bg-2 px-3 py-2 font-sans text-sm text-fg-1 placeholder-fg-3 focus:border-accent focus:outline-none'
const labelClass = 'mb-1 block font-mono text-xs text-fg-2'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

export function SubcontractorOnboardingPage() {
  const { t } = useTranslation()
  const { contractorId = '' } = useParams()
  const { user } = useAuth()

  const [form, setForm] = useState<SubcontractorOnboardingPayload>(() => emptyOnboarding(contractorId))
  const [contractor, setContractor] = useState<TechnicianProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const set = <K extends keyof SubcontractorOnboardingPayload>(
    key: K,
    value: SubcontractorOnboardingPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [onboardingRes, techRes] = await Promise.all([
      fetchSubcontractorOnboarding(contractorId),
      fetchTechnicians(),
    ])
    if (onboardingRes.error) setError(onboardingRes.error)
    if (onboardingRes.data) {
      const d = onboardingRes.data
      setForm({
        contractor_id: d.contractor_id,
        company_name: d.company_name ?? '',
        ust_id_es: d.ust_id_es ?? '',
        address: d.address ?? '',
        tax_number_de: d.tax_number_de ?? '',
        contact_person: d.contact_person ?? '',
        contact_email: d.contact_email ?? '',
        contact_phone: d.contact_phone ?? '',
        project_site: d.project_site ?? '',
        deployment_period: d.deployment_period ?? '',
        a1_workers: Array.isArray(d.a1_workers) ? d.a1_workers : [],
        checked_48b: d.checked_48b,
        withhold_bauabzug: d.withhold_bauabzug,
        ust_id_confirmed: d.ust_id_confirmed,
        place_date: d.place_date ?? '',
        verified_by: d.verified_by ?? '',
        notes: d.notes ?? '',
      })
    }
    setContractor(techRes.data.find((p) => p.id === contractorId) ?? null)
    setLoading(false)
  }, [contractorId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const contractorName = contractor?.full_name ?? ''

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    const { error: err } = await saveSubcontractorOnboarding(form, user.id)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setSavedAt(new Date().toLocaleTimeString('de-DE'))
  }

  const handlePdf = async () => {
    // Use freshest document status for the checklist.
    const { data } = await fetchContractorDocuments(contractorId)
    generateOnboardingPdf(form, buildContractorDocumentSlots(data), contractorName)
  }

  const addWorker = () => set('a1_workers', [...form.a1_workers, emptyA1Worker()])
  const removeWorker = (idx: number) =>
    set('a1_workers', form.a1_workers.filter((_, i) => i !== idx))
  const updateWorker = (idx: number, key: 'name' | 'a1_valid_until' | 'id_number', value: string) =>
    set(
      'a1_workers',
      form.a1_workers.map((w, i) =>
        i === idx ? { ...w, [key]: key === 'a1_valid_until' ? value || null : value } : w,
      ),
    )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/personnel"
            className="mb-1 inline-flex items-center gap-1 font-sans text-xs text-fg-2 transition-colors hover:text-fg-1"
          >
            <ArrowLeft size={13} strokeWidth={1.5} /> {t('onboarding.back')}
          </Link>
          <h1 className="font-display text-xl font-bold text-fg-1">{t('onboarding.title')}</h1>
          <p className="mt-0.5 font-sans text-xs text-fg-2">
            {contractorName ? contractorName + ' · ' : ''}
            {t('onboarding.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePdf}
            className="flex items-center gap-2 rounded-s border border-line px-4 py-2 font-sans text-sm text-fg-2 transition-colors hover:text-fg-1"
          >
            <Download size={14} strokeWidth={1.5} /> {t('onboarding.exportPdf')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 font-sans text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save size={14} strokeWidth={2} /> {saving ? t('onboarding.saving') : t('onboarding.save')}
          </button>
        </div>
      </div>

      <div className="rounded-l border border-warn/30 bg-warn/5 px-4 py-3">
        <p className="font-sans text-xs text-warn">⚠ {t('onboarding.complianceHint')}</p>
      </div>

      {error && (
        <p className="rounded-l border border-err/30 bg-err/10 px-4 py-3 font-sans text-sm text-err">{error}</p>
      )}
      {savedAt && !error && (
        <p className="rounded-l border border-ok/30 bg-ok/10 px-4 py-3 font-sans text-sm text-ok">
          {t('onboarding.savedAt', { time: savedAt })}
        </p>
      )}

      {/* §1 Angaben zum Subunternehmer */}
      <section className="rounded-l border border-line bg-bg-1 p-5">
        <h2 className="mb-4 font-display text-sm font-semibold text-fg-1">
          1 · {t('onboarding.sections.company')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('onboarding.fields.companyName')}>
            <input
              className={inputClass}
              value={form.company_name ?? ''}
              onChange={(e) => set('company_name', e.target.value)}
              placeholder={contractorName}
            />
          </Field>
          <Field label={t('onboarding.fields.ustIdEs')}>
            <input className={inputClass + ' font-mono'} value={form.ust_id_es ?? ''} onChange={(e) => set('ust_id_es', e.target.value)} placeholder="ESX1234567X" />
          </Field>
          <Field label={t('onboarding.fields.address')}>
            <input className={inputClass} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label={t('onboarding.fields.taxNumberDe')}>
            <input className={inputClass + ' font-mono'} value={form.tax_number_de ?? ''} onChange={(e) => set('tax_number_de', e.target.value)} />
          </Field>
          <Field label={t('onboarding.fields.contactPerson')}>
            <input className={inputClass} value={form.contact_person ?? ''} onChange={(e) => set('contact_person', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('onboarding.fields.email')}>
              <input type="email" className={inputClass} value={form.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} />
            </Field>
            <Field label={t('onboarding.fields.phone')}>
              <input type="tel" className={inputClass} value={form.contact_phone ?? ''} onChange={(e) => set('contact_phone', e.target.value)} />
            </Field>
          </div>
          <Field label={t('onboarding.fields.projectSite')}>
            <input className={inputClass} value={form.project_site ?? ''} onChange={(e) => set('project_site', e.target.value)} />
          </Field>
          <Field label={t('onboarding.fields.deploymentPeriod')}>
            <input className={inputClass} value={form.deployment_period ?? ''} onChange={(e) => set('deployment_period', e.target.value)} placeholder={t('onboarding.fields.deploymentPeriodPlaceholder')} />
          </Field>
        </div>
      </section>

      {/* §2 Pflichtdokumente — reuse existing panel (10 items) */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold text-fg-1">
          2 · {t('onboarding.sections.documents')}
        </h2>
        <ContractorDocumentsPanel contractorId={contractorId} canReview />
      </section>

      {/* §3 Eingesetzte Mitarbeiter (A1) */}
      <section className="rounded-l border border-line bg-bg-1 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-fg-1">
            3 · {t('onboarding.sections.workers')}
          </h2>
          <button
            onClick={addWorker}
            className="flex items-center gap-1.5 rounded-s border border-line px-3 py-1.5 font-sans text-xs text-fg-2 transition-colors hover:text-fg-1"
          >
            <Plus size={13} strokeWidth={2} /> {t('onboarding.addWorker')}
          </button>
        </div>
        {form.a1_workers.length === 0 ? (
          <p className="py-4 text-center font-sans text-sm text-fg-3">{t('onboarding.noWorkers')}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-1">
              <span className="font-mono text-[10px] text-fg-3">{t('onboarding.worker.name')}</span>
              <span className="font-mono text-[10px] text-fg-3">{t('onboarding.worker.a1ValidUntil')}</span>
              <span className="font-mono text-[10px] text-fg-3">{t('onboarding.worker.idNumber')}</span>
              <span className="w-7" />
            </div>
            {form.a1_workers.map((w, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3">
                <input className={inputClass} value={w.name} onChange={(e) => updateWorker(idx, 'name', e.target.value)} placeholder="Max Mustermann" />
                <input type="date" className={inputClass} value={w.a1_valid_until ?? ''} onChange={(e) => updateWorker(idx, 'a1_valid_until', e.target.value)} />
                <input className={inputClass + ' font-mono'} value={w.id_number} onChange={(e) => updateWorker(idx, 'id_number', e.target.value)} />
                <button
                  onClick={() => removeWorker(idx)}
                  className="rounded p-1.5 text-fg-3 transition-colors hover:text-err"
                  aria-label={t('onboarding.removeWorker')}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* §4 Prüfung & Bestätigung */}
      <section className="rounded-l border border-line bg-bg-1 p-5">
        <h2 className="mb-4 font-display text-sm font-semibold text-fg-1">
          4 · {t('onboarding.sections.verification')}
        </h2>
        <div className="space-y-3">
          {(
            [
              ['checked_48b', 'onboarding.checks.checked48b'],
              ['withhold_bauabzug', 'onboarding.checks.withholdBauabzug'],
              ['ust_id_confirmed', 'onboarding.checks.ustIdConfirmed'],
            ] as const
          ).map(([key, labelKey]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="font-sans text-sm text-fg-1">{t(labelKey)}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={t('onboarding.fields.placeDate')}>
            <input className={inputClass} value={form.place_date ?? ''} onChange={(e) => set('place_date', e.target.value)} placeholder="Berlin, 09.07.2026" />
          </Field>
          <Field label={t('onboarding.fields.verifiedBy')}>
            <input className={inputClass} value={form.verified_by ?? ''} onChange={(e) => set('verified_by', e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label={t('onboarding.fields.notes')}>
              <textarea className={inputClass} rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
      </section>
    </div>
  )
}
