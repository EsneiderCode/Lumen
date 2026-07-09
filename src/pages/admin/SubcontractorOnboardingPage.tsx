import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Clock, Download, FileText, Plus, Save, Trash2, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchTechnicians, type TechnicianProfile } from '@/services/workOrderService'
import {
  fetchSubcontractorOnboarding,
  saveSubcontractorOnboarding,
} from '@/services/subcontractorOnboardingService'
import {
  buildContractorDocumentSlots,
  fetchContractorDocuments,
  getContractorDocumentSignedUrls,
  reviewContractorDocument,
  uploadContractorDocument,
} from '@/services/contractorDocumentService'
import { generateOnboardingPdf } from '@/services/onboardingPdfService'
import { ContractorDocumentsPanel } from '@/components/contractor/ContractorDocumentsPanel'
import {
  emptyA1Worker,
  emptyOnboarding,
  type SubcontractorOnboardingPayload,
} from '@/types/subcontractor-onboarding'
import type { ContractorDocument, ContractorDocumentType } from '@/types/contractor-documents'

// A1-Bescheinigungen are per worker (§3) — hide the generic slot in §2.
const PANEL_EXCLUDED_TYPES: ContractorDocumentType[] = ['a1_bescheinigung']

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

function a1StatusMeta(doc: ContractorDocument): { cls: string; labelKey: string } {
  const expired = doc.expires_at
    ? new Date(doc.expires_at + 'T23:59:59').getTime() < Date.now()
    : false
  if (expired) return { cls: 'border-err/40 text-err', labelKey: 'contractorDocs.expired' }
  if (doc.status === 'approved') return { cls: 'border-ok/40 text-ok', labelKey: 'contractorDocs.status.approved' }
  if (doc.status === 'pending_review') return { cls: 'border-warn/40 text-warn', labelKey: 'contractorDocs.status.pending_review' }
  return { cls: 'border-err/40 text-err', labelKey: 'contractorDocs.status.rejected' }
}

export function SubcontractorOnboardingPage() {
  const { t } = useTranslation()
  const { contractorId = '' } = useParams()
  const { user } = useAuth()

  const [form, setForm] = useState<SubcontractorOnboardingPayload>(() => emptyOnboarding(contractorId))
  const [contractor, setContractor] = useState<TechnicianProfile | null>(null)
  const [docs, setDocs] = useState<ContractorDocument[]>([])
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [a1Working, setA1Working] = useState<number | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const set = <K extends keyof SubcontractorOnboardingPayload>(
    key: K,
    value: SubcontractorOnboardingPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  const refreshDocs = useCallback(async () => {
    const { data, error: docErr } = await fetchContractorDocuments(contractorId)
    if (docErr) setError(docErr)
    setDocs(data)
    const a1Paths = data
      .filter((d) => d.document_type === 'a1_bescheinigung')
      .map((d) => d.storage_path)
    setDocUrls(await getContractorDocumentSignedUrls(a1Paths))
  }, [contractorId])

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
        a1_workers: Array.isArray(d.a1_workers)
          ? // Backfill records saved before per-worker A1 files existed.
            d.a1_workers.map((w) => ({ ...w, a1_document_id: w.a1_document_id ?? null }))
          : [],
        checked_48b: d.checked_48b,
        withhold_bauabzug: d.withhold_bauabzug,
        ust_id_confirmed: d.ust_id_confirmed,
        place_date: d.place_date ?? '',
        verified_by: d.verified_by ?? '',
        notes: d.notes ?? '',
      })
    }
    setContractor(techRes.data.find((p) => p.id === contractorId) ?? null)
    await refreshDocs()
    setLoading(false)
  }, [contractorId, refreshDocs])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const docsById = useMemo(
    () => Object.fromEntries(docs.map((d) => [d.id, d])),
    [docs],
  )
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
    const a1Docs = Object.fromEntries(
      data
        .filter((d) => d.document_type === 'a1_bescheinigung')
        .map((d) => [d.id, d]),
    )
    generateOnboardingPdf(form, buildContractorDocumentSlots(data), contractorName, a1Docs)
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

  // Upload one worker's A1 certificate, link it to the worker and persist the
  // link right away so it survives a reload without an explicit Save.
  const handleWorkerA1Upload = async (idx: number, file: File | null) => {
    if (!file || !user) return
    setA1Working(idx)
    setError(null)
    const worker = form.a1_workers[idx]
    const { data, error: upErr } = await uploadContractorDocument({
      contractorId,
      documentType: 'a1_bescheinigung',
      file,
      uploadedBy: user.id,
      expiresAt: worker.a1_valid_until,
    })
    if (upErr || !data) {
      setError(upErr)
      setA1Working(null)
      return
    }
    const nextForm: SubcontractorOnboardingPayload = {
      ...form,
      a1_workers: form.a1_workers.map((w, i) =>
        i === idx ? { ...w, a1_document_id: data.id } : w,
      ),
    }
    setForm(nextForm)
    const { error: saveErr } = await saveSubcontractorOnboarding(nextForm, user.id)
    if (saveErr) setError(saveErr)
    await refreshDocs()
    setA1Working(null)
  }

  const handleWorkerA1Review = async (doc: ContractorDocument, status: 'approved' | 'rejected') => {
    if (!user) return
    setReviewingId(doc.id)
    setError(null)
    const { error: err } = await reviewContractorDocument({
      documentId: doc.id,
      status,
      reviewedBy: user.id,
    })
    if (err) setError(err)
    await refreshDocs()
    setReviewingId(null)
  }

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

      {/* §2 Pflichtdokumente — A1 lives per worker in §3 */}
      <section>
        <h2 className="mb-1 font-display text-sm font-semibold text-fg-1">
          2 · {t('onboarding.sections.documents')}
        </h2>
        <p className="mb-3 font-sans text-xs text-fg-3">{t('onboarding.a1Hint')}</p>
        <ContractorDocumentsPanel contractorId={contractorId} canReview excludeTypes={PANEL_EXCLUDED_TYPES} />
      </section>

      {/* §3 Eingesetzte Mitarbeiter (A1) — one A1 certificate per worker */}
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
          <div className="space-y-3">
            {form.a1_workers.map((w, idx) => {
              const doc = w.a1_document_id ? docsById[w.a1_document_id] : undefined
              const url = doc ? docUrls[doc.storage_path] : undefined
              const meta = doc ? a1StatusMeta(doc) : null
              return (
                <div key={idx} className="rounded-s border border-line bg-bg-0 p-3">
                  <div className="grid grid-cols-[1fr_auto] items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <Field label={t('onboarding.worker.name')}>
                      <input className={inputClass} value={w.name} onChange={(e) => updateWorker(idx, 'name', e.target.value)} placeholder="Max Mustermann" />
                    </Field>
                    <Field label={t('onboarding.worker.a1ValidUntil')}>
                      <input type="date" className={inputClass} value={w.a1_valid_until ?? ''} onChange={(e) => updateWorker(idx, 'a1_valid_until', e.target.value)} />
                    </Field>
                    <Field label={t('onboarding.worker.idNumber')}>
                      <input className={inputClass + ' font-mono'} value={w.id_number} onChange={(e) => updateWorker(idx, 'id_number', e.target.value)} />
                    </Field>
                    <button
                      onClick={() => removeWorker(idx)}
                      className="mb-1.5 rounded p-1.5 text-fg-3 transition-colors hover:text-err"
                      aria-label={t('onboarding.removeWorker')}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Per-worker A1 certificate */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
                    <span className="font-mono text-[10px] text-fg-3">{t('onboarding.worker.a1File')}</span>
                    {doc && meta ? (
                      <>
                        <span className="font-sans text-xs text-fg-1">{doc.file_name}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] ${meta.cls}`}>
                          {doc.status === 'approved' ? <Check size={11} strokeWidth={1.5} /> : doc.status === 'pending_review' ? <Clock size={11} strokeWidth={1.5} /> : <XCircle size={11} strokeWidth={1.5} />}
                          {t(meta.labelKey)}
                        </span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-s border border-line px-2 py-0.5 font-sans text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                          >
                            <FileText size={12} strokeWidth={1.5} />
                            {t('common.download')}
                          </a>
                        )}
                        {doc.status === 'pending_review' && (
                          <span className="inline-flex gap-1.5">
                            <button
                              type="button"
                              disabled={reviewingId === doc.id}
                              onClick={() => void handleWorkerA1Review(doc, 'approved')}
                              className="rounded-s border border-ok/40 px-2 py-0.5 font-sans text-xs text-ok transition-colors hover:border-ok disabled:opacity-40"
                            >
                              {t('contractorDocs.approve')}
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === doc.id}
                              onClick={() => void handleWorkerA1Review(doc, 'rejected')}
                              className="rounded-s border border-err/40 px-2 py-0.5 font-sans text-xs text-err transition-colors hover:border-err disabled:opacity-40"
                            >
                              {t('contractorDocs.reject')}
                            </button>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-err/40 px-2 py-0.5 font-mono text-[10px] text-err">
                        <XCircle size={11} strokeWidth={1.5} />
                        {t('contractorDocs.missing')}
                      </span>
                    )}
                    <label className="ml-auto flex items-center gap-2">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          void handleWorkerA1Upload(idx, e.target.files?.[0] ?? null)
                          e.target.value = ''
                        }}
                        className="min-w-0 text-xs text-fg-2 file:mr-2 file:rounded-s file:border file:border-line file:bg-bg-1 file:px-2 file:py-1 file:text-xs file:text-fg-1"
                      />
                      {a1Working === idx && <span className="nx-loader-sm" aria-label="[LOADING]" />}
                    </label>
                  </div>
                </div>
              )
            })}
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
