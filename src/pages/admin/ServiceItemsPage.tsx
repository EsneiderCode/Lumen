import { useEffect, useState } from 'react'
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
      setErr('Code und Deutsche Beschreibung sind Pflichtfelder.')
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
    'w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary'
  const labelCls = 'block text-xs font-medium text-gf-text-muted mb-1'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-gf-card border border-gf-border bg-gf-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gf-border px-6 py-4">
          <h3 className="font-display text-base font-bold text-gf-text">
            {isEdit ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </h3>
          <button
            onClick={onClose}
            className="text-gf-text-muted hover:text-gf-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row: Code + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SAP-Code *</label>
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="z.B. DGF_ACT_001"
              />
            </div>
            <div>
              <label className={labelCls}>Einheit</label>
              <select
                className={inputCls}
                value={form.unit ?? ''}
                onChange={(e) => set('unit', e.target.value || null)}
              >
                <option value="">— keine —</option>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Description DE */}
          <div>
            <label className={labelCls}>Beschreibung (DE) *</label>
            <input
              className={inputCls}
              value={form.description_de}
              onChange={(e) => set('description_de', e.target.value)}
              placeholder="Leistungsbeschreibung auf Deutsch"
            />
          </div>

          {/* Description ES */}
          <div>
            <label className={labelCls}>Descripción (ES)</label>
            <input
              className={inputCls}
              value={form.description_es ?? ''}
              onChange={(e) => set('description_es', e.target.value || null)}
              placeholder="Descripción en español (opcional)"
            />
          </div>

          {/* Row: Price + Display order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Preis (€ netto) — leer = Nach Angebot</label>
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
              <label className={labelCls}>Anzeigereihenfolge</label>
              <input
                type="number"
                step="1"
                className={inputCls}
                value={form.display_order}
                onChange={(e) => set('display_order', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Row: Operator + Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Betreiber (Operator)</label>
              <select
                className={inputCls}
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
              <label className={labelCls}>Kunde (Client)</label>
              <select
                className={inputCls}
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

          {/* Detail form */}
          <div>
            <label className={labelCls}>Detail-Formular (technische Route)</label>
            <select
              className={inputCls}
              value={form.detail_form ?? ''}
              onChange={(e) => set('detail_form', (e.target.value || null) as ServiceItemPayload['detail_form'])}
            >
              {DETAIL_FORM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notizen</label>
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span className="text-sm text-gf-text">Artikel aktiv</span>
            </label>
          )}

          {err && (
            <p className="rounded-gf-btn border border-gf-accent/30 bg-gf-accent-light px-3 py-2 text-sm text-gf-accent">
              {err}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gf-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm text-gf-text-muted hover:text-gf-text transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-gf-btn bg-gf-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? '[SPEICHERN…]' : isEdit ? 'Speichern' : 'Erstellen'}
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-gf-card border border-gf-border bg-gf-card p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-gf-text">Artikel löschen</h3>
        <p className="text-sm text-gf-text-muted">
          Soll <span className="font-mono text-gf-text">{item.code}</span> dauerhaft gelöscht werden?
          Diese Aktion ist nicht rückgängig zu machen.
        </p>
        <div className="flex justify-end gap-3 pt-2 border-t border-gf-border">
          <button
            onClick={onCancel}
            className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm text-gf-text-muted hover:text-gf-text transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-gf-btn bg-gf-danger px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {deleting ? '[LÖSCHEN…]' : 'Endgültig löschen'}
          </button>
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
          <h2 className="font-display text-xl font-bold text-gf-text">Service-Katalog</h2>
          <p className="text-sm text-gf-text-muted">
            {filtered.length} Artikel — Vertragliche Leistungscodes
          </p>
        </div>
        <button
          onClick={() => setModalItem('new')}
          className="rounded-gf-btn bg-gf-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          + Neuer Artikel
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Suchen (Code, Beschreibung)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        />
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        >
          <option value="">Alle Betreiber</option>
          <option value="__null__">— Global (kein Betreiber)</option>
          {visibleOperators.map((op) => (
            <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
        >
          <option value="">Alle Kunden</option>
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
          <span>Inaktive anzeigen</span>
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
          <p className="mt-2 text-sm font-medium text-gf-text">Keine Artikel gefunden</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-gf-card border border-gf-border bg-gf-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gf-border bg-gf-surface">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted">Beschreibung (DE)</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted hidden lg:table-cell">Descripción (ES)</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">Einh.</th>
                  <th className="px-3 py-2 text-right font-medium text-gf-text-muted whitespace-nowrap">Preis</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden md:table-cell">Form</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden md:table-cell">Betreiber</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap hidden sm:table-cell">Kunde</th>
                  <th className="px-3 py-2 text-left font-medium text-gf-text-muted whitespace-nowrap">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-gf-text-muted whitespace-nowrap">Aktionen</th>
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
                      {item.operators?.code ?? <span className="italic text-gf-text-placeholder">Global</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gf-text-muted whitespace-nowrap hidden sm:table-cell">
                      {item.clients?.code ?? <span className="italic text-gf-text-placeholder">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {item.active
                        ? <span className="inline-flex rounded-full bg-gf-success/15 px-2 py-0.5 text-xs font-medium text-emerald-700">Aktiv</span>
                        : <span className="inline-flex rounded-full bg-gf-danger/10 px-2 py-0.5 text-xs font-medium text-gf-text-muted">Inaktiv</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit */}
                        <button
                          title="Bearbeiten"
                          onClick={() => setModalItem(item)}
                          className="rounded px-2 py-1 text-xs text-gf-text-muted hover:text-gf-primary hover:bg-gf-surface transition-colors"
                        >
                          ✎
                        </button>
                        {/* Toggle active */}
                        <button
                          title={item.active ? 'Deaktivieren' : 'Aktivieren'}
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                          className="rounded px-2 py-1 text-xs text-gf-text-muted hover:text-gf-warning hover:bg-gf-surface transition-colors disabled:opacity-40"
                        >
                          {item.active ? '⏸' : '▶'}
                        </button>
                        {/* Delete */}
                        <button
                          title="Löschen"
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
