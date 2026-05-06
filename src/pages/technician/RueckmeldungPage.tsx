import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Package, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// ── Time picker ────────────────────────────────────────────────
function TimePickerField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-fg-2">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-l border-2 px-3 py-3 font-mono text-base font-bold tracking-wider transition-colors
          bg-bg-0 text-fg-1 cursor-pointer
          ${value ? 'border-accent/50' : 'border-line'}
          focus:border-accent focus:outline-none`}
      />
    </div>
  )
}
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrderPhotos,
  fetchStateHistory,
  upsertWorkOrderDetail,
  uploadWorkOrderPhoto,
  deleteWorkOrderPhoto,
  transitionWorkOrderStatus,
  workTypeToDetailTable,
  getPhotoSignedUrls,
  fetchBillingLines,
  upsertBillingLines,
  type BillingLineDraft,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import { fetchServiceItems } from '@/services/serviceItemService'
import {
  fetchVehicles,
  fetchVehicleStock,
  registerMaterialConsumption,
} from '@/services/materialInventoryService'
import type { ServiceItemWithRelations } from '@/types/service-items'
import type { ConsumptionCorrectionRequired, ConsumptionDraft, InventoryVehicle, VehicleStockRow } from '@/types/material-inventory'
import type { TeamColor } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { DETAIL_FIELDS } from '@/constants/detail-fields'

type PhotoType = 'before' | 'during' | 'after'

interface Photo {
  id: string
  storage_path: string
  photo_type: PhotoType
  caption: string | null
}

type ConsumptionDraftRow = ConsumptionDraft & { _key: string }

export function RueckmeldungPage() {
  const L = useLabels()
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<WorkOrderWithRelations | null>(null)

  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [techNotes, setTechNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const [returnedNote, setReturnedNote] = useState<string | null>(null)

  // Alta multi-item billing lines (work_order_billing_lines)
  // Loaded only when work_type === 'alta'. Each draft holds an `id` when
  // existing in DB so upsert can distinguish updates from inserts.
  const [billingDrafts, setBillingDrafts] = useState<Array<BillingLineDraft & { _key: string }>>([])
  const [catalog, setCatalog] = useState<ServiceItemWithRelations[]>([])
  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [vehicleStock, setVehicleStock] = useState<VehicleStockRow[]>([])
  const [consumptionDrafts, setConsumptionDrafts] = useState<ConsumptionDraftRow[]>([])
  const [stockCorrections, setStockCorrections] = useState<ConsumptionCorrectionRequired[]>([])

  const fileInputRefs = {
    before: useRef<HTMLInputElement>(null),
    during: useRef<HTMLInputElement>(null),
    after: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchWorkOrder(id),
      fetchWorkOrderPhotos(id),
      fetchStateHistory(id),
    ]).then(async ([{ data: orderData, error: orderErr }, { data: photoData }, { data: histData }]) => {
      if (orderErr || !orderData) {
        setError(orderErr ?? 'Auftrag nicht gefunden')
        setIsLoading(false)
        return
      }
      setOrder(orderData)
      const loadedPhotos = (photoData ?? []) as Photo[]
      setPhotos(loadedPhotos)
      getPhotoSignedUrls(loadedPhotos.map((p) => p.storage_path)).then(setPhotoUrls)

      const histEntries = (histData ?? []) as Array<{ to_status: string; notes: string | null }>
      const returnEntry = [...histEntries].reverse().find((e) => e.to_status === 'returned')
      if (returnEntry?.notes) setReturnedNote(returnEntry.notes)

      // Load existing detail
      const table = workTypeToDetailTable(orderData.work_type)
      const { data: detailData } = await fetchWorkOrderDetail(table, id)
      if (detailData) {
        const { id: _i, work_order_id: _w, created_at: _c, ...rest } = detailData as Record<string, unknown>
        void _i; void _w; void _c
        setDetail(rest)
      }

      // For Alta orders, load existing billing lines + the service-item catalog
      // (filtered by client+operator so technician only sees relevant rates).
      if (orderData.work_type === 'alta') {
        const [{ data: lines }, { data: items }] = await Promise.all([
          fetchBillingLines(id),
          fetchServiceItems({ includeInactive: false }),
        ])
        const drafts = lines.map((l) => ({
          _key: l.id,
          id: l.id,
          service_item_id: l.service_item_id,
          qty: Number(l.qty),
          unit_price_snapshot: Number(l.unit_price_snapshot),
          unit_price_external_snapshot: l.unit_price_external_snapshot != null
            ? Number(l.unit_price_external_snapshot)
            : null,
          notes: l.notes,
        }))
        setBillingDrafts(drafts)
        // Filter catalog by order's client and operator so the picker only shows
        // applicable rates (catalog rows with NULL client/operator stay visible
        // as "global" entries).
        const filtered = items.filter((it) => {
          const okClient = it.client_id == null || it.client_id === orderData.client_id
          const okOp = it.operator_id == null || it.operator_id === orderData.operator_id
          return okClient && okOp
        })
        setCatalog(filtered)
      }

      const team = (orderData.assigned_team ?? user?.team ?? null) as TeamColor | null
      if (team) {
        const { data: teamVehicles } = await fetchVehicles({ team, includeInactive: false })
        setVehicles(teamVehicles)
        if (teamVehicles.length === 1) setSelectedVehicleId(teamVehicles[0].id)
      }

      setIsLoading(false)
    })
  }, [id, user?.team])

  useEffect(() => {
    if (!selectedVehicleId) {
      queueMicrotask(() => setVehicleStock([]))
      return
    }
    fetchVehicleStock(selectedVehicleId).then(({ data }) => setVehicleStock(data))
  }, [selectedVehicleId])

  // Billing-line CRUD on the local drafts (saved on handleSave / handleSend)
  function addBillingLine() {
    setBillingDrafts((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        service_item_id: '',
        qty: 1,
        unit_price_snapshot: 0,
        unit_price_external_snapshot: null,
        notes: null,
      },
    ])
  }

  function removeBillingLine(key: string) {
    setBillingDrafts((prev) => prev.filter((d) => d._key !== key))
  }

  function setBillingLineField<K extends keyof BillingLineDraft>(
    key: string,
    field: K,
    value: BillingLineDraft[K],
  ) {
    setBillingDrafts((prev) => prev.map((d) => {
      if (d._key !== key) return d
      const updated = { ...d, [field]: value }
      // When the technician picks a service_item, snapshot both prices from the catalog.
      // The technician never sees these — they are written to DB for the admin's
      // CertificationPage to read later.
      if (field === 'service_item_id') {
        const item = catalog.find((c) => c.id === value)
        if (item) {
          updated.unit_price_snapshot = item.unit_price ?? 0
          updated.unit_price_external_snapshot = item.unit_price_external ?? null
        }
      }
      return updated
    }))
  }

  function setDetailField(key: string, value: unknown) {
    setDetail((d) => ({ ...d, [key]: value }))
  }

  function addConsumptionLine() {
    setConsumptionDrafts((prev) => [
      ...prev,
      {
        _key: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        material_id: '',
        quantity: 0,
        stock_real_before: null,
        notes: null,
      },
    ])
  }

  function removeConsumptionLine(key: string) {
    setConsumptionDrafts((prev) => prev.filter((line) => line._key !== key))
  }

  function setConsumptionField<K extends keyof ConsumptionDraft>(
    key: string,
    field: K,
    value: ConsumptionDraft[K],
  ) {
    setStockCorrections([])
    setConsumptionDrafts((prev) => prev.map((line) => (
      line._key === key ? { ...line, [field]: value } : line
    )))
  }

  async function handlePhotoUpload(photoType: PhotoType, files: FileList | null) {
    if (!files || files.length === 0 || !id || !user) return
    setUploadingType(photoType)
    setError(null)

    for (const file of Array.from(files)) {
      const { data, error } = await uploadWorkOrderPhoto(id, photoType, file, user.id)
      if (error) {
        setError(`Foto-Upload fehlgeschlagen: ${error}`)
        break
      }
      if (data) {
        const newPhoto = data as Photo
        setPhotos((prev) => [...prev, newPhoto])
        getPhotoSignedUrls([newPhoto.storage_path]).then((urls) =>
          setPhotoUrls((prev) => ({ ...prev, ...urls })),
        )
      }
    }
    setUploadingType(null)
  }

  async function handlePhotoDelete(photoId: string, storagePath: string) {
    setDeletingPhotoId(photoId)
    setError(null)
    const { error } = await deleteWorkOrderPhoto(photoId, storagePath)
    if (error) {
      setError(`Foto löschen fehlgeschlagen: ${error}`)
    } else {
      setPhotos((prev) => {
        const updated = prev.filter((p) => p.id !== photoId)
        const removed = prev.find((p) => p.id === photoId)
        if (removed) {
          setPhotoUrls((urls) => {
            const next = { ...urls }
            delete next[removed.storage_path]
            return next
          })
        }
        return updated
      })
    }
    setDeletingPhotoId(null)
  }

  async function handleSave() {
    if (!id || !order) return
    setIsSaving(true)
    setError(null)
    setSavedOk(false)

    const table = workTypeToDetailTable(order.work_type)
    const { error } = await upsertWorkOrderDetail(table, id, detail)
    if (error) {
      setError(error)
      setIsSaving(false)
      return
    }

    // For Alta orders, also persist billing lines (multi-item)
    if (order.work_type === 'alta') {
      const valid = billingDrafts.filter((d) => d.service_item_id && d.qty > 0)
      const { error: blErr } = await upsertBillingLines(
        id,
        valid.map(({ _key: _k, ...rest }) => { void _k; return rest }),
      )
      if (blErr) {
        setError(blErr)
        setIsSaving(false)
        return
      }
    }

    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
    setIsSaving(false)
  }

  async function handleSend() {
    if (!id || !user || !order) return
    setIsSending(true)
    setError(null)

    // First save detail
    const table = workTypeToDetailTable(order.work_type)
    const { error: detailError } = await upsertWorkOrderDetail(table, id, detail)
    if (detailError) {
      setError(detailError)
      setIsSending(false)
      return
    }

    // For Alta orders, also persist billing lines before transitioning
    if (order.work_type === 'alta') {
      const valid = billingDrafts.filter((d) => d.service_item_id && d.qty > 0)
      const { error: blErr } = await upsertBillingLines(
        id,
        valid.map(({ _key: _k, ...rest }) => { void _k; return rest }),
      )
      if (blErr) {
        setError(blErr)
        setIsSending(false)
        return
      }
    }

    const validConsumption = consumptionDrafts.filter((d) => d.material_id && d.quantity > 0)
    if (validConsumption.length > 0) {
      if (!selectedVehicleId) {
        setError(t('rueckmeldung.materialConsumption.errors.vehicleRequired'))
        setIsSending(false)
        return
      }
      const result = await registerMaterialConsumption({
        workOrderId: id,
        vehicleId: selectedVehicleId,
        reportedBy: user.id,
        drafts: validConsumption.map(({ _key: _k, ...rest }) => { void _k; return rest }),
      })
      if (result.correctionRequired.length > 0) {
        setStockCorrections(result.correctionRequired)
        setError(t('rueckmeldung.materialConsumption.errors.stockCorrectionRequired'))
        setIsSending(false)
        return
      }
      if (result.error) {
        setError(result.error)
        setIsSending(false)
        return
      }
    }

    // Build notes string with tech input
    const noteParts: string[] = []
    if (techNotes.trim()) noteParts.push(`Notizen: ${techNotes.trim()}`)
    if (startTime) noteParts.push(`Beginn: ${startTime}`)
    if (endTime) noteParts.push(`Ende: ${endTime}`)
    if (validConsumption.length > 0) {
      noteParts.push(t('rueckmeldung.materialConsumption.notes.summary', { count: validConsumption.length }))
    }
    const notes = noteParts.length > 0 ? noteParts.join(' | ') : 'Rückmeldung gesendet'

    // If the order is in 'executed' or 'returned', first move to 'rueckmeldung_pending'
    // before transitioning to 'rueckmeldung_sent' (state machine requires the intermediate step)
    if (order.status === 'executed' || order.status === 'returned') {
      const { error: pendingError } = await transitionWorkOrderStatus(
        id, 'rueckmeldung_pending', user.id, undefined, user.role,
      )
      if (pendingError) {
        setError(pendingError)
        setIsSending(false)
        return
      }
    }

    const { error } = await transitionWorkOrderStatus(id, 'rueckmeldung_sent', user.id, notes, user.role)
    if (error) {
      setError(error)
      setIsSending(false)
    } else {
      navigate(`/tech/orders/${id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error ?? 'Auftrag nicht gefunden'}
      </div>
    )
  }

  const detailFields = DETAIL_FIELDS[order.work_type] ?? []
  const photosByType = (type: PhotoType) => photos.filter((p) => p.photo_type === type)

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/tech/orders/${id}`)}
          className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-lg font-bold text-fg-1">Rückmeldung</h2>
          <p className="text-xs text-fg-2 font-mono">{order.order_number} · {L.workType(order.work_type)}</p>
        </div>
      </div>

      {/* Non-conformity banner */}
      {order.status === 'returned' && returnedNote && (
        <div className="rounded-l border border-err/50 bg-err/10 p-4">
          <p className="inline-flex items-center gap-2 font-semibold text-err">
            <AlertTriangle size={16} strokeWidth={1.5} />
            Auftrag zurückgegeben — Nichtkonformität
          </p>
          <p className="mt-1 text-sm text-err">{returnedNote}</p>
          <p className="mt-2 text-xs text-err">Korrekturen vornehmen und die Rückmeldung erneut senden.</p>
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-fg-2">Kunde</p>
            <p className="font-medium text-fg-1">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Projekt</p>
            <p className="font-medium text-fg-1">{order.projects?.code ?? '—'}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">Adresse</p>
              <p className="font-medium text-fg-1">{[order.address, order.city].filter(Boolean).join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Time inputs */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">Einsatzzeiten</h3>
        <div className="grid grid-cols-2 gap-3">
          <TimePickerField label="Beginn" value={startTime} onChange={setStartTime} />
          <TimePickerField label="Ende" value={endTime} onChange={setEndTime} />
        </div>
      </div>

      {/* Alta multi-item billing editor — prices stay hidden, only the technician
          declares what was executed; admin sees the prices in CertificationPage */}
      {order.work_type === 'alta' && (
        <div className="rounded-l border border-accent/30 bg-bg-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-fg-1">Geleistete Posten</h3>
              <p className="text-xs text-fg-2">Was wurde tatsächlich montiert. Eine Zeile je Position aus dem Service-Katalog.</p>
            </div>
            <button
              type="button"
              onClick={addBillingLine}
              className="rounded-s border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            >
              + Posten
            </button>
          </div>

          {billingDrafts.length === 0 ? (
            <p className="rounded-s border border-dashed border-line bg-bg-0 p-3 text-center text-xs text-fg-2">
              Noch keine Posten. Klick auf <span className="font-semibold text-accent">+ Posten</span>.
            </p>
          ) : (
            <div className="space-y-2">
              {billingDrafts.map((line) => {
                const selectedItem = catalog.find((c) => c.id === line.service_item_id)
                return (
                  <div
                    key={line._key}
                    className="rounded-s border border-line bg-bg-0 p-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_auto]"
                  >
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
                        Leistung
                      </label>
                      <select
                        value={line.service_item_id}
                        onChange={(e) => setBillingLineField(line._key, 'service_item_id', e.target.value)}
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="">— wählen —</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.description_de}
                          </option>
                        ))}
                      </select>
                      {selectedItem?.description_es && (
                        <p className="mt-1 text-[11px] italic text-fg-2">ES: {selectedItem.description_es}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
                        Menge {selectedItem?.unit ? `(${selectedItem.unit})` : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.qty}
                        onChange={(e) => setBillingLineField(line._key, 'qty', Number(e.target.value))}
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-right font-mono text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeBillingLine(line._key)}
                        className="rounded-s border border-err/40 px-3 py-1.5 text-xs text-err hover:bg-err/10 transition-colors"
                        title="Posten entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Dynamic detail fields */}
      {detailFields.length > 0 && (
        <div className="rounded-l border border-accent/30 bg-bg-1 p-4">
          <h3 className="mb-1 font-display text-sm font-semibold text-fg-1">
            Technische Daten — {L.workType(order.work_type)}
          </h3>
          <p className="mb-3 text-xs text-fg-2">Ausgeführte Arbeit dokumentieren</p>
          <div className="grid grid-cols-1 gap-4">
            {detailFields.map((field) => (
              <div key={field.key} className={field.type === 'checkbox' ? 'flex items-center gap-3' : ''}>
                {field.type === 'checkbox' ? (
                  <>
                    <input
                      type="checkbox"
                      id={field.key}
                      checked={Boolean(detail[field.key])}
                      onChange={(e) => setDetailField(field.key, e.target.checked)}
                      className="h-5 w-5 rounded border-line text-accent focus:ring-accent"
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
                      className="w-full rounded-s border border-line bg-bg-0 px-3 py-2.5 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                      className="w-full rounded-s border border-line bg-bg-0 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material consumption */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-fg-1">
              <Package size={16} strokeWidth={1.5} />
              {t('rueckmeldung.materialConsumption.title')}
            </h3>
            <p className="mt-1 text-xs text-fg-2">{t('rueckmeldung.materialConsumption.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={addConsumptionLine}
            className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs font-semibold text-fg-1 hover:border-accent hover:text-accent transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
            {t('rueckmeldung.materialConsumption.actions.add')}
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
            {t('rueckmeldung.materialConsumption.fields.vehicle')}
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2.5 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('rueckmeldung.materialConsumption.placeholders.noVehicle')}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} · Team {vehicle.team}
              </option>
            ))}
          </select>
        </div>

        {stockCorrections.length > 0 && (
          <div className="mb-3 rounded-s border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
            {t('rueckmeldung.materialConsumption.correctionRequired', {
              items: stockCorrections.map((c) => `${c.material_name} (${c.registered} ${c.unit})`).join(', '),
            })}
          </div>
        )}

        {consumptionDrafts.length === 0 ? (
          <p className="rounded-s border border-dashed border-line bg-bg-0 p-3 text-center text-xs text-fg-2">
            {t('rueckmeldung.materialConsumption.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {consumptionDrafts.map((line) => {
              const stockRow = vehicleStock.find((row) => row.material_id === line.material_id)
              const correction = stockCorrections.find((c) => c.material_id === line.material_id)
              return (
                <div key={line._key} className="rounded-s border border-line bg-bg-0 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_92px_auto]">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
                        {t('rueckmeldung.materialConsumption.fields.material')}
                      </label>
                      <select
                        value={line.material_id}
                        onChange={(e) => setConsumptionField(line._key, 'material_id', e.target.value)}
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="">{t('rueckmeldung.materialConsumption.placeholders.choose')}</option>
                        {vehicleStock.map((row) => (
                          <option key={row.material_id} value={row.material_id}>
                            {row.material.sku ? `${row.material.sku} — ` : ''}
                            {row.material.name} · {t('rueckmeldung.materialConsumption.optionStock', {
                              quantity: row.quantity,
                              unit: row.material.unit,
                            })}
                          </option>
                        ))}
                      </select>
                      {stockRow && (
                        <p className="mt-1 font-mono text-[11px] text-fg-2">
                          {t('rueckmeldung.materialConsumption.registered', {
                            quantity: stockRow.quantity,
                            unit: stockRow.material.unit,
                          })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
                        {t('rueckmeldung.materialConsumption.fields.quantity')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity === 0 ? '' : line.quantity}
                        onChange={(e) => setConsumptionField(
                          line._key,
                          'quantity',
                          e.target.value === '' ? 0 : Number(e.target.value),
                        )}
                        placeholder="0"
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-right font-mono text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeConsumptionLine(line._key)}
                        className="flex h-8 w-8 items-center justify-center rounded-s border border-err/40 text-err hover:bg-err/10 transition-colors"
                        title={t('rueckmeldung.materialConsumption.actions.remove')}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  {correction && (
                    <div className="mt-3">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-warn">
                        {t('rueckmeldung.materialConsumption.fields.realStockBefore')} *
                      </label>
                      <input
                        type="number"
                        min={line.quantity}
                        step="0.01"
                        value={line.stock_real_before ?? ''}
                        onChange={(e) => setConsumptionField(
                          line._key,
                          'stock_real_before',
                          e.target.value === '' ? null : Number(e.target.value),
                        )}
                        className="w-full rounded-s border border-warn/60 bg-bg-1 px-2 py-1.5 text-right font-mono text-sm text-fg-1 focus:border-warn focus:outline-none focus:ring-1 focus:ring-warn"
                        placeholder={t('rueckmeldung.materialConsumption.placeholders.minimum', { quantity: line.quantity })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Photos */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">Fotos</h3>
        <div className="space-y-4">
          {(['before', 'during', 'after'] as PhotoType[]).map((type) => {
            const typePhotos = photosByType(type)
            return (
              <div key={type}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-fg-2 uppercase tracking-wide">
                    {L.photo(type)} ({typePhotos.length})
                  </p>
                  <button
                    type="button"
                    disabled={uploadingType === type}
                    onClick={() => fileInputRefs[type].current?.click()}
                    className="rounded-s border border-line px-2.5 py-1 text-xs font-medium text-fg-2 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {uploadingType === type ? 'Lädt…' : '+ Foto'}
                  </button>
                  <input
                    ref={fileInputRefs[type]}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(type, e.target.files)}
                  />
                </div>
                {typePhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {typePhotos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square overflow-hidden rounded-s bg-bg-0">
                        <img
                          src={photoUrls[photo.storage_path] ?? ''}
                          alt={photo.caption ?? L.photo(type)}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          disabled={deletingPhotoId === photo.id}
                          onClick={() => handlePhotoDelete(photo.id, photo.storage_path)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-err disabled:opacity-50 transition-colors"
                          aria-label="Foto löschen"
                        >
                          {deletingPhotoId === photo.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex h-16 cursor-pointer items-center justify-center rounded-s border-2 border-dashed border-line text-xs text-fg-2 hover:border-accent/50 transition-colors"
                    onClick={() => fileInputRefs[type].current?.click()}
                  >
                    Keine Fotos · Tippen um hinzuzufügen
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Technician notes */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <label className="mb-1 block text-xs font-medium text-fg-2">
          Notizen / Besonderheiten
        </label>
        <textarea
          value={techNotes}
          onChange={(e) => setTechNotes(e.target.value)}
          rows={3}
          placeholder="Besonderheiten, Probleme, Hinweise für Admin…"
          className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      {/* Error / success */}
      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}
      {savedOk && (
        <div className="rounded-s border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          Daten gespeichert.
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={isSaving || isSending}
          onClick={handleSave}
          className="rounded-l border border-line px-4 py-3 text-sm font-semibold text-fg-1 hover:bg-bg-0 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Speichern…' : 'Zwischenspeichern'}
        </button>
        <button
          disabled={isSaving || isSending}
          onClick={handleSend}
          className="rounded-l bg-accent px-4 py-3 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {isSending ? 'Wird gesendet…' : order.status === 'returned' ? 'Korrigierte RM senden' : 'Rückmeldung senden'}
        </button>
      </div>

      <p className="text-center text-xs text-fg-2">
        "Rückmeldung senden" übermittelt alle Daten an den Admin zur Zertifizierung.
      </p>
    </div>
  )
}
