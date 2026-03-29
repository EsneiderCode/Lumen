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
} from '@/services/workOrderService'
import type { WorkType } from '@/types/enums'

// ── Per-work-type detail field configs ────────────────────────

interface DetailField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox'
  options?: string[]
  placeholder?: string
}

const DETAIL_FIELDS: Record<WorkType, DetailField[]> = {
  soplado: [
    { key: 'meters', label: 'Meter', type: 'number', placeholder: '0' },
    { key: 'section', label: 'Abschnitt', type: 'text', placeholder: 'z.B. A1-B3' },
    { key: 'tube_diameter', label: 'Rohrdurchmesser', type: 'text', placeholder: 'z.B. 7/3.5' },
    { key: 'result', label: 'Ergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
  fusion_ap: [
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll vorhanden', type: 'checkbox' },
  ],
  fusion_dp: [
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll vorhanden', type: 'checkbox' },
  ],
  alta: [
    {
      key: 'access_type',
      label: 'Zugangstyp',
      type: 'select',
      options: ['Keller', 'Erdgeschoss', 'Obergeschoss', 'Dach', 'Außen'],
    },
    { key: 'equipment_installed', label: 'Eingebaute Geräte', type: 'text', placeholder: 'z.B. NT-100, Splitter' },
    { key: 'client_signature', label: 'Kundenunterschrift vorhanden', type: 'checkbox' },
  ],
  nt_installation: [
    {
      key: 'nt_type',
      label: 'NT-Typ',
      type: 'select',
      options: ['NT-100', 'NT-200', 'NT-300', 'ONT', 'ONU'],
    },
    { key: 'serial_number', label: 'Seriennummer', type: 'text', placeholder: 'SN-XXXXXXXX' },
    { key: 'location', label: 'Standort', type: 'text', placeholder: 'z.B. Keller Raum 1' },
    { key: 'configuration', label: 'Konfiguration', type: 'text', placeholder: 'VLAN, IP…' },
  ],
  patchkabel: [
    { key: 'connected_section', label: 'Verbundener Abschnitt', type: 'text', placeholder: 'z.B. ODF-1 → ODF-2' },
    { key: 'cable_length', label: 'Kabellänge (m)', type: 'number', placeholder: '0' },
    {
      key: 'connector_type',
      label: 'Steckertyp',
      type: 'select',
      options: ['SC/APC', 'SC/UPC', 'LC/APC', 'LC/UPC', 'FC/APC'],
    },
    { key: 'test_result', label: 'Testergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  soplado: 'Soplado (Blasen)',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta / Installation',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

// ── Form ─────────────────────────────────────────────────────

interface FormValues {
  client_id: string
  project_id: string
  operator_id: string
  line: string
  work_type: WorkType | ''
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
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
        <div className="rounded-xl border border-gf-border bg-gf-card p-5">
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
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.client_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
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
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.project_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
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
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.operator_id ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
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
                className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary"
              >
                <option value="NE3">NE3</option>
                <option value="NE4">NE4</option>
              </select>
            </div>

            {/* Work type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">
                Arbeitstyp <span className="text-gf-danger">*</span>
              </label>
              <select
                value={form.work_type}
                onChange={(e) => { setField('work_type', e.target.value as WorkType); setDetail({}) }}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary ${errors.work_type ? 'border-gf-danger bg-gf-danger/5' : 'border-gf-border bg-gf-surface'}`}
              >
                <option value="">— Typ wählen —</option>
                {Object.entries(WORK_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {errors.work_type && <p className="mt-1 text-xs text-gf-danger">{errors.work_type}</p>}
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Priorität</label>
              <select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as 'normal' | 'alta' | 'urgente')}
                className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:outline-none focus:ring-1 focus:ring-gf-primary"
              >
                <option value="normal">Normal</option>
                <option value="alta">Hoch</option>
                <option value="urgente">Dringend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address card */}
        <div className="rounded-xl border border-gf-border bg-gf-card p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Adresse</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Straße / Hausnummer</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Musterstraße 12"
                className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">PLZ</label>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => setField('postal_code', e.target.value)}
                placeholder="10115"
                className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gf-text-muted">Stadt</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Berlin"
                className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
              />
            </div>
          </div>
        </div>

        {/* Dynamic detail fields */}
        {detailFields.length > 0 && (
          <div className="rounded-xl border border-gf-primary/30 bg-gf-card p-5">
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
                        className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
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
                        className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="rounded-xl border border-gf-border bg-gf-card p-5">
          <label className="mb-1 block text-xs font-medium text-gf-text-muted">Interne Notizen</label>
          <textarea
            value={form.internal_notes}
            onChange={(e) => setField('internal_notes', e.target.value)}
            rows={3}
            placeholder="Interne Hinweise für das Team…"
            className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary resize-none"
          />
        </div>

        {/* Save error */}
        {saveError && (
          <div className="rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex-1 rounded-lg border border-gf-border px-4 py-2.5 text-sm font-medium text-gf-text hover:bg-gf-surface transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-gf-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gf-primary-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Speichern…' : isEdit ? 'Änderungen speichern' : 'Auftrag erstellen'}
          </button>
        </div>
      </form>
    </div>
  )
}
