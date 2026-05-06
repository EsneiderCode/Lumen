import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react'
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

function fmtPrice(p: number | null, quoteLabel: string) {
  if (p == null) return <span className="mono">{quoteLabel}</span>
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
          unit_price_external: item.unit_price_external,
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
      unit_price_external: form.unit_price_external,
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

  return (
    <div
      className="modal-scrim"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-card">
        <div className="phead">
          <div>
            <h3 className="title">{isEdit ? t('serviceItems.modal.editTitle') : t('serviceItems.modal.createTitle')}</h3>
            <p className="m mt-1">{t('serviceItems.modal.category')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-g btn-sm icon-only"
            aria-label={t('serviceItems.modal.buttonClose')}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="form-section">
            <p className="m text-accent">
              {t('serviceItems.modal.sectionIdentification')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="input">
                <label>{t('serviceItems.modal.fieldCode')} *</label>
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder={t('serviceItems.modal.fieldCodePlaceholder')}
                />
              </div>
              <div className="input">
                <label>{t('serviceItems.modal.fieldUnit')}</label>
                <select
                  value={form.unit ?? ''}
                  onChange={(e) => set('unit', e.target.value || null)}
                >
                  <option value="">{t('serviceItems.modal.fieldUnitNone')}</option>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="input">
              <label>{t('serviceItems.modal.fieldDescDe')} *</label>
              <input
                value={form.description_de}
                onChange={(e) => set('description_de', e.target.value)}
                placeholder={t('serviceItems.modal.fieldDescDePlaceholder')}
              />
            </div>
            <div className="input">
              <label>{t('serviceItems.modal.fieldDescEs')}</label>
              <input
                value={form.description_es ?? ''}
                onChange={(e) => set('description_es', e.target.value || null)}
                placeholder={t('serviceItems.modal.fieldDescEsPlaceholder')}
              />
            </div>
          </div>

          <div className="form-section">
            <p className="m text-accent">
              {t('serviceItems.modal.sectionPrice')}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="input">
                <label>{t('serviceItems.modal.fieldPrice')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price ?? ''}
                  onChange={(e) => set('unit_price', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="input">
                <label>{t('serviceItems.modal.fieldExternalPrice')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price_external ?? ''}
                  onChange={(e) => set('unit_price_external', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="input">
                <label>{t('serviceItems.modal.fieldDisplayOrder')}</label>
                <input
                  type="number"
                  step="1"
                  value={form.display_order}
                  onChange={(e) => set('display_order', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="m text-accent">
              {t('serviceItems.modal.sectionAssignment')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="input">
                <label>{t('serviceItems.modal.fieldOperator')}</label>
                <select
                  value={form.operator_id ?? ''}
                  onChange={(e) => set('operator_id', e.target.value || null)}
                >
                  <option value="">{t('serviceItems.modal.fieldOperatorGlobal')}</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
                  ))}
                </select>
              </div>
              <div className="input">
                <label>{t('serviceItems.modal.fieldClient')}</label>
                <select
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
            <div className="input">
              <label>{t('serviceItems.modal.fieldDetailForm')}</label>
              <select
                value={form.detail_form ?? ''}
                onChange={(e) => set('detail_form', (e.target.value || null) as ServiceItemPayload['detail_form'])}
              >
                {DETAIL_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input">
            <label>{t('serviceItems.modal.fieldNotes')}</label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              placeholder={t('serviceItems.modal.fieldNotesPlaceholder')}
            />
          </div>

          {isEdit && (
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span>{t('serviceItems.modal.active')}</span>
              <span className="m ml-auto">
                {form.active ? t('serviceItems.modal.activeVisible') : t('serviceItems.modal.activeHidden')}
              </span>
            </label>
          )}

          {err && (
            <p className="notice notice-err">
              {err}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-g"
            >
              {t('serviceItems.modal.buttonCancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-p"
            >
              <Save size={15} strokeWidth={1.5} />
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
      className="modal-scrim centered"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal-card compact">
        <div className="p-6 space-y-4">
          <div>
            <p className="m text-err">{t('serviceItems.deleteDialog.warning')}</p>
            <h3 className="title mt-1">
              {t('serviceItems.deleteDialog.title')}
            </h3>
          </div>
          <div className="form-section">
            <p className="mono">{item.code}</p>
            <p className="mt-1 line-clamp-1 text-sm text-fg-2">{item.description_de}</p>
          </div>
          <p className="text-sm text-fg-2">
            {t('serviceItems.deleteDialog.body')}
          </p>
          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-g"
            >
              {t('serviceItems.deleteDialog.buttonCancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="btn btn-danger"
            >
              <Trash2 size={15} strokeWidth={1.5} />
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

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    const { data } = await fetchServiceItems({ includeInactive })
    setItems(data)
    setIsLoading(false)
  }, [includeInactive])

  useEffect(() => {
    // Initial/refilter data load is an external async sync point; ServiceItemsPage owns the loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false)
  }, [load])

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
    <div className="page-fade-in space-y-5 pb-8">
      <div className="ph">
        <div>
          <h1>{t('serviceItems.title')}</h1>
          <div className="sub">{t('serviceItems.subtitle', { count: filtered.length })}</div>
        </div>
        <div className="r">
          <button
            type="button"
            onClick={() => setModalItem('new')}
            className="btn btn-p"
          >
            <Plus size={16} strokeWidth={1.5} />
            {t('serviceItems.newItem')}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <h3 className="title">{t('serviceItems.modal.category')}</h3>
          <span className="m">{filtered.length}</span>
        </div>
        <div className="pbody">
          <div className="service-filter-grid">
            <div className="input">
              <label>{t('nav.search')}</label>
              <input
                type="text"
                placeholder={t('serviceItems.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="input">
              <label>{t('serviceItems.table.operator')}</label>
              <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
                <option value="">{t('serviceItems.filters.allOperators')}</option>
                <option value="__null__">{t('serviceItems.filters.globalNoOperator')}</option>
                {visibleOperators.map((op) => (
                  <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
                ))}
              </select>
            </div>
            <div className="input">
              <label>{t('serviceItems.table.client')}</label>
              <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                <option value="">{t('serviceItems.filters.allClients')}</option>
                {visibleClients.map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
                ))}
              </select>
            </div>
            <label className="toggle-row service-toggle">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <span>{t('serviceItems.filters.showInactive')}</span>
            </label>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="panel">
          <div className="pbody">
            <p className="m">[LOADING]</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <div className="pbody py-16 text-center">
            <p className="m">{t('serviceItems.table.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('serviceItems.table.code')}</th>
                  <th>{t('serviceItems.table.descriptionDe')}</th>
                  <th className="hidden lg:table-cell">{t('serviceItems.table.descriptionEs')}</th>
                  <th>{t('serviceItems.table.unit')}</th>
                  <th className="num">{t('serviceItems.table.price')}</th>
                  <th className="hidden md:table-cell">{t('serviceItems.table.form')}</th>
                  <th className="hidden md:table-cell">{t('serviceItems.table.operator')}</th>
                  <th className="hidden sm:table-cell">{t('serviceItems.table.client')}</th>
                  <th>{t('serviceItems.table.status')}</th>
                  <th className="num">{t('serviceItems.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={!item.active ? 'opacity-50' : ''}
                  >
                    <td className="mono text-accent">
                      {item.code}
                    </td>
                    <td className="service-desc">
                      <span className="line-clamp-2">{item.description_de}</span>
                    </td>
                    <td className="service-desc hidden lg:table-cell">
                      {item.description_es
                        ? <span className="line-clamp-2">{item.description_es}</span>
                        : <span className="mono">—</span>}
                    </td>
                    <td className="mono">
                      {item.unit ?? '—'}
                    </td>
                    <td className="num">
                      {fmtPrice(item.unit_price, t('serviceItems.table.quote'))}
                    </td>
                    <td className="hidden md:table-cell">
                      {item.detail_form
                        ? <span className="badge badge-neutral">{item.detail_form}</span>
                        : <span className="mono">—</span>}
                    </td>
                    <td className="mono hidden md:table-cell">
                      {item.operators?.code ?? <span>{t('serviceItems.table.global')}</span>}
                    </td>
                    <td className="mono hidden sm:table-cell">
                      {item.clients?.code ?? <span>—</span>}
                    </td>
                    <td>
                      {item.active
                        ? <span className="badge badge-ok badge-dot">{t('serviceItems.table.active')}</span>
                        : <span className="badge badge-neutral">{t('serviceItems.table.inactive')}</span>}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={t('serviceItems.table.edit')}
                          onClick={() => setModalItem(item)}
                          className="btn btn-g btn-sm icon-only"
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          title={item.active ? t('serviceItems.table.deactivate') : t('serviceItems.table.activate')}
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                          className="btn btn-g btn-sm icon-only"
                        >
                          {item.active ? <X size={14} strokeWidth={1.5} /> : <Play size={14} strokeWidth={1.5} />}
                        </button>
                        <button
                          type="button"
                          title={t('serviceItems.table.delete')}
                          onClick={() => setDeleteTarget(item)}
                          className="btn btn-danger btn-sm icon-only"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
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
