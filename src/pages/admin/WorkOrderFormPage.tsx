import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  fetchClients,
  fetchProjects,
  fetchOperators,
  upsertWorkOrderDetail,
  fetchWorkOrderDetail,
  workTypeToDetailTable,
  saveAssignedDetailSnapshot,
} from '@/services/workOrderService'
import type { WorkType } from '@/types/enums'
import { WORK_TYPE_LABELS } from '@/constants/labels'
import { DETAIL_FIELDS } from '@/constants/detail-fields'
import { fetchServiceItems } from '@/services/serviceItemService'
import type { ServiceItemWithRelations } from '@/types/service-items'

// Map service-item detail_form -> legacy work_type enum value used by
// wo_detail_* tables. 'pop' is a new category with no legacy detail table
// yet, so it is rendered with a generic detail shape (alta-style).
const DETAIL_FORM_TO_WORK_TYPE: Record<string, WorkType> = {
  soplado:    'soplado',
  fusion_ap:  'fusion_ap',
  fusion_dp:  'fusion_dp',
  alta:       'alta',
  nt:         'nt_installation',
  patchkabel: 'patchkabel',
  pop:        'alta', // TODO: introduce wo_detail_pop once field set is defined
}

// ── Form ─────────────────────────────────────────────────────

interface FormValues {
  client_id: string
  project_id: string
  operator_id: string
  line: string
  work_type: WorkType | ''
  service_item_id: string
  priority: 'normal' | 'alta' | 'urgente'
  address: string
  postal_code: string
  city: string
  internal_notes: string
}

const EMPTY_FORM: FormValues = {
  client_id: '',
  project_id: '',
  operator_id: '',
  line: 'NE3',
  work_type: '',
  service_item_id: '',
  priority: 'normal',
  address: '',
  postal_code: '',
  city: '',
  internal_notes: '',
}

export function WorkOrderFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; code: string; client_id: string | null }[]>([])
  const [operators, setOperators] = useState<{ id: string; name: string; code: string }[]>([])
  const [serviceItems, setServiceItems] = useState<ServiceItemWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load lookups
  useEffect(() => {
    fetchClients().then(({ data }) => setClients(data))
    fetchOperators().then(({ data }) => setOperators(data))
    fetchProjects().then(({ data }) => setProjects(data))
  }, [])

  // Load service items scoped to the selected operator (global items
  // always included; operator-specific items merge in when operator is set).
  useEffect(() => {
    const operatorId = form.operator_id || undefined
    fetchServiceItems({ operatorId: operatorId ?? null }).then(({ data }) => {
      // When no operator is selected we show all active items, not just globals,
      // so the admin can pick before picking operator if needed.
      if (!operatorId) {
        fetchServiceItems().then(({ data: allData }) => setServiceItems(allData))
      } else {
        setServiceItems(data)
      }
    })
  }, [form.operator_id])

  // Load existing order for edit
  useEffect(() => {
    if (!isEdit || !id) return
    fetchWorkOrder(id).then(async ({ data, error }) => {
      if (error || !data) { setSaveError(error ?? 'Auftrag nicht gefunden'); setIsLoading(false); return }
      setForm({
        client_id: data.client_id,
        project_id: data.project_id,
        operator_id: data.operator_id,
        line: data.line,
        work_type: data.work_type,
        service_item_id: (data as { service_item_id?: string | null }).service_item_id ?? '',
        priority: data.priority,
        address: data.address ?? '',
        postal_code: data.postal_code ?? '',
        city: data.city ?? '',
        internal_notes: data.internal_notes ?? '',
      })
      // Load detail
      const table = workTypeToDetailTable(data.work_type)
      const { data: detailData } = await fetchWorkOrderDetail(table, id)
      if (detailData) {
        const { id: _id, work_order_id: _woid, created_at: _ca, ...rest } = detailData as Record<string, unknown>
        void _id; void _woid; void _ca
        setDetail(rest)
      }
      setIsLoading(false)
    })
  }, [id, isEdit])

  // Filtered projects by selected client
  const filteredProjects = form.client_id
    ? projects.filter((p) => p.client_id === form.client_id)
    : projects

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    if (key === 'client_id') setForm((f) => ({ ...f, client_id: value as string, project_id: '' }))
  }

  function setDetailField(key: string, value: unknown) {
    setDetail((d) => ({ ...d, [key]: value }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormValues, string>> = {}
    if (!form.client_id) e.client_id = 'Pflichtfeld'
    if (!form.project_id) e.project_id = 'Pflichtfeld'
    if (!form.operator_id) e.operator_id = 'Pflichtfeld'
    if (!form.service_item_id) e.service_item_id = 'Pflichtfeld'
    if (!form.work_type) e.work_type = 'Pflichtfeld'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !user) return
    if (!form.work_type) return

    setIsSaving(true)
    setSaveError(null)

    const payload = {
      client_id: form.client_id,
      project_id: form.project_id,
      operator_id: form.operator_id,
      line: form.line,
      work_type: form.work_type,
      service_item_id: form.service_item_id || null,
      priority: form.priority,
      address: form.address || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      internal_notes: form.internal_notes || null,
    }

    let orderId = id
    if (isEdit && id) {
      const { error } = await updateWorkOrder(id, payload)
      if (error) { setSaveError(error); setIsSaving(false); return }
    } else {
      const { data, error } = await createWorkOrder(payload, user.id)
      if (error || !data) { setSaveError(error ?? 'Fehler'); setIsSaving(false); return }
      orderId = data.id
    }

    // Upsert detail
    if (orderId && Object.keys(detail).length > 0) {
      const table = workTypeToDetailTable(form.work_type)
      await upsertWorkOrderDetail(table, orderId, detail)
      // LUM-023: on creation only, save admin's assigned values as immutable snapshot
      if (!isEdit) {
        await saveAssignedDetailSnapshot(orderId, detail)
      }
    }

    navigate('/admin/orders')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
      </div>
    )
  }

  const detailFields = form.work_type ? DETAIL_FIELDS[form.work_type] : []

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-gf-btn border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-xl font-bold text-gf-text">
            {isEdit ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}
          </h2>
          {isEdit && <p className="text-sm text-gf-text-muted">ID: {id}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Core info card */}
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Allgemeine Daten</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Client */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Kunde <span className="text-gf-danger">*</span>
              </label>
              <select
                value={form.client_id}
                onChange={(e) => setField('client_id', e.target.value)}
                className={`w-full rounded-gf-btn border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.client_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
              >
                <option value="">— Kunde wählen —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
              {errors.client_id && <p className="mt-1 text-xs text-gf-danger">{errors.client_id}</p>}
            </div>

            {/* Project */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Projekt <span className="text-gf-danger">*</span>
              </label>
              <select
                value={form.project_id}
                onChange={(e) => setField('project_id', e.target.value)}
                className={`w-full rounded-gf-btn border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.project_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
              >
                <option value="">— Projekt wählen —</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                ))}
              </select>
              {errors.project_id && <p className="mt-1 text-xs text-gf-danger">{errors.project_id}</p>}
            </div>

            {/* Operator */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Betreiber <span className="text-gf-danger">*</span>
              </label>
              <select
                value={form.operator_id}
                onChange={(e) => setField('operator_id', e.target.value)}
                className={`w-full rounded-gf-btn border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.operator_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
              >
                <option value="">— Betreiber wählen —</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                ))}
              </select>
              {errors.operator_id && <p className="mt-1 text-xs text-gf-danger">{errors.operator_id}</p>}
            </div>

            {/* Line */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Linie</label>
              <select
                value={form.line}
                onChange={(e) => setField('line', e.target.value)}
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary"
              >
                <option value="NE3">NE3</option>
                <option value="NE4">NE4</option>
              </select>
            </div>

            {/* Service item — canonical catalog selector.
                Driven by the operator's rate-card; selecting an item sets
                both service_item_id (for invoicing) and work_type (for the
                wo_detail_* shape). */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Leistung (Katalog) <span className="text-gf-danger">*</span>
              </label>
              <select
                value={form.service_item_id}
                onChange={(e) => {
                  const selectedId = e.target.value
                  const selected = serviceItems.find((si) => si.id === selectedId) ?? null
                  const derivedWorkType = selected?.detail_form
                    ? DETAIL_FORM_TO_WORK_TYPE[selected.detail_form]
                    : ''
                  setForm((f) => ({
                    ...f,
                    service_item_id: selectedId,
                    work_type: derivedWorkType as WorkType | '',
                  }))
                  setErrors((er) => ({ ...er, service_item_id: undefined, work_type: undefined }))
                  setDetail({})
                }}
                className={`w-full rounded-gf-btn border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.service_item_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
              >
                <option value="">— Leistung aus Katalog wählen —</option>
                {serviceItems.map((si) => (
                  <option key={si.id} value={si.id}>
                    {si.code} — {si.description_de}
                  </option>
                ))}
              </select>
              {form.service_item_id && (() => {
                const selected = serviceItems.find((si) => si.id === form.service_item_id)
                if (!selected) return null
                return (
                  <div className="mt-2 rounded-gf-btn border border-gf-primary/20 bg-gf-primary/5 p-2 text-xs text-gf-text-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-gf-primary">{selected.code}</span>
                      {selected.unit && <span>· {selected.unit}</span>}
                      {selected.unit_price != null && (
                        <span>· {selected.unit_price.toFixed(2)} €</span>
                      )}
                      {selected.operators?.code && <span>· {selected.operators.code}</span>}
                    </div>
                    {selected.description_es && (
                      <p className="mt-1 italic">ES: {selected.description_es}</p>
                    )}
                  </div>
                )
              })()}
              {errors.service_item_id && <p className="mt-1 text-xs text-gf-danger">{errors.service_item_id}</p>}
            </div>

            {/* Legacy work_type — derived, kept for backwards compat with
                existing wo_detail_* tables. Shown read-only so admins see
                which detail form the catalog item routes to. */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Arbeitstyp (abgeleitet aus Katalog)
              </label>
              <input
                type="text"
                value={form.work_type ? (WORK_TYPE_LABELS[form.work_type as WorkType] ?? form.work_type) : '—'}
                readOnly
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface/50 px-3 py-2 text-sm text-gf-text-muted"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Priorität</label>
              <select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as 'normal' | 'alta' | 'urgente')}
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary"
              >
                <option value="normal">Normal</option>
                <option value="alta">Hoch</option>
                <option value="urgente">Dringend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address card */}
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Adresse</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Straße / Hausnummer</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Musterstraße 12"
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">PLZ</label>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => setField('postal_code', e.target.value)}
                placeholder="10115"
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Stadt</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Berlin"
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
          </div>
        </div>

        {/* Dynamic detail fields */}
        {detailFields.length > 0 && (
          <div className="rounded-gf-card border border-gf-primary/30 bg-gf-card p-5">
            <h3 className="mb-1 font-display text-sm font-semibold text-gf-text">
              Details: {WORK_TYPE_LABELS[form.work_type as WorkType]}
            </h3>
            <p className="mb-4 text-xs text-gf-text-muted">Arbeitstyp-spezifische Felder</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {detailFields.map((field) => (
                <div key={field.key} className={field.type === 'checkbox' ? 'flex items-center gap-2 sm:col-span-2' : ''}>
                  {field.type === 'checkbox' ? (
                    <>
                      <input
                        type="checkbox"
                        id={field.key}
                        checked={Boolean(detail[field.key])}
                        onChange={(e) => setDetailField(field.key, e.target.checked)}
                        className="h-4 w-4 rounded border-gf-border text-gf-primary focus:ring-gf-primary"
                      />
                      <label htmlFor={field.key} className="text-sm font-medium text-gf-text cursor-pointer">
                        {field.label}
                      </label>
                    </>
                  ) : field.type === 'select' ? (
                    <>
                      <label className="mb-1 block text-xs font-medium text-gf-text-muted">{field.label}</label>
                      <select
                        value={String(detail[field.key] ?? '')}
                        onChange={(e) => setDetailField(field.key, e.target.value)}
                        className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
                      >
                        <option value="">— wählen —</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium text-gf-text-muted">{field.label}</label>
                      <input
                        type={field.type}
                        value={String(detail[field.key] ?? '')}
                        onChange={(e) =>
                          setDetailField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <label className="mb-1 block text-xs font-medium text-gf-text-muted">Interne Notizen</label>
          <textarea
            value={form.internal_notes}
            onChange={(e) => setField('internal_notes', e.target.value)}
            rows={3}
            placeholder="Interne Hinweise für das Team…"
            className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary resize-none"
          />
        </div>

        {/* Save error */}
        {saveError && (
          <div className="rounded-gf-btn border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex-1 rounded-gf-btn border border-gf-border px-4 py-2.5 text-sm font-medium text-gf-text hover:bg-gf-surface transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-gf-btn bg-gf-primary px-4 py-2.5 text-sm font-semibold text-gf-base hover:bg-gf-primary-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Speichern…' : isEdit ? 'Änderungen speichern' : 'Auftrag erstellen'}
          </button>
        </div>
      </form>
    </div>
  )
}
