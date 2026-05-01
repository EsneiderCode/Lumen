import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchServiceItems,
  createServiceItem,
  updateServiceItem,
  deactivateServiceItem,
  activateServiceItem,
  deleteServiceItem,
  type ServiceItemPayload,
} from '@/services/serviceItemService'
import { fetchOperators, fetchClients } from '@/services/workOrderService'
import type { ServiceItemWithRelations } from '@/types/service-items'

// ── Constants ──────────────────────────────────────────────────────────────────

const DETAIL_FORM_OPTIONS = [
  { value: '',          label: '— keine —' },
  { value: 'soplado',   label: 'Soplado' },
  { value: 'fusion_ap', label: 'Fusión AP' },
  { value: 'fusion_dp', label: 'Fusión DP' },
  { value: 'alta',      label: 'Alta / Installation' },
  { value: 'nt',        label: 'NT Installation' },
  { value: 'patchkabel',label: 'Patchkabel' },
  { value: 'pop',       label: 'POP' },
]

const UNIT_OPTIONS = ['UDS', 'ML', 'M', 'M³', 'Stk', 'Termin', 'Units', 'WE', 'NT', 'LE']

// ── Types ──────────────────────────────────────────────────────────────────────

interface RefRow { id: string; code: string; name: string }

const EMPTY_FORM: ServiceItemPayload = {
  code: '',
  description_de: '',
  description_es: null,
  unit: null,
  unit_price: null,
  operator_id: null,
  client_id: null,
  detail_form: null,
  display_order: 0,
  active: true,
  notes: null,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(p: number | null) {
  if (p == null) return <span className="italic text-gf-text-placeholder">Angebot</span>
  return <span>{p.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface ModalProps {
  item: ServiceItemWithRelations | null   // null = create mode
  operators: RefRow[]
  clients: RefRow[]
  onClose: () => void
  onSaved: () => void
}

function ServiceItemModal({ item, operators, clients, onClose, onSaved }: ModalProps) {
  const { t } = useTranslation()
  const isEdit = item !== null
  const [form, setForm] = useState<ServiceItemPayload>(
    isEdit
      ? {
          code:          item.code,
          description_de: item.description_de,
          description_es: item.description_es,
          unit:          item.unit,
          unit_price:    item.unit_price,
          operator_id:   item.operator_id,
          client_id:     item.client_id,
          detail_form:   item.detail_form,
          display_order: item.display_order,
          active:        item.active,
          notes:         item.notes,
        }
      : { ...EMPTY_FORM },
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set<K extends keyof ServiceItemPayload>(k: K, v: ServiceItemPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.description_de.trim()) {
      setErr(t('serviceItems.modal.errorRequired'))
      return
    }
    setSaving(true)
    setErr(null)
    const payload: ServiceItemPayload = {
      ...form,
      code:          form.code.trim(),
      description_de: form.description_de.trim(),
      description_es: form.description_es?.trim() || null,
      unit:          form.unit || null,
      unit_price:    form.unit_price,
      operator_id:   form.operator_id || null,
      client_id:     form.client_id || null,
      detail_form:   (form.detail_form || null) as ServiceItemPayload['detail_form'],
      notes:         form.notes?.trim() || null,
    }
    const result = isEdit
      ? await updateServiceItem(item!.id, payload)
      : await createServiceItem(payload)
    if (result.error) {
      setErr(result.error)
      setSaving(false)
      return
    }
    onSaved()
  }

  const inputCls =
    'w-full rounded-gf-btn border border-gf-border bg-gf-base px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary'
  const labelCls = 'block text-[10px] font-medium uppercase tracking-widest text-gf-text-muted mb-1.5'
  const selectStyle = { colorScheme: 'dark' } as React.CSSProperties

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/95 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-gf-card border border-gf-border bg-gf-card overflow-hidden"
           style={{ boxShadow: '0 0 0 1px #333, 0 24px 48px rgba(0,0,0,0.6)' }}>

        {/* Accent top bar */}
        <div className="h-0.5 w-full bg-gf-primary" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gf-border bg-gf-surface px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gf-text-muted">
              {t('serviceItems.modal.category')}
            </p>
            <h3 className="font-display text-base font-bold text-gf-text-inverse mt-0.5">
              {isEdit ? t('serviceItems.modal.editTitle') : t('serviceItems.modal.createTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-gf-btn border border-gf-border text-gf-text-muted hover:border-gf-text hover:text-gf-text transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Section: Identifikation ── */}
          <div className="rounded-gf-card border border-gf-border bg-gf-surface p-4 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-gf-primary font-medium">
              {t('serviceItems.modal.sectionIdentification')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldCode')} *</label>
                <input
                  className={inputCls}
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder={t('serviceItems.modal.fieldCodePlaceholder')}
                />
              </div>
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldUnit')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.unit ?? ''}
                  onChange={(e) => set('unit', e.target.value || null)}
                >
                  <option value="">{t('serviceItems.modal.fieldUnitNone')}</option>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('serviceItems.modal.fieldDescDe')} *</label>
              <input
                className={inputCls}
                value={form.description_de}
                onChange={(e) => set('description_de', e.target.value)}
                placeholder={t('serviceItems.modal.fieldDescDePlaceholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{t('serviceItems.modal.fieldDescEs')}</label>
              <input
                className={inputCls}
                value={form.description_es ?? ''}
                onChange={(e) => set('description_es', e.target.value || null)}
                placeholder={t('serviceItems.modal.fieldDescEsPlaceholder')}
              />
            </div>
          </div>

          {/* ── Section: Preis & Reihenfolge ── */}
          <div className="rounded-gf-card border border-gf-border bg-gf-surface p-4 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-gf-primary font-medium">
              {t('serviceItems.modal.sectionPrice')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldPrice')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.unit_price ?? ''}
                  onChange={(e) => set('unit_price', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldDisplayOrder')}</label>
                <input
                  type="number"
                  step="1"
                  className={inputCls}
                  value={form.display_order}
                  onChange={(e) => set('display_order', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ── Section: Zuordnung ── */}
          <div className="rounded-gf-card border border-gf-border bg-gf-surface p-4 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-gf-primary font-medium">
              {t('serviceItems.modal.sectionAssignment')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldOperator')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.operator_id ?? ''}
                  onChange={(e) => set('operator_id', e.target.value || null)}
                >
                  <option value="">{t('serviceItems.modal.fieldOperatorGlobal')}</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('serviceItems.modal.fieldClient')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.client_id ?? ''}
                  onChange={(e) => set('client_id', e.target.value || null)}
                >
                  <option value="">{t('serviceItems.modal.fieldClientNone')}</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('serviceItems.modal.fieldDetailForm')}</label>
              <select
                className={inputCls}
                style={selectStyle}
                value={form.detail_form ?? ''}
                onChange={(e) => set('detail_form', (e.target.value || null) as ServiceItemPayload['detail_form'])}
              >
                {DETAIL_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Notizen ── */}
          <div>
            <label className={labelCls}>{t('serviceItems.modal.fieldNotes')}</label>
            <textarea
              rows={2}
              className={inputCls}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              placeholder={t('serviceItems.modal.fieldNotesPlaceholder')}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer rounded-gf-btn border border-gf-border bg-gf-surface px-4 py-3 hover:border-gf-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
                className="accent-[#5B9BF6]"
              />
              <span className="text-sm text-gf-text">{t('serviceItems.modal.active')}</span>
              <span className="ml-auto text-xs text-gf-text-muted">
                {form.active ? t('serviceItems.modal.activeVisible') : t('serviceItems.modal.activeHidden')}
              </span>
            </label>
          )}

          {err && (
            <p className="rounded-gf-btn border border-gf-accent/40 bg-gf-accent-light px-4 py-2.5 text-sm text-gf-accent">
              {err}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gf-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm text-gf-text-muted hover:text-gf-text hover:border-gf-text/30 transition-colors"
            >
              {t('serviceItems.modal.buttonCancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-gf-btn bg-gf-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving
                ? t('serviceItems.modal.buttonSaving')
                : isEdit
                  ? t('serviceItems.modal.buttonSave')
                  : t('serviceItems.modal.buttonCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirmation ────────────────────────────────────────────────────────

interface DeleteDialogProps {
  item: ServiceItemWithRelations
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}

function DeleteDialog({ item, onConfirm, onCancel, deleting }: DeleteDialogProps) {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-gf-card border border-gf-border bg-gf-card overflow-hidden"
           style={{ boxShadow: '0 0 0 1px #333, 0 24px 48px rgba(0,0,0,0.6)' }}>
        {/* Accent top bar — red for destructive */}
        <div className="h-0.5 w-full bg-gf-danger" />
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gf-danger font-medium mb-1">
              {t('serviceItems.deleteDialog.warning')}
            </p>
            <h3 className="font-display text-base font-bold text-gf-text-inverse">
              {t('serviceItems.deleteDialog.title')}
            </h3>
          </div>
          <div className="rounded-gf-btn border border-gf-border bg-gf-surface px-4 py-3">
            <p className="font-mono text-sm font-semibold text-gf-text">{item.code}</p>
            <p className="text-xs text-gf-text-muted mt-0.5 line-clamp-1">{item.description_de}</p>
          </div>
          <p className="text-sm text-gf-text-muted">
            {t('serviceItems.deleteDialog.body')}
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-gf-border">
            <button
              onClick={onCancel}
              className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm text-gf-text-muted hover:text-gf-text hover:border-gf-text/30 transition-colors"
            >
              {t('serviceItems.deleteDialog.buttonCancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="rounded-gf-btn bg-gf-danger px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {deleting ? t('serviceItems.deleteDialog.buttonDeleting') : t('serviceItems.deleteDialog.buttonConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

/**
 * Service catalog — admin-managed list of rate-card items sourced from
 * operator contracts. Supports create, edit, deactivate, and delete.
 */
export function ServiceItemsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<ServiceItemWithRelations[]>([])
  const [operators, setOperators] = useState<RefRow[]>([])
  const [clients, setClients] = useState<RefRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [operatorFilter, setOperatorFilter] = useState<string>('')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  // Modal state
  const [modalItem, setModalItem] = useState<ServiceItemWithRelations | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceItemWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Load reference data once
  useEffect(() => {
    fetchOperators().then(({ data }) => setOperators(data as RefRow[]))
    fetchClients().then(({ data }) => setClients(data as RefRow[]))
  }, [])

  const load = () => {
    setIsLoading(true)
    fetchServiceItems({ includeInactive }).then(({ data }) => {
      setItems(data)
      setIsLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [includeInactive])

  // Filter operators/clients from loaded items for dropdown
  const visibleOperators = Array.from(
    new Map(items.filter((i) => i.operators).map((i) => [i.operators!.id, i.operators!])).values(),
  )
  const visibleClients = Array.from(
    new Map(items.filter((i) => i.clients).map((i) => [i.clients!.id, i.clients!])).values(),
  )

  const q = search.trim().toLowerCase()
  const filtered = items.filter((i) => {
    if (operatorFilter === '__null__' && i.operator_id !== null) return false
    if (operatorFilter && operatorFilter !== '__null__' && i.operator_id !== operatorFilter) return false
    if (clientFilter && i.client_id !== clientFilter) return false
    if (!q) return true
    return (
      i.code.toLowerCase().includes(q) ||
      i.description_de.toLowerCase().includes(q) ||
      (i.description_es ?? '').toLowerCase().includes(q)
    )
  })

  async function handleToggleActive(item: ServiceItemWithRelations) {
    setTogglingId(item.id)
    if (item.active) {
      await deactivateServiceItem(item.id)
    } else {
      await activateServiceItem(item.id)
    }
    setTogglingId(null)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteServiceItem(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-gf-text">{t('serviceItems.title')}</h2>
          <p className="text-sm text-gf-text-muted">
            {t('serviceItems.subtitle', { count: filtered.length })}
          </p>
        </div>
        <button
          onClick={() => setModalItem('new')}
          className="rounded-gf-btn bg-gf-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          + {t('serviceItems.newItem')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder={t('serviceItems.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        />
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        >
          <option value="">{t('serviceItems.filters.allOperators')}</option>
          <option value="__null__">{t('serviceItems.filters.globalNoOperator')}</option>
          {visibleOperators.map((op) => (
            <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        >
          <option value="">{t('serviceItems.filters.allClients')}</option>
          {visibleClients.map((cl) => (
            <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <span>{t('serviceItems.filters.showInactive')}</span>
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-gf-card border border-gf-border bg-gf-card py-16 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm font-medium text-gf-text">{t('serviceItems.table.empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-gf-card border border-gf-border bg-gf-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gf-border bg-gf-surface">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">{t('serviceItems.table.code')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted">{t('serviceItems.table.descriptionDe')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted hidden lg:table-cell">{t('serviceItems.table.descriptionEs')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">{t('serviceItems.table.unit')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gf-text-muted whitespace-nowrap">{t('serviceItems.table.price')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden md:table-cell">{t('serviceItems.table.form')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden md:table-cell">{t('serviceItems.table.operator')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden sm:table-cell">{t('serviceItems.table.client')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">{t('serviceItems.table.status')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gf-text-muted whitespace-nowrap">{t('serviceItems.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-gf-border/50 transition-colors hover:bg-gf-surface/40 ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-gf-primary whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-3 py-3 text-gf-text max-w-xs">
                      <span className="line-clamp-2">{item.description_de}</span>
                    </td>
                    <td className="px-3 py-3 text-gf-text-muted max-w-xs hidden lg:table-cell">
                      {item.description_es
                        ? <span className="line-clamp-2">{item.description_es}</span>
                        : <span className="italic text-gf-text-placeholder">—</span>}
                    </td>
                    <td className="px-3 py-3 text-gf-text-muted font-mono text-xs whitespace-nowrap">
                      {item.unit ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-gf-text whitespace-nowrap">
                      {fmtPrice(item.unit_price)}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {item.detail_form
                        ? <span className="rounded bg-gf-surface px-1.5 py-0.5 font-mono text-xs text-gf-text-muted border border-gf-border">{item.detail_form}</span>
                        : <span className="text-gf-text-placeholder">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gf-text-muted whitespace-nowrap hidden md:table-cell">
                      {item.operators?.code ?? <span className="italic text-gf-text-placeholder">{t('serviceItems.table.global')}</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gf-text-muted whitespace-nowrap hidden sm:table-cell">
                      {item.clients?.code ?? <span className="italic text-gf-text-placeholder">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {item.active
                        ? <span className="inline-flex rounded-full bg-gf-success/15 px-2 py-0.5 text-xs font-medium text-emerald-700">{t('serviceItems.table.active')}</span>
                        : <span className="inline-flex rounded-full bg-gf-danger/10 px-2 py-0.5 text-xs font-medium text-gf-text-muted">{t('serviceItems.table.inactive')}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit */}
                        <button
                          title={t('serviceItems.table.edit')}
                          onClick={() => setModalItem(item)}
                          className="rounded px-2 py-1 text-xs text-gf-text-muted hover:text-gf-primary hover:bg-gf-surface transition-colors"
                        >
                          ✎
                        </button>
                        {/* Toggle active */}
                        <button
                          title={item.active ? t('serviceItems.table.deactivate') : t('serviceItems.table.activate')}
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                          className="rounded px-2 py-1 text-xs text-gf-text-muted hover:text-gf-warning hover:bg-gf-surface transition-colors disabled:opacity-40"
                        >
                          {item.active ? '⏸' : '▶'}
                        </button>
                        {/* Delete */}
                        <button
                          title={t('serviceItems.table.delete')}
                          onClick={() => setDeleteTarget(item)}
                          className="rounded px-2 py-1 text-xs text-gf-text-muted hover:text-gf-danger hover:bg-gf-surface transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalItem !== null && (
        <ServiceItemModal
          item={modalItem === 'new' ? null : modalItem}
          operators={operators}
          clients={clients}
          onClose={() => setModalItem(null)}
          onSaved={() => { setModalItem(null); load() }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteDialog
          item={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
