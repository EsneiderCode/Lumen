import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
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
  unit_price_external: null,
  operator_id: null,
  client_id: null,
  detail_form: null,
  display_order: 0,
  active: true,
  notes: null,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(p: number | null) {
  if (p == null) return <span className="italic text-fg-4">Angebot</span>
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
          code:                item.code,
          description_de:      item.description_de,
          description_es:      item.description_es,
          unit:                item.unit,
          unit_price:          item.unit_price,
          unit_price_external: item.unit_price_external,
          operator_id:         item.operator_id,
          client_id:           item.client_id,
          detail_form:         item.detail_form,
          display_order:       item.display_order,
          active:              item.active,
          notes:               item.notes,
        }
      : { ...EMPTY_FORM },
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set<K extends keyof ServiceItemPayload>(k: K, v: ServiceItemPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.code.trim() || !form.description_de.trim()) {
      setErr(t('catalog.errorRequired'))
      return
    }
    setSaving(true)
    setErr(null)
    const payload: ServiceItemPayload = {
      ...form,
      code:           form.code.trim(),
      description_de: form.description_de.trim(),
      description_es: form.description_es?.trim() || null,
      unit:           form.unit || null,
      unit_price:     form.unit_price,
      operator_id:    form.operator_id || null,
      client_id:      form.client_id || null,
      detail_form:    (form.detail_form || null) as ServiceItemPayload['detail_form'],
      notes:          form.notes?.trim() || null,
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
    'w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
  const labelCls = 'block text-[10px] font-medium uppercase tracking-widest text-fg-3 mb-1.5'
  const selectStyle = { colorScheme: 'dark' } as React.CSSProperties
  const modalId = 'service-item-modal-title'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-l border border-line bg-bg-1 overflow-hidden">

        {/* Accent top bar */}
        <div className="h-0.5 w-full bg-accent" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <p className="nx-label">{t('catalog.modal.section')}</p>
            <h3 id={modalId} className="font-display text-base font-bold text-fg-1 mt-0.5">
              {isEdit ? t('catalog.modal.titleEdit') : t('catalog.modal.titleCreate')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('catalog.actions.cancel')}
            className="flex h-7 w-7 items-center justify-center rounded-s border border-line text-fg-3 hover:border-fg-1 hover:text-fg-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Section: Identifikation ── */}
          <div className="rounded-l border border-line bg-bg-2 p-4 space-y-4">
            <p className="nx-label text-accent">{t('catalog.sections.identification')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('catalog.fields.sapCode')}</label>
                <input
                  className={inputCls}
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="z.B. DGF_ACT_001"
                />
              </div>
              <div>
                <label className={labelCls}>{t('catalog.fields.unit')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.unit ?? ''}
                  onChange={(e) => set('unit', e.target.value || null)}
                >
                  <option value="">— keine —</option>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('catalog.fields.descDe')}</label>
              <input
                className={inputCls}
                value={form.description_de}
                onChange={(e) => set('description_de', e.target.value)}
                placeholder="Leistungsbeschreibung auf Deutsch"
              />
            </div>
            <div>
              <label className={labelCls}>{t('catalog.fields.descEs')}</label>
              <input
                className={inputCls}
                value={form.description_es ?? ''}
                onChange={(e) => set('description_es', e.target.value || null)}
                placeholder="Descripción en español (opcional)"
              />
            </div>
          </div>

          {/* ── Section: Preis & Reihenfolge ── */}
          <div className="rounded-l border border-line bg-bg-2 p-4 space-y-4">
            <p className="nx-label text-accent">{t('catalog.sections.priceOrder')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('catalog.fields.price')}</label>
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
                <label className={labelCls}>{t('catalog.fields.priceExternal')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.unit_price_external ?? ''}
                  onChange={(e) => set('unit_price_external', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('catalog.fields.displayOrder')}</label>
              <input
                type="number"
                step="1"
                className={inputCls}
                value={form.display_order}
                onChange={(e) => set('display_order', Number(e.target.value))}
              />
            </div>
          </div>

          {/* ── Section: Zuordnung ── */}
          <div className="rounded-l border border-line bg-bg-2 p-4 space-y-4">
            <p className="nx-label text-accent">{t('catalog.sections.assignment')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('catalog.fields.operator')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.operator_id ?? ''}
                  onChange={(e) => set('operator_id', e.target.value || null)}
                >
                  <option value="">— Global / Alle —</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('catalog.fields.client')}</label>
                <select
                  className={inputCls}
                  style={selectStyle}
                  value={form.client_id ?? ''}
                  onChange={(e) => set('client_id', e.target.value || null)}
                >
                  <option value="">— kein —</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('catalog.fields.detailForm')}</label>
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
            <label className={labelCls}>{t('catalog.fields.notes')}</label>
            <textarea
              rows={2}
              className={inputCls}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              placeholder="Interne Hinweise zum Artikel…"
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer rounded-s border border-line bg-bg-2 px-4 py-3 hover:border-accent/50 transition-colors">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span className="text-sm text-fg-1">{t('catalog.fields.itemActive')}</span>
              <span className="ml-auto text-xs text-fg-3">
                {form.active ? t('catalog.status.visibleInCatalog') : t('catalog.status.hidden')}
              </span>
            </label>
          )}

          {err && (
            <p role="alert" className="rounded-s border border-err/40 bg-err/10 px-4 py-2.5 text-sm text-err">
              {err}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-3 hover:text-fg-1 hover:border-fg-3 transition-colors"
            >
              {t('catalog.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-s bg-accent px-6 py-2 text-sm font-medium text-ink disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? t('catalog.actions.saving') : isEdit ? t('catalog.actions.save') : t('catalog.actions.create')}
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
  const dialogId = 'delete-dialog-title'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogId}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-l border border-line bg-bg-1 overflow-hidden">
        <div className="h-0.5 w-full bg-err" aria-hidden="true" />
        <div className="p-6 space-y-4">
          <div>
            <p className="nx-label text-err mb-1">{t('catalog.delete.warning')}</p>
            <h3 id={dialogId} className="font-display text-base font-bold text-fg-1">{t('catalog.delete.title')}</h3>
          </div>
          <div className="rounded-s border border-line bg-bg-2 px-4 py-3">
            <p className="font-mono text-sm font-semibold text-fg-1">{item.code}</p>
            <p className="text-xs text-fg-3 mt-0.5 line-clamp-1">{item.description_de}</p>
          </div>
          <p className="text-sm text-fg-2">{t('catalog.delete.confirm')}</p>
          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <button
              onClick={onCancel}
              className="rounded-s border border-line px-4 py-2 text-sm text-fg-3 hover:text-fg-1 hover:border-fg-3 transition-colors"
            >
              {t('catalog.actions.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="rounded-s bg-err px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {deleting ? t('catalog.delete.deleting') : t('catalog.delete.action')}
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

  const selectStyle = { colorScheme: 'dark' } as React.CSSProperties
  const hasFilters = Boolean(search || operatorFilter || clientFilter)

  return (
    <div>
      {/* Header */}
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('catalog.title')}</h2>
          <p className="nx-label mt-2 tabular-nums">
            {t('catalog.subtitleCount', { count: filtered.length })}
          </p>
        </div>
        <button
          onClick={() => setModalItem('new')}
          className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
        >
          <span aria-hidden="true">+</span>
          {t('catalog.newItem')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          placeholder={t('catalog.filter.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('catalog.filter.search')}
          className="rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          aria-label={t('catalog.filter.allOperators')}
          style={selectStyle}
          className="rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">{t('catalog.filter.allOperators')}</option>
          <option value="__null__">{t('catalog.filter.globalOperator')}</option>
          {visibleOperators.map((op) => (
            <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label={t('catalog.filter.allClients')}
          style={selectStyle}
          className="rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">{t('catalog.filter.allClients')}</option>
          {visibleClients.map((cl) => (
            <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 cursor-pointer hover:border-accent transition-colors">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <span>{t('catalog.filter.showInactive')}</span>
        </label>
      </div>

      {/* Table / states */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-l border border-line bg-bg-1 py-16 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-0">
            <FileText size={18} strokeWidth={1.5} className="text-fg-3" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-fg-1">{t('catalog.empty')}</p>
          <p className="mt-1 text-xs text-fg-3">
            {hasFilters
              ? 'Filter anpassen oder zurücksetzen.'
              : 'Neuen Artikel anlegen, um zu beginnen.'}
          </p>
          {!hasFilters && (
            <button
              onClick={() => setModalItem('new')}
              className="mt-4 rounded-s border border-line px-4 py-2 text-xs text-fg-2 hover:border-accent hover:text-accent transition-colors"
            >
              {t('catalog.newItem')}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-l border border-line bg-bg-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-2">
                <tr>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap">Code</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left">Beschreibung (DE)</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left hidden lg:table-cell">Descripción (ES)</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap">Einh.</th>
                  <th scope="col" className="nx-label px-3 py-3 text-right whitespace-nowrap">Preis</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap hidden md:table-cell">Form</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap hidden md:table-cell">Betreiber</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap hidden sm:table-cell">Kunde</th>
                  <th scope="col" className="nx-label px-3 py-3 text-left whitespace-nowrap">Status</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-line/50 transition-colors hover:bg-bg-2 ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-3 py-3 text-fg-1 max-w-xs">
                      <span className="line-clamp-2">{item.description_de}</span>
                    </td>
                    <td className="px-3 py-3 text-fg-3 max-w-xs hidden lg:table-cell">
                      {item.description_es
                        ? <span className="line-clamp-2">{item.description_es}</span>
                        : <span className="italic text-fg-4">—</span>}
                    </td>
                    <td className="px-3 py-3 text-fg-3 font-mono text-xs whitespace-nowrap">
                      {item.unit ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-1 whitespace-nowrap">
                      {fmtPrice(item.unit_price)}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {item.detail_form
                        ? <span className="rounded bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-fg-3 border border-line">{item.detail_form}</span>
                        : <span className="text-fg-4">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-fg-3 whitespace-nowrap hidden md:table-cell">
                      {item.operators?.code ?? <span className="italic text-fg-4">Global</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-fg-3 whitespace-nowrap hidden sm:table-cell">
                      {item.clients?.code ?? <span className="italic text-fg-4">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {item.active
                        ? <span className="inline-flex rounded-full bg-ok/15 px-2 py-0.5 text-xs font-medium text-ok">{t('catalog.status.active')}</span>
                        : <span className="inline-flex rounded-full bg-err/10 px-2 py-0.5 text-xs font-medium text-fg-3">{t('catalog.status.inactive')}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          aria-label={`${item.code} bearbeiten`}
                          onClick={() => setModalItem(item)}
                          className="rounded px-2 py-1 text-xs text-fg-3 hover:text-accent hover:bg-bg-0 transition-colors"
                        >
                          ✎
                        </button>
                        <button
                          aria-label={item.active ? `${item.code} deaktivieren` : `${item.code} aktivieren`}
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                          className="rounded px-2 py-1 text-xs text-fg-3 hover:text-warn hover:bg-bg-0 transition-colors disabled:opacity-40"
                        >
                          {togglingId === item.id
                            ? <span className="inline-block h-3 w-3 animate-spin rounded-full border border-line border-t-warn" aria-hidden="true" />
                            : item.active ? '⏸' : '▶'}
                        </button>
                        <button
                          aria-label={`${item.code} löschen`}
                          onClick={() => setDeleteTarget(item)}
                          className="rounded px-2 py-1 text-xs text-fg-3 hover:text-err hover:bg-bg-0 transition-colors"
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
