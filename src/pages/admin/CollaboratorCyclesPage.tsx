import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Plus, Save, Trash2, Eye, EyeOff, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchOperationalUsers, type OperationalUser } from '@/services/userService'
import { fetchWorkOrders } from '@/services/workOrderService'
import { CycleCalendar } from '@/components/cycle/CycleCalendar'
import { CycleLegend } from '@/components/cycle/CycleLegend'
import { defaultPaymentDate, reviewEndDate } from '@/lib/businessDays'
import {
  listCyclesForCollaborator,
  listCycleOrders,
  createCycle,
  updateCycle,
  deleteCycle,
  attachOrder,
  detachOrder,
  publishCycle,
  unpublishCycle,
  type CollaboratorCycle,
} from '@/services/collaboratorCyclesService'

interface CycleForm {
  period_start: string
  period_end: string
  period_label: string
  emission_date: string
  review_start_date: string
  final_cert_date: string
  payment_date: string
}

const EMPTY_FORM: CycleForm = {
  period_start: '',
  period_end: '',
  period_label: '',
  emission_date: '',
  review_start_date: '',
  final_cert_date: '',
  payment_date: '',
}

function toForm(cycle: CollaboratorCycle): CycleForm {
  return {
    period_start: cycle.period_start,
    period_end: cycle.period_end,
    period_label: cycle.period_label ?? '',
    emission_date: cycle.emission_date ?? '',
    review_start_date: cycle.review_start_date ?? '',
    final_cert_date: cycle.final_cert_date ?? '',
    payment_date: cycle.payment_date ?? '',
  }
}

interface WorkOrderOption {
  id: string
  order_number: string
}

export function CollaboratorCyclesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [contractors, setContractors] = useState<OperationalUser[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [cycles, setCycles] = useState<CollaboratorCycle[]>([])
  const [orders, setOrders] = useState<WorkOrderOption[]>([])
  const [attachedByCycle, setAttachedByCycle] = useState<Record<string, string[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CycleForm>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // D4 wiring: track whether the admin manually edited payment, and the cert date
  // the form was loaded with, so we know if the cert changed (which re-fixes payment).
  const paymentDateDirty = useRef(false)
  const loadedCertDate = useRef('')

  // Load contractors + work order options once.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: users }, { data: wos }] = await Promise.all([
        fetchOperationalUsers(),
        fetchWorkOrders({}, 0, 200),
      ])
      if (cancelled) return
      setContractors(users.filter((u) => u.role === 'contractor'))
      setOrders(wos.map((w) => ({ id: w.id, order_number: w.order_number })))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function reloadCycles(collaboratorId: string, isCancelled: () => boolean = () => false) {
    setIsLoading(true)
    const { data, error: err } = await listCyclesForCollaborator(collaboratorId)
    if (isCancelled()) return
    const orderResults = await Promise.all(data.map((c) => listCycleOrders(c.id)))
    if (isCancelled()) return
    const map: Record<string, string[]> = {}
    data.forEach((c, i) => {
      map[c.id] = orderResults[i].data
    })
    setCycles(data)
    setError(err)
    setAttachedByCycle(map)
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function sync() {
      setEditingId(null)
      setForm(EMPTY_FORM)
      if (!selectedId) {
        setCycles([])
        setAttachedByCycle({})
        return
      }
      await reloadCycles(selectedId, () => cancelled)
    }
    void sync()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // D4 live preview: when the cert date changes in the form, auto-fill payment.
  // A cert change re-fixes payment to +20, so any prior manual edit is discarded.
  function onCertChange(value: string) {
    paymentDateDirty.current = false
    setForm((f) => ({
      ...f,
      final_cert_date: value,
      payment_date: value ? (defaultPaymentDate(value) ?? '') : '',
    }))
  }

  const reviewEndPreview = useMemo(
    () => reviewEndDate(form.review_start_date || null),
    [form.review_start_date],
  )

  function startCreate() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    paymentDateDirty.current = false
    loadedCertDate.current = ''
    setError(null)
  }

  function startEdit(cycle: CollaboratorCycle) {
    setEditingId(cycle.id)
    setForm(toForm(cycle))
    paymentDateDirty.current = false
    loadedCertDate.current = cycle.final_cert_date ?? ''
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!selectedId) return
    setBusy(true)
    setError(null)
    if (editingId === 'new') {
      const { error: err } = await createCycle({
        collaborator_id: selectedId,
        period_start: form.period_start,
        period_end: form.period_end,
        period_label: form.period_label || null,
        emission_date: form.emission_date || null,
        review_start_date: form.review_start_date || null,
        final_cert_date: form.final_cert_date || null,
        payment_date: form.payment_date || null,
      })
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
    } else if (editingId) {
      // D4: if the cert date is unchanged AND the admin manually edited the
      // payment date, omit final_cert_date so the service keeps the manual
      // payment (resolvePaymentDate(undefined, payment)). If the cert changed,
      // send it and let the service re-fix payment to cert + 20.
      const certUnchanged = (form.final_cert_date || '') === loadedCertDate.current
      const keepManualPayment = certUnchanged && paymentDateDirty.current
      const { error: err } = await updateCycle(editingId, {
        period_start: form.period_start,
        period_end: form.period_end,
        period_label: form.period_label || null,
        emission_date: form.emission_date || null,
        review_start_date: form.review_start_date || null,
        ...(keepManualPayment ? {} : { final_cert_date: form.final_cert_date || null }),
        payment_date: form.payment_date || null,
      })
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
    }
    cancelEdit()
    await reloadCycles(selectedId)
    setBusy(false)
  }

  async function handleDelete(cycleId: string) {
    setBusy(true)
    const { error: err } = await deleteCycle(cycleId)
    if (err) setError(err)
    await reloadCycles(selectedId)
    setBusy(false)
  }

  async function handlePublishToggle(cycle: CollaboratorCycle) {
    if (!user) return
    setBusy(true)
    const { error: err } =
      cycle.status === 'published'
        ? await unpublishCycle(cycle.id)
        : await publishCycle(cycle.id, user.id)
    if (err) setError(err)
    await reloadCycles(selectedId)
    setBusy(false)
  }

  async function handleAttach(cycleId: string, workOrderId: string) {
    if (!workOrderId) return
    setBusy(true)
    const { error: err } = await attachOrder(cycleId, workOrderId)
    if (err) setError(err)
    const { data: ids } = await listCycleOrders(cycleId)
    setAttachedByCycle((m) => ({ ...m, [cycleId]: ids }))
    setBusy(false)
  }

  async function handleDetach(cycleId: string, workOrderId: string) {
    setBusy(true)
    const { error: err } = await detachOrder(cycleId, workOrderId)
    if (err) setError(err)
    const { data: ids } = await listCycleOrders(cycleId)
    setAttachedByCycle((m) => ({ ...m, [cycleId]: ids }))
    setBusy(false)
  }

  const inputClass =
    'w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <div className="space-y-5">
      <div className="nx-page-header flex items-center gap-3">
        <CalendarDays size={22} strokeWidth={1.5} className="text-fg-2" />
        <div>
          <h2 className="nx-page-title">{t('cycle.view.adminTitle')}</h2>
          <p className="nx-label mt-2">{t('cycle.view.adminSubtitle')}</p>
        </div>
      </div>

      <CycleLegend />

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="collaborator" className="nx-label mb-1 block">
          {t('cycle.fields.collaborator')}
        </label>
        <select
          id="collaborator"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={inputClass}
        >
          <option value="">{t('cycle.fields.selectCollaborator')}</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg-1">{t('cycle.view.cyclesTitle')}</h3>
            <button type="button" onClick={startCreate} className="btn btn-p btn-sm">
              <Plus size={16} strokeWidth={1.5} />
              {t('cycle.actions.newCycle')}
            </button>
          </div>

          {editingId && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSave()
              }}
              className="space-y-4 rounded-l border border-line bg-bg-1 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('cycle.fields.periodStart')} required>
                  <input
                    type="date"
                    required
                    value={form.period_start}
                    onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('cycle.fields.periodEnd')} required>
                  <input
                    type="date"
                    required
                    value={form.period_end}
                    onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('cycle.fields.periodLabel')}>
                  <input
                    type="text"
                    value={form.period_label}
                    onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('cycle.milestone.emission')}>
                  <input
                    type="date"
                    value={form.emission_date}
                    onChange={(e) => setForm((f) => ({ ...f, emission_date: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t('cycle.fields.reviewStart')}
                  hint={reviewEndPreview ? t('cycle.fields.reviewEndHint', { date: reviewEndPreview }) : undefined}
                >
                  <input
                    type="date"
                    value={form.review_start_date}
                    onChange={(e) => setForm((f) => ({ ...f, review_start_date: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('cycle.milestone.final_cert')}>
                  <input
                    type="date"
                    value={form.final_cert_date}
                    onChange={(e) => onCertChange(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('cycle.milestone.payment')} hint={t('cycle.fields.paymentHint')}>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => {
                      paymentDateDirty.current = true
                      setForm((f) => ({ ...f, payment_date: e.target.value }))
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancelEdit} className="btn btn-g btn-sm">
                  {t('cycle.actions.cancel')}
                </button>
                <button type="submit" disabled={busy} className="btn btn-p btn-sm">
                  <Save size={16} strokeWidth={1.5} />
                  {t('cycle.actions.save')}
                </button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-fg-3">[LOADING]</p>
          ) : cycles.length === 0 ? (
            <p className="text-sm text-fg-3">{t('cycle.view.emptyAdmin')}</p>
          ) : (
            <div className="space-y-3">
              {cycles.map((cycle) => (
                <div key={cycle.id} className="rounded-l border border-line bg-bg-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-fg-1">
                        {cycle.period_label || `${cycle.period_start} → ${cycle.period_end}`}
                      </span>
                      <span
                        className={`ml-3 inline-block rounded-m px-2 py-0.5 text-xs ${
                          cycle.status === 'published'
                            ? 'border border-ok/40 text-ok'
                            : 'border border-line text-fg-3'
                        }`}
                      >
                        {t(`cycle.status.${cycle.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePublishToggle(cycle)}
                        disabled={busy}
                        className="btn btn-g btn-sm"
                      >
                        {cycle.status === 'published' ? (
                          <>
                            <EyeOff size={16} strokeWidth={1.5} />
                            {t('cycle.actions.unpublish')}
                          </>
                        ) : (
                          <>
                            <Eye size={16} strokeWidth={1.5} />
                            {t('cycle.actions.publish')}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(cycle)}
                        className="btn btn-g btn-sm"
                      >
                        {t('cycle.actions.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cycle.id)}
                        disabled={busy}
                        className="btn btn-g btn-sm text-err"
                        aria-label={t('cycle.actions.delete')}
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-fg-2 sm:grid-cols-2">
                    <span>
                      {t('cycle.milestone.emission')}: {cycle.emission_date ?? '—'}
                    </span>
                    <span>
                      {t('cycle.milestone.review')}: {cycle.review_start_date ?? '—'}
                      {cycle.review_start_date &&
                        ` (→ ${reviewEndDate(cycle.review_start_date)})`}
                    </span>
                    <span>
                      {t('cycle.milestone.final_cert')}: {cycle.final_cert_date ?? '—'}
                    </span>
                    <span>
                      {t('cycle.milestone.payment')}: {cycle.payment_date ?? '—'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <span className="nx-label">{t('cycle.fields.orders')}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(attachedByCycle[cycle.id] ?? []).map((woId) => {
                        const wo = orders.find((o) => o.id === woId)
                        return (
                          <span
                            key={woId}
                            className="flex items-center gap-1 rounded-m border border-line px-2 py-1 text-xs text-fg-2"
                          >
                            {wo?.order_number ?? woId}
                            <button
                              type="button"
                              onClick={() => handleDetach(cycle.id, woId)}
                              disabled={busy}
                              aria-label={t('cycle.actions.detachOrder')}
                            >
                              <X size={12} strokeWidth={1.5} />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                    <select
                      value=""
                      onChange={(e) => handleAttach(cycle.id, e.target.value)}
                      disabled={busy}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">{t('cycle.actions.attachOrder')}</option>
                      {orders
                        .filter((o) => !(attachedByCycle[cycle.id] ?? []).includes(o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.order_number}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}

              <CycleCalendar cycles={cycles} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="nx-label mb-1 block">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children}
      {hint && <p className="nx-label mt-1">{hint}</p>}
    </div>
  )
}
