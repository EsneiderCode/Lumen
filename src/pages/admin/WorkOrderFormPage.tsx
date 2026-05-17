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
import { useLabels } from '@/i18n/labels'
import { useTranslation } from 'react-i18next'
import { DETAIL_FIELDS } from '@/constants/detail-fields'
import { fetchServiceItems } from '@/services/serviceItemService'
import type { ServiceItemWithRelations } from '@/types/service-items'
import { DocumentUploader } from '@/components/ui/DocumentUploader'
import { uploadWorkOrderDocument } from '@/services/workOrderDocumentService'
import type { DocumentType } from '@/types/work-order-documents'

// Catalog detail_form values for infrastructure work (trenches, splice
// boxes, POP central sites) rather than street-address-based customer
// installations. For these we hide the address card and show the
// supporting-document uploaders. We key on detail_form from the service
// catalog — not the legacy work_type enum — so the UI can split per
// catalog class even if multiple classes share a work_type.
const INFRA_DETAIL_FORMS = new Set(['soplado', 'fusion_ap', 'fusion_dp', 'pop'])

// detail_form -> document types the admin should attach when creating
// the order. Soplado/fusion carry plano (input) + cartas de empalme
// (splice output). POP carries the routing-pipe diagram.
const DOCUMENT_TYPES_BY_DETAIL_FORM: Record<string, Array<{
  type: 'plano' | 'cartas_empalme' | 'diagrama_routing'
  label: string
  hint: string
}>> = {
  soplado: [
    { type: 'plano',          label: 'Plan / Trassenplan',                       hint: 'PDF oder Excel' },
    { type: 'cartas_empalme', label: 'Spleißprotokolle (Cartas de empalme)',     hint: 'PDF oder Excel' },
  ],
  fusion_ap: [
    { type: 'plano',          label: 'Plan / Trassenplan',                       hint: 'PDF oder Excel' },
    { type: 'cartas_empalme', label: 'Spleißprotokolle (Cartas de empalme)',     hint: 'PDF oder Excel' },
  ],
  fusion_dp: [
    { type: 'plano',          label: 'Plan / Trassenplan',                       hint: 'PDF oder Excel' },
    { type: 'cartas_empalme', label: 'Spleißprotokolle (Cartas de empalme)',     hint: 'PDF oder Excel' },
  ],
  pop: [
    { type: 'diagrama_routing', label: 'Diagramm Routing-Pipes',                 hint: 'PDF, Excel oder Bild' },
  ],
}

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
  pop:        'pop',
}

// ── Form ─────────────────────────────────────────────────────

interface FormValues {
  is_direct_order: boolean
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
  is_direct_order: false,
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
  const { t } = useTranslation()
  const L = useLabels()
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

  // Staged documents — collected locally on new orders, uploaded after
  // the order is created and we have an id to attach them to.
  const [stagedDocs, setStagedDocs] = useState<Record<DocumentType, File[]>>({
    plano: [],
    cartas_empalme: [],
    diagrama_routing: [],
    other: [],
  })

  // Load lookups
  useEffect(() => {
    fetchClients().then(({ data }) => setClients(data))
    fetchOperators().then(({ data }) => setOperators(data))
    fetchProjects().then(({ data }) => setProjects(data))
  }, [])

  // Load service items scoped to the selected operator (global items
  // always included; operator-specific items merge in when operator is set).
  // Admin form uses includePrices:true to query service_items directly,
  // avoiding the dependency on the service_items_public view.
  useEffect(() => {
    const operatorId = form.operator_id || undefined
    const opts = { includePrices: true as const, operatorId: operatorId ?? undefined }
    fetchServiceItems(opts).then(({ data }) => setServiceItems(data))
  }, [form.operator_id])

  // Load existing order for edit
  useEffect(() => {
    if (!isEdit || !id) return
    fetchWorkOrder(id).then(async ({ data, error }) => {
      if (error || !data) { setSaveError(error ?? 'Auftrag nicht gefunden'); setIsLoading(false); return }
      setForm({
        is_direct_order: data.client_id == null,
        client_id: data.client_id ?? '',
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
    // Direktauftrag: client_id is intentionally null. Project + operator stay required
    // (orders still belong to a project and an operator even when there is no external client).
    if (!form.is_direct_order && !form.client_id) e.client_id = t('common.required')
    if (!form.project_id) e.project_id = t('common.required')
    if (!form.operator_id) e.operator_id = t('common.required')
    if (!form.service_item_id) e.service_item_id = t('common.required')
    if (!form.work_type) e.work_type = t('common.required')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (!user) {
      setSaveError(t('errors.sessionExpired'))
      return
    }
    if (!form.work_type) return

    setIsSaving(true)
    setSaveError(null)

    const payload = {
      // Direct order = client_id IS NULL (per migration 005). DB FK is nullable.
      client_id: form.is_direct_order ? null : form.client_id,
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

    // Upload any staged supporting documents now that we have an order id
    if (orderId && user) {
      const allStaged: Array<[DocumentType, File]> = []
      for (const [type, files] of Object.entries(stagedDocs) as Array<[DocumentType, File[]]>) {
        for (const file of files) allStaged.push([type, file])
      }
      if (allStaged.length > 0) {
        const uploadErrors: string[] = []
        for (const [type, file] of allStaged) {
          const { error: upErr } = await uploadWorkOrderDocument(orderId, type, file, user.id)
          if (upErr) uploadErrors.push(`${file.name}: ${upErr}`)
        }
        if (uploadErrors.length > 0) {
          // Order + detail saved, but some docs failed. Let the admin know,
          // keep them on the page so they can retry or continue.
          setSaveError(`Auftrag gespeichert, aber Upload-Fehler:\n${uploadErrors.join('\n')}`)
          setIsSaving(false)
          // Clear the successfully uploaded staged files so retry uploads
          // the remaining ones cleanly — simplest: clear all and let the
          // admin view the detail page for the partial state.
          setStagedDocs({ plano: [], cartas_empalme: [], diagrama_routing: [], other: [] })
          return
        }
      }
    }

    navigate('/admin/orders')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  // Resolve the selected catalog item and its detail_form — this drives
  // the UI shape (address visibility, detail fields, uploader visibility).
  const selectedServiceItem = serviceItems.find((si) => si.id === form.service_item_id) ?? null
  const selectedDetailForm = selectedServiceItem?.detail_form ?? null
  const isInfra = selectedDetailForm ? INFRA_DETAIL_FORMS.has(selectedDetailForm) : false
  const documentTypes = selectedDetailForm ? DOCUMENT_TYPES_BY_DETAIL_FORM[selectedDetailForm] ?? [] : []

  const detailFields = form.work_type ? DETAIL_FIELDS[form.work_type] ?? [] : []

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-xl font-bold text-fg-1">
            {isEdit ? t('workOrder.editTitle') : t('workOrder.newOrder')}
          </h2>
          {isEdit && <p className="text-sm text-fg-2">ID: {id}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Core info card */}
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-fg-1">{t('workOrder.generalData')}</h3>

          {/* Direct order toggle — when checked, client_id is NULL on save */}
          <label className="mb-4 flex items-start gap-3 cursor-pointer rounded-s border border-line bg-bg-0 p-3 hover:border-accent/50 transition-colors">
            <input
              type="checkbox"
              checked={form.is_direct_order}
              onChange={(e) => setField('is_direct_order', e.target.checked)}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <div className="text-sm">
              <div className="font-medium text-fg-1">{t('workOrder.directOrder')}</div>
              <div className="text-xs text-fg-2 mt-0.5">
                {t('workOrder.directOrderDesc')}
              </div>
            </div>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Client (hidden when direct order) */}
            {!form.is_direct_order && (
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-2">
                  {t('workOrder.customer')} <span className="text-err">*</span>
                </label>
                <select
                  value={form.client_id}
                  onChange={(e) => setField('client_id', e.target.value)}
                  className={`w-full rounded-s border px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent ${errors.client_id ? 'border-err bg-err/5' : 'border-line bg-bg-0'}`}
                >
                  <option value="">{t('workOrder.chooseClient')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                {errors.client_id && <p className="mt-1 text-xs text-err">{errors.client_id}</p>}
              </div>
            )}

            {/* Project */}
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('workOrder.project')} <span className="text-err">*</span>
              </label>
              <select
                value={form.project_id}
                onChange={(e) => setField('project_id', e.target.value)}
                className={`w-full rounded-s border px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent ${errors.project_id ? 'border-err bg-err/5' : 'border-line bg-bg-0'}`}
              >
                <option value="">{t('workOrder.chooseProject')}</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                ))}
              </select>
              {errors.project_id && <p className="mt-1 text-xs text-err">{errors.project_id}</p>}
            </div>

            {/* Operator */}
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('workOrder.operator')} <span className="text-err">*</span>
              </label>
              <select
                value={form.operator_id}
                onChange={(e) => setField('operator_id', e.target.value)}
                className={`w-full rounded-s border px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent ${errors.operator_id ? 'border-err bg-err/5' : 'border-line bg-bg-0'}`}
              >
                <option value="">{t('workOrder.chooseOperator')}</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                ))}
              </select>
              {errors.operator_id && <p className="mt-1 text-xs text-err">{errors.operator_id}</p>}
            </div>

            {/* Line */}
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.line')}</label>
              <select
                value={form.line}
                onChange={(e) => setField('line', e.target.value)}
                className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent"
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
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('workOrder.serviceItem')} <span className="text-err">*</span>
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
                className={`w-full rounded-s border px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent ${errors.service_item_id ? 'border-err bg-err/5' : 'border-line bg-bg-0'}`}
              >
                <option value="">{t('workOrder.chooseServiceItem')}</option>
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
                  <div className="mt-2 rounded-s border border-accent/20 bg-accent/5 p-2 text-xs text-fg-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-accent">{selected.code}</span>
                      {selected.unit && <span>· {selected.unit}</span>}
                      {selected.operators?.code && <span>· {selected.operators.code}</span>}
                    </div>
                    {selected.description_es && (
                      <p className="mt-1 italic">ES: {selected.description_es}</p>
                    )}
                  </div>
                )
              })()}
              {errors.service_item_id && <p className="mt-1 text-xs text-err">{errors.service_item_id}</p>}
            </div>

            {/* Legacy work_type — derived, kept for backwards compat with
                existing wo_detail_* tables. Shown read-only so admins see
                which detail form the catalog item routes to. */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('workOrder.workTypeDerived')}
              </label>
              <input
                type="text"
                value={form.work_type ? (L.workType(form.work_type as WorkType) ?? form.work_type) : '—'}
                readOnly
                className="w-full rounded-s border border-line bg-bg-0/50 px-3 py-2 text-sm text-fg-2"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.priority')}</label>
              <select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as 'normal' | 'alta' | 'urgente')}
                className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {L.priorityOptions().map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Address card — hidden for infra work (soplado, fusion_*, POP).
            These are not tied to a specific street address; supporting
            documents (plano, cartas de empalme) carry the spatial context
            instead. POP installations happen at central sites, not
            customer addresses. */}
        {selectedDetailForm && !isInfra && (
          <div className="rounded-l border border-line bg-bg-1 p-5">
            <h3 className="mb-4 font-display text-sm font-semibold text-fg-1">{t('workOrder.address')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.streetAddress')}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="Musterstraße 12"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.postalCode')}</label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => setField('postal_code', e.target.value)}
                  placeholder="10115"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.city')}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="Berlin"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Supporting documents — for infra work (soplado, fusion_*, POP)
            admins attach the plano when creating the order. Cartas de
            empalme are usually the technician's output but can be added
            here too. On new orders files are staged locally and uploaded
            after the order is created. */}
        {isInfra && (
          <div className="rounded-l border border-accent/30 bg-bg-1 p-5 space-y-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-fg-1">{t('workOrder.supportingDocs')}</h3>
              <p className="mt-0.5 text-xs text-fg-2">
                {t('workOrder.supportingDocsDesc')}
              </p>
            </div>
            <div className={`grid grid-cols-1 gap-5 ${documentTypes.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {documentTypes.map((doc) => {
                if (isEdit && id && user) {
                  return (
                    <DocumentUploader
                      key={doc.type}
                      workOrderId={id}
                      uploadedBy={user.id}
                      documentType={doc.type}
                      label={doc.label}
                      hint={doc.hint}
                    />
                  )
                }
                return (
                  <DocumentUploader
                    key={doc.type}
                    documentType={doc.type}
                    label={doc.label}
                    hint={`${doc.hint} · wird beim Speichern hochgeladen`}
                    stagedFiles={stagedDocs[doc.type]}
                    onStagedFilesChange={(files) =>
                      setStagedDocs((d) => ({ ...d, [doc.type]: files }))
                    }
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Dynamic detail fields */}
        {detailFields.length > 0 && (
          <div className="rounded-l border border-accent/30 bg-bg-1 p-5">
            <h3 className="mb-1 font-display text-sm font-semibold text-fg-1">
              {t('workOrder.detailsTitle', { workType: L.workType(form.work_type as WorkType) })}
            </h3>
            <p className="mb-4 text-xs text-fg-2">{t('workOrder.detailsSubtitle')}</p>
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
                        className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                      />
                      <label htmlFor={field.key} className="text-sm font-medium text-fg-1 cursor-pointer">
                        {field.label}
                      </label>
                    </>
                  ) : field.type === 'select' ? (
                    <>
                      <label className="mb-1 block text-xs font-medium text-fg-2">{field.label}</label>
                      <select
                        value={String(detail[field.key] ?? '')}
                        onChange={(e) => setDetailField(field.key, e.target.value)}
                        className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="">— wählen —</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium text-fg-2">{field.label}</label>
                      <input
                        type={field.type}
                        value={String(detail[field.key] ?? '')}
                        onChange={(e) =>
                          setDetailField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <label className="mb-1 block text-xs font-medium text-fg-2">{t('workOrder.internalNotes')}</label>
          <textarea
            value={form.internal_notes}
            onChange={(e) => setField('internal_notes', e.target.value)}
            rows={3}
            placeholder={t('workOrder.notesPlaceholder')}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* Save error */}
        {saveError && (
          <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex-1 rounded-s border border-line px-4 py-2.5 text-sm font-medium text-fg-1 hover:bg-bg-0 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('common.saving') : isEdit ? t('workOrder.saveChanges') : t('workOrder.createOrder')}
          </button>
        </div>
      </form>
    </div>
  )
}
