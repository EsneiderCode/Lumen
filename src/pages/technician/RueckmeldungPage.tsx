import { useEffect, useMemo, useRef, useState } from 'react'
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
  fetchWorkOrderPhotos,
  deleteWorkOrderPhoto,
  transitionWorkOrderStatus,
  getPhotoSignedUrls,
  normalizeReportedServiceItems,
  type ReportedServiceItemDraft,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import {
  fetchVehicleStock,
  registerMaterialConsumption,
} from '@/services/materialInventoryService'
import { notifyReportSubmitted, type ReportSubmittedNotification } from '@/services/notificationService'
import {
  fetchCaptureExampleUrls,
  saveCaptureReport,
  uploadCapturePhoto,
  type CapturePhotoRow,
} from '@/services/capturePlanService'
import {
  clearReview,
  firstRepeaterSection,
  markReviewed,
  reviewAcceptedAt,
  setTrenchLocation,
  trenchesForReview,
} from '@/lib/trenchReview'
import { TrenchReview } from '@/components/capture/TrenchReview'
import { rueckmeldungSendPath } from '@/services/workOrderStateMachine'
import { loadRueckmeldung } from '@/services/rueckmeldungLoader'
import { cacheAnswers } from '@/services/offlineCache'
import {
  enqueuePhoto,
  enqueueSubmission,
  pendingPhotos as readQueuedPhotos,
  queuedPhotoBlob,
} from '@/services/offlineQueue'
import { refreshPendingCounts } from '@/services/offlineSyncState'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { scalePhotoForUpload } from '@/lib/photoScaling'
import { readPhotoMetadata } from '@/lib/exif'
import { captureExamplePaths, evaluateCapturePlan, slotNodeId } from '@/services/capturePlanEngine'
import { CapturePlanForm, type PendingPhoto, type SlotTarget } from '@/components/capture/CapturePlanForm'
import type { ServiceItemWithRelations } from '@/types/service-items'
import type { ConsumptionCorrectionRequired, ConsumptionDraft, InventoryVehicle, VehicleStockRow } from '@/types/material-inventory'
import type { TeamColor } from '@/types/enums'
import type {
  CaptureAnswers,
  CaptureFieldValues,
  CaptureGeoPoint,
  CapturePlan,
  CaptureRepeaterItem,
} from '@/types/capture-plan'
import { useLabels } from '@/i18n/labels'
import { orderSiteRef } from '@/lib/orderSiteRef'

type ConsumptionDraftRow = ConsumptionDraft & { _key: string }

/** A pending photo plus what it needs to be uploaded again after a failure. */
type PendingUpload = PendingPhoto & {
  file: File
  target: SlotTarget
  /** Read off the file's EXIF, so a retry re-sends the same position. */
  location?: CaptureGeoPoint | null
  /** When the camera says the photo was taken; NOT when it was uploaded. */
  takenAt?: string | null
  /** Row id in the offline photo queue, for the tiles rebuilt from IndexedDB. */
  queueId?: number
}

function newItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function RueckmeldungPage() {
  const L = useLabels()
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<WorkOrderWithRelations | null>(null)

  // The plan is the form and `answers` is the whole of what the technician
  // entered. Both are saved as one capture report — there is no second copy.
  const [plan, setPlan] = useState<CapturePlan | null>(null)
  const [answers, setAnswers] = useState<CaptureAnswers>({})
  const [photos, setPhotos] = useState<CapturePhotoRow[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  // Example thumbnails of the plan's slots, keyed by the slot's `example` path.
  const [exampleUrls, setExampleUrls] = useState<Record<string, string>>({})
  const [pendingPhotos, setPendingPhotos] = useState<PendingUpload[]>([])
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [techNotes, setTechNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const [returnedNote, setReturnedNote] = useState<string | null>(null)
  /** `cachedAt` of the snapshot on screen when it came from the device, else null. */
  const [offlineSince, setOfflineSince] = useState<string | null>(null)
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null)

  // A drain finished elsewhere in the app (the banner drives it): the queued
  // tiles this screen shows may now be real photos.
  const { lastSyncAt } = useOfflineSync()

  // Alta multi-item service report. Technicians record executed items without
  // price data; admin certification materializes protected billing lines.
  const [reportedDrafts, setReportedDrafts] = useState<Array<ReportedServiceItemDraft & { _key: string }>>([])
  const [catalog, setCatalog] = useState<ServiceItemWithRelations[]>([])
  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [vehicleStock, setVehicleStock] = useState<VehicleStockRow[]>([])
  const [consumptionDrafts, setConsumptionDrafts] = useState<ConsumptionDraftRow[]>([])
  const [stockCorrections, setStockCorrections] = useState<ConsumptionCorrectionRequired[]>([])

  /**
   * Centre of the order's project (migration 060). A project always happens in
   * the same town, so this is where a still-empty trench map opens — rather than
   * over the middle of the country, which meant hunting for the village on every
   * single trench.
   */
  const projectCenter = useMemo<CaptureGeoPoint | null>(() => {
    const project = order?.projects
    if (!project || typeof project.center_lat !== 'number' || typeof project.center_lng !== 'number') {
      return null
    }
    return { lat: project.center_lat, lng: project.center_lng, accuracy_m: null }
  }, [order])

  // What the plan still demands. Photos in flight count as already there, so the
  // form does not flash "missing" between picking the file and the upload finishing.
  const evaluation = useMemo(() => {
    if (!plan) return null
    const optimistic = pendingPhotos
      .filter((item) => !item.failed)
      .map((item) => ({
        id: item.id,
        section_key: item.target.sectionKey,
        slot_key: item.target.slotKey,
        item_id: item.target.itemId,
        photo_type: item.target.legacyType,
      }))
    return evaluateCapturePlan(plan, [...photos, ...optimistic], answers)
  }, [plan, photos, pendingPhotos, answers])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    void loadRueckmeldung(id, (user?.team ?? null) as TeamColor | null).then(
      ({ data, error: loadError, fromCache, cachedAt }) => {
        if (cancelled) return
        if (!data) {
          // The empty-state below falls back to a translated "not found".
          setError(loadError)
          setIsLoading(false)
          return
        }

        setOrder(data.order)
        setPhotos(data.photos)
        setPlan(data.plan)
        setAnswers(data.answers)
        setReturnedNote(data.returnedNote)
        setCatalog(data.catalog)
        setVehicles(data.vehicles)
        setReportedDrafts(
          data.reportedDrafts.map((item, index) => ({
            _key: `reported-${index}-${item.service_item_id}`,
            ...item,
          })),
        )
        if (data.vehicles.length === 1) setSelectedVehicleId(data.vehicles[0].id)
        setOfflineSince(fromCache ? cachedAt : null)
        setIsLoading(false)

        // Both need a network and neither is essential: a signed URL that never
        // arrives shows the slot as filled without its thumbnail.
        if (!fromCache) {
          getPhotoSignedUrls(data.photos.map((photo) => photo.storage_path)).then(setPhotoUrls)
          if (data.plan) {
            fetchCaptureExampleUrls(captureExamplePaths(data.plan)).then(setExampleUrls)
          }
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [id, user?.team])

  // ── Autoguardado ──────────────────────────────────────────────────────────
  // Las fotos suben al instante, pero lo tecleado vivía SOLO en memoria hasta
  // que alguien pulsara Guardar. Una recarga, o un móvil que descarta la
  // pestaña de fondo —normal en una jornada de obra—, se lo llevaba entero y
  // dejaba las fotos ya subidas colgando de catas que ya no existían en el
  // informe. Le pasó de verdad a LUM-20260727-1017: 32 fotos de catas y una
  // Rückmeldung enviada sin una sola cata dentro.
  const persistedRef = useRef<string | null>(null)
  useEffect(() => {
    if (isLoading || !plan || !id || !user) return
    const snapshot = JSON.stringify({ answers, reported: reportedServiceItems() })
    // La primera pasada es lo recién cargado: no hay nada que guardar todavía.
    if (persistedRef.current === null) {
      persistedRef.current = snapshot
      return
    }
    if (persistedRef.current === snapshot) return

    const timer = setTimeout(() => {
      persistedRef.current = snapshot
      void cacheAnswers(id, answers, reportedServiceItems())
      // Sin cobertura basta la copia del dispositivo; la de servidor irá cuando
      // vuelva la red o cuando el técnico guarde a mano.
      if (navigator.onLine) void persistCaptureReport(false)
    }, 2500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, reportedDrafts, isLoading, plan, id, user])

  // ── Revisión de las catas ─────────────────────────────────────────────────
  // El pin de cada cata lo pone el técnico en el formulario; aquí solo se le
  // enseña el conjunto sobre el mapa para que lo dé por bueno. Cualquier cambio
  // posterior tumba la aceptación (la huella deja de cuadrar), así que lo que
  // queda registrado siempre describe lo que hay.
  const reviewTrenches = useMemo(
    () => trenchesForReview(plan, answers, photos),
    [plan, answers, photos],
  )
  const reviewAccepted = useMemo(
    () => reviewAcceptedAt(answers, reviewTrenches),
    [answers, reviewTrenches],
  )

  /** Mover el pin desde el mapa de revisión: lo mismo que moverlo en su cata. */
  function handleTrenchPin(itemId: string, point: CaptureGeoPoint) {
    setAnswers((previous) => setTrenchLocation(plan, previous, itemId, point))
  }

  function handleTrenchAccept() {
    setAnswers((previous) =>
      markReviewed(previous, trenchesForReview(plan, previous, photos), new Date().toISOString()),
    )
  }

  /** «Corregir algo»: se retira el visto bueno y se le sube a las catas. */
  function handleTrenchReject() {
    setAnswers((previous) => clearReview(previous))
    const section = firstRepeaterSection(plan)
    if (section) {
      document.getElementById(section.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  /**
   * Photos taken without coverage. They are rebuilt as pending tiles so they
   * count towards the plan (the evaluation above treats a tile as a photo) and
   * survive closing the app — which is the whole point of queueing them.
   */
  useEffect(() => {
    if (!id) return
    let cancelled = false
    const urls: string[] = []

    void readQueuedPhotos(id).then((queued) => {
      if (cancelled) return
      setPendingPhotos((previous) => {
        const alreadyShown = new Set(
          previous.filter((item) => item.queueId !== undefined).map((item) => item.queueId),
        )
        const restored = queued
          .filter((photo) => photo.id !== undefined && !alreadyShown.has(photo.id))
          .map((photo) => {
            const blob = queuedPhotoBlob(photo)
            const previewUrl = URL.createObjectURL(blob)
            urls.push(previewUrl)
            return {
              id: `queued-${photo.id}`,
              queueId: photo.id,
              nodeId: slotNodeId(photo.sectionKey, photo.slotKey, photo.itemId),
              previewUrl,
              failed: false,
              queued: true,
              file: new File([blob], photo.fileName, { type: photo.contentType }),
              location: photo.location,
              takenAt: photo.takenAt,
              target: {
                sectionKey: photo.sectionKey,
                slotKey: photo.slotKey,
                itemId: photo.itemId,
                legacyType: photo.legacyType,
              },
            } satisfies PendingUpload
          })
        return restored.length > 0 ? [...previous, ...restored] : previous
      })
    })

    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
    }
    // Re-runs after a drain: the tiles it uploaded are gone from the queue.
  }, [id, lastSyncAt])

  /** A drain that uploaded something replaces the queued tiles with real rows. */
  useEffect(() => {
    if (!id || !lastSyncAt) return
    let cancelled = false

    void fetchWorkOrderPhotos(id).then(({ data }) => {
      if (cancelled || !data) return
      const rows = data as CapturePhotoRow[]
      setPhotos(rows)
      getPhotoSignedUrls(rows.map((photo) => photo.storage_path)).then((urls) =>
        setPhotoUrls((previous) => ({ ...previous, ...urls })),
      )
    })

    void readQueuedPhotos(id).then((queued) => {
      if (cancelled) return
      const stillQueued = new Set(queued.map((photo) => photo.id))
      setPendingPhotos((previous) =>
        previous.filter((item) => item.queueId === undefined || stillQueued.has(item.queueId)),
      )
    })

    return () => {
      cancelled = true
    }
  }, [id, lastSyncAt])

  useEffect(() => {
    if (!selectedVehicleId) {
      queueMicrotask(() => setVehicleStock([]))
      return
    }
    fetchVehicleStock(selectedVehicleId).then(({ data }) => setVehicleStock(data))
  }, [selectedVehicleId])

  // Reported service-item CRUD on the local drafts (saved on handleSave / handleSend)
  function addReportedLine() {
    setReportedDrafts((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        service_item_id: '',
        qty: 1,
        notes: null,
      },
    ])
  }

  function removeReportedLine(key: string) {
    setReportedDrafts((prev) => prev.filter((d) => d._key !== key))
  }

  function setReportedLineField<K extends keyof ReportedServiceItemDraft>(
    key: string,
    field: K,
    value: ReportedServiceItemDraft[K],
  ) {
    setReportedDrafts((prev) => prev.map((d) => (
      d._key === key ? { ...d, [field]: value } : d
    )))
  }

  /**
   * The catalogued services actually performed. They ride along with the answers
   * in the capture report — no plan declares them, and the admin bills from them.
   */
  function reportedServiceItems() {
    if (order?.work_type !== 'alta') return []
    return normalizeReportedServiceItems(reportedDrafts)
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

  // ── Capture plan ─────────────────────────────────────────────────────────
  function handleFieldChange(
    sectionKey: string,
    fieldKey: string,
    value: unknown,
    itemId?: string | null,
  ) {
    setHighlightedNodeId(null)
    setAnswers((previous) => {
      if (itemId) {
        const items = (previous[sectionKey] ?? []) as CaptureRepeaterItem[]
        return {
          ...previous,
          [sectionKey]: items.map((item) =>
            item.id === itemId
              ? { ...item, values: { ...item.values, [fieldKey]: value as never } }
              : item,
          ),
        }
      }
      const values = (previous[sectionKey] ?? {}) as CaptureFieldValues
      return { ...previous, [sectionKey]: { ...values, [fieldKey]: value as never } }
    })
  }

  function handleAddItem(sectionKey: string) {
    setAnswers((previous) => {
      const items = (previous[sectionKey] ?? []) as CaptureRepeaterItem[]
      return { ...previous, [sectionKey]: [...items, { id: newItemId(), values: {} }] }
    })
  }

  function handleRemoveItem(sectionKey: string, itemId: string) {
    setAnswers((previous) => {
      const items = (previous[sectionKey] ?? []) as CaptureRepeaterItem[]
      return { ...previous, [sectionKey]: items.filter((item) => item.id !== itemId) }
    })
  }

  /**
   * Optimistic upload: the thumbnail appears immediately from an object URL and
   * is replaced by the stored photo when the round trip finishes. A failure
   * leaves the tile in place with a retry — the technician never loses the shot
   * because the network did.
   */
  /**
   * Stores the shot on the device instead of uploading it. The tile stays where
   * it is, marked as waiting: the technician has done their part and can put the
   * phone away — the queue uploads it when there is a network again.
   */
  async function queuePhoto(item: PendingUpload) {
    if (!id || !user) return
    const { file: scaled } = await scalePhotoForUpload(item.file)
    const queueId = await enqueuePhoto({
      workOrderId: id,
      userId: user.id,
      sectionKey: item.target.sectionKey,
      slotKey: item.target.slotKey,
      itemId: item.target.itemId,
      legacyType: item.target.legacyType,
      fileName: scaled.name,
      contentType: scaled.type || 'image/jpeg',
      file: scaled,
      takenAt: item.takenAt ?? new Date().toISOString(),
      location: item.location ?? null,
    })

    if (queueId === null) {
      setError(t('offline.photoQueueFailed'))
      setPendingPhotos((previous) =>
        previous.map((candidate) =>
          candidate.id === item.id ? { ...candidate, failed: true } : candidate,
        ),
      )
      return
    }

    setPendingPhotos((previous) =>
      previous.map((candidate) =>
        candidate.id === item.id ? { ...candidate, queued: true, queueId } : candidate,
      ),
    )
    void refreshPendingCounts()
  }

  async function uploadPending(item: PendingUpload) {
    if (!id || !user) return
    if (!navigator.onLine) {
      await queuePhoto(item)
      return
    }

    const { data, error } = await uploadCapturePhoto({
      workOrderId: id,
      file: item.file,
      userId: user.id,
      sectionKey: item.target.sectionKey,
      slotKey: item.target.slotKey,
      legacyType: item.target.legacyType,
      itemId: item.target.itemId,
      location: item.location ?? null,
      takenAt: item.takenAt ?? undefined,
    })

    if (error || !data) {
      // The connection dropped between picking the file and the upload: queue it
      // rather than making the technician watch a retry button.
      if (!navigator.onLine) {
        await queuePhoto(item)
        return
      }
      setError(t('rueckmeldung.photos.uploadFailed', { error: error ?? '' }))
      setPendingPhotos((previous) =>
        previous.map((candidate) =>
          candidate.id === item.id ? { ...candidate, failed: true } : candidate,
        ),
      )
      return
    }

    setPhotos((previous) => [...previous, data])
    getPhotoSignedUrls([data.storage_path]).then((urls) =>
      setPhotoUrls((previous) => ({ ...previous, ...urls })),
    )
    setPendingPhotos((previous) => previous.filter((candidate) => candidate.id !== item.id))
    URL.revokeObjectURL(item.previewUrl)
  }

  /** The plan's geopoint field of a repeater section, if it declares one. */
  function geoFieldKey(sectionKey: string): string | null {
    const section = plan?.sections.find((candidate) => candidate.key === sectionKey)
    if (!section || !('fields' in section)) return null
    return section.fields.find((field) => field.type === 'geopoint')?.key ?? null
  }

  /**
   * Where and when the photo was taken, read from the FILE, not from the device.
   * The Rückmeldung is filled after the job — often at home, hours later — so
   * `navigator.geolocation` would stamp every trench with wherever the
   * technician is sitting. The camera already wrote the truth into the photo's
   * EXIF; when it is there, the first photo of a trench also fills the item's
   * geopoint so the trench lands on the map by itself.
   *
   * A photo with no EXIF position is the normal case, not a failure: phones
   * strip it when a picture leaves the gallery. The technician then places the
   * pin by hand on the map, which is the only other honest source.
   */
  async function metadataForCapture(
    target: SlotTarget,
    file: File,
  ): Promise<{ location: CaptureGeoPoint | null; takenAt: string | null }> {
    const { point, takenAt } = await readPhotoMetadata(file)

    const fieldKey = point && target.itemId ? geoFieldKey(target.sectionKey) : null
    if (fieldKey && point) {
      setAnswers((previous) => {
        const items = (previous[target.sectionKey] ?? []) as CaptureRepeaterItem[]
        return {
          ...previous,
          [target.sectionKey]: items.map((item) =>
            // Only if empty: a technician who placed the pin keeps their point.
            item.id === target.itemId && !item.values[fieldKey]
              ? { ...item, values: { ...item.values, [fieldKey]: point } }
              : item,
          ),
        }
      })
    }

    return { location: point, takenAt }
  }

  function handleCapture(target: SlotTarget, files: FileList | null) {
    if (!files || files.length === 0 || !id || !user) return
    setError(null)
    setHighlightedNodeId(null)

    const nodeId = slotNodeId(target.sectionKey, target.slotKey, target.itemId)
    const queued: PendingUpload[] = Array.from(files).map((file, index) => ({
      id: `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      nodeId,
      previewUrl: URL.createObjectURL(file),
      failed: false,
      file,
      target,
    }))

    setPendingPhotos((previous) => [...previous, ...queued])

    // The thumbnail is already on screen. Each file is read on its own: a batch
    // picked from the gallery can span several trenches and several hours, so
    // one position for all of them would be wrong.
    for (const item of queued) {
      void metadataForCapture(target, item.file).then(({ location, takenAt }) => {
        setPendingPhotos((previous) =>
          previous.map((candidate) =>
            candidate.id === item.id ? { ...candidate, location, takenAt } : candidate,
          ),
        )
        void uploadPending({ ...item, location, takenAt })
      })
    }
  }

  function handleRetry(pendingId: string) {
    const item = pendingPhotos.find((candidate) => candidate.id === pendingId)
    if (!item) return
    setError(null)
    setPendingPhotos((previous) =>
      previous.map((candidate) =>
        candidate.id === pendingId ? { ...candidate, failed: false } : candidate,
      ),
    )
    void uploadPending({ ...item, failed: false })
  }

  /** Scrolls to the first unmet requirement instead of greying out the send button. */
  function focusFirstMissing() {
    const target = evaluation?.missing[0]
    if (!target) return
    setHighlightedNodeId(target.nodeId)
    document.getElementById(target.nodeId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handlePhotoDelete(photoId: string, storagePath: string) {
    setDeletingPhotoId(photoId)
    setError(null)
    const { error } = await deleteWorkOrderPhoto(photoId, storagePath)
    if (error) {
      setError(t('rueckmeldung.photos.deleteFailed', { error }))
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

  /** The single write of the Rückmeldung: answers plus the reported services. */
  async function persistCaptureReport(submitted: boolean): Promise<string | null> {
    if (!plan || !id || !user) return null
    const { error } = await saveCaptureReport({
      workOrderId: id,
      plan,
      answers,
      userId: user.id,
      submitted,
      reportedServiceItems: reportedServiceItems(),
    })
    return error
  }

  async function handleSave() {
    if (!id || !order) return
    setIsSaving(true)
    setError(null)
    setSavedOk(false)
    setQueuedNotice(null)

    // No network: the draft lives on the device. Nothing is queued for upload —
    // a draft is not a submission, and re-saving it later replaces it.
    if (!navigator.onLine) {
      await cacheAnswers(id, answers, reportedServiceItems())
      setQueuedNotice(t('offline.savedLocally'))
      setIsSaving(false)
      return
    }

    const reportError = await persistCaptureReport(false)
    if (reportError) {
      setError(reportError)
      setIsSaving(false)
      return
    }

    // Keep the offline copy current, so reopening without coverage shows what
    // was just saved rather than what was loaded.
    await cacheAnswers(id, answers, reportedServiceItems())

    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
    setIsSaving(false)
  }

  /** The note the transition carries. Identical whether it is sent now or queued. */
  function buildNotes(consumptionLines: number): string {
    const noteParts: string[] = []
    if (techNotes.trim()) noteParts.push(techNotes.trim())
    if (startTime) noteParts.push(`${t('rueckmeldung.startTime')}: ${startTime}`)
    if (endTime) noteParts.push(`${t('rueckmeldung.endTime')}: ${endTime}`)
    if (consumptionLines > 0) {
      noteParts.push(t('rueckmeldung.materialConsumption.notes.summary', { count: consumptionLines }))
    }
    return noteParts.length > 0 ? noteParts.join(' | ') : t('rueckmeldung.submitted')
  }

  function buildNotification(notes: string): ReportSubmittedNotification | null {
    if (!order || !user || !id) return null
    return {
      orderNumber: order.order_number,
      techName: user.fullName || user.email || '',
      workType: L.orderType(order),
      siteRef: orderSiteRef(order) ?? undefined,
      address: order.address ?? '',
      city: order.city ?? '',
      summary: notes,
      techNotes: techNotes.trim() || undefined,
      orderUrl: `${window.location.origin}/admin/orders/${id}`,
      orderId: id,
    }
  }

  async function handleSend() {
    if (!id || !user || !order) return

    // The button is never greyed out: an incomplete Rückmeldung answers by
    // jumping to what is missing.
    if (evaluation && !evaluation.canSubmit) {
      focusFirstMissing()
      return
    }

    setIsSending(true)
    setError(null)
    setQueuedNotice(null)

    const validConsumption = consumptionDrafts.filter((d) => d.material_id && d.quantity > 0)
    if (validConsumption.length > 0 && !selectedVehicleId) {
      setError(t('rueckmeldung.materialConsumption.errors.vehicleRequired'))
      setIsSending(false)
      return
    }
    const consumptionDraftValues = validConsumption.map(({ _key: _k, ...rest }) => {
      void _k
      return rest
    })
    const notes = buildNotes(validConsumption.length)

    // An order that cannot legally reach `rueckmeldung_sent` — cancelled,
    // already certified, still unassigned — is one the technician must not be
    // left filling in for nothing, online or queued.
    const sendPath = rueckmeldungSendPath(order.status)
    if (!sendPath) {
      setError(t('rueckmeldung.errors.notSendable', { status: L.status(order.status) }))
      setIsSending(false)
      return
    }

    // No network: the whole submission goes to the device and is replayed in
    // order — photos, then answers, then the transition — when there is one.
    // The plan is what pins the answers to a version, so without it there is
    // nothing coherent to queue.
    if (!navigator.onLine) {
      if (!plan) {
        setError(t('capture.planMissing', { key: order.capture_plan_key ?? order.work_type }))
        setIsSending(false)
        return
      }

      const queued = await enqueueSubmission({
        workOrderId: id,
        planKey: plan.key,
        planVersion: plan.version,
        answers,
        reportedServiceItems: reportedServiceItems(),
        notes,
        consumption:
          consumptionDraftValues.length > 0
            ? { vehicleId: selectedVehicleId, drafts: consumptionDraftValues }
            : null,
        notification: buildNotification(notes),
        userId: user.id,
        userRole: user.role,
      })

      if (!queued) {
        setError(t('offline.sendQueuedFailed'))
        setIsSending(false)
        return
      }

      await cacheAnswers(id, answers, reportedServiceItems())
      void refreshPendingCounts()
      setIsSending(false)
      navigate(`/tech/orders/${id}`)
      return
    }

    const reportError = await persistCaptureReport(true)
    if (reportError) {
      setError(reportError)
      setIsSending(false)
      return
    }

    if (consumptionDraftValues.length > 0) {
      const result = await registerMaterialConsumption({
        workOrderId: id,
        vehicleId: selectedVehicleId,
        reportedBy: user.id,
        drafts: consumptionDraftValues,
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

    // Walk whatever route the state machine has from where the order actually
    // is. Usually one or two hops (executed → rueckmeldung_pending → sent), but
    // the screen is reachable by link from earlier statuses too. Only the last
    // hop carries the notes: it is the one the admin reads.
    for (const [index, step] of sendPath.entries()) {
      const { error: stepError } = await transitionWorkOrderStatus(
        id,
        step,
        user.id,
        index === sendPath.length - 1 ? notes : undefined,
        user.role,
      )
      if (stepError) {
        setError(stepError)
        setIsSending(false)
        return
      }
    }

    const notification = buildNotification(notes)
    if (notification) notifyReportSubmitted(notification)
    navigate(`/tech/orders/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error ?? t('rueckmeldung.notFound')}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/tech/orders/${id}`)}
          aria-label={t('rueckmeldung.back')}
          className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-lg font-bold text-fg-1">{t('rueckmeldung.title')}</h2>
          <p className="text-xs text-fg-2 font-mono">
            {order.order_number}
            {orderSiteRef(order) ? ` · ${orderSiteRef(order)}` : ''} · {L.orderType(order)}
          </p>
        </div>
      </div>

      {/* Loaded from the device: the form works, but it is as old as it says. */}
      {offlineSince && (
        <div className="rounded-s border border-warn/30 bg-warn/10 px-4 py-2 text-xs text-warn">
          {t('offline.cachedView', { time: new Date(offlineSince).toLocaleString() })}
        </div>
      )}

      {/* Non-conformity banner */}
      {order.status === 'returned' && returnedNote && (
        <div className="rounded-l border border-err/50 bg-err/10 p-4">
          <p className="inline-flex items-center gap-2 font-semibold text-err">
            <AlertTriangle size={16} strokeWidth={1.5} />
            {t('rueckmeldung.returned.title')}
          </p>
          <p className="mt-1 text-sm text-err">{returnedNote}</p>
          <p className="mt-2 text-xs text-err">{t('rueckmeldung.returned.hint')}</p>
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.customer')}</p>
            <p className="font-medium text-fg-1">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.project')}</p>
            <p className="font-medium text-fg-1">{order.projects?.code ?? '—'}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">{t('workOrder.address')}</p>
              <p className="font-medium text-fg-1">{[order.address, order.city].filter(Boolean).join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Time inputs */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">{t('rueckmeldung.times.title')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <TimePickerField label={t('rueckmeldung.times.start')} value={startTime} onChange={setStartTime} />
          <TimePickerField label={t('rueckmeldung.times.end')} value={endTime} onChange={setEndTime} />
        </div>
      </div>

      {/* Alta multi-item billing editor — prices stay hidden, only the technician
          declares what was executed; admin sees the prices in CertificationPage */}
      {order.work_type === 'alta' && (
        <div className="rounded-l border border-accent/30 bg-bg-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-fg-1">{t('rueckmeldung.reported.title')}</h3>
              <p className="text-xs text-fg-2">{t('rueckmeldung.reported.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={addReportedLine}
              className="rounded-s border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            >
              {t('rueckmeldung.reported.add')}
            </button>
          </div>

          {reportedDrafts.length === 0 ? (
            <p className="rounded-s border border-dashed border-line bg-bg-0 p-3 text-center text-xs text-fg-2">
              {t('rueckmeldung.reported.empty', { action: t('rueckmeldung.reported.add') })}
            </p>
          ) : (
            <div className="space-y-2">
              {reportedDrafts.map((line) => {
                const selectedItem = catalog.find((c) => c.id === line.service_item_id)
                return (
                  <div
                    key={line._key}
                    className="rounded-s border border-line bg-bg-0 p-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_auto]"
                  >
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-2">
                        {t('rueckmeldung.reported.service')}
                      </label>
                      <select
                        value={line.service_item_id}
                        onChange={(e) => setReportedLineField(line._key, 'service_item_id', e.target.value)}
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="">{t('rueckmeldung.reported.choose')}</option>
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
                        {t('rueckmeldung.reported.qty')} {selectedItem?.unit ? `(${selectedItem.unit})` : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.qty}
                        onChange={(e) => setReportedLineField(line._key, 'qty', Number(e.target.value))}
                        className="w-full rounded-s border border-line bg-bg-1 px-2 py-1.5 text-right font-mono text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeReportedLine(line._key)}
                        className="rounded-s border border-err/40 px-3 py-1.5 text-xs text-err hover:bg-err/10 transition-colors"
                        title={t('rueckmeldung.reported.remove')}
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

      {/* Trench review — the positions come from each photo's watermark, so the
          screen proposes the split and the technician confirms or corrects it.
          Only for plans that actually have trenches (soplado_ra today). */}
      {/* Trench review — the pins are the ones the technician placed; this only
          shows them together on a map so he can vouch for them before sending. */}
      {reviewTrenches.length > 0 && (
        <TrenchReview
          trenches={reviewTrenches}
          photoPaths={Object.fromEntries(photos.map((photo) => [photo.id, photo.storage_path]))}
          photoUrls={photoUrls}
          projectCentre={projectCenter}
          acceptedAt={reviewAccepted}
          onMovePin={handleTrenchPin}
          onAccept={handleTrenchAccept}
          onReject={handleTrenchReject}
        />
      )}

      {/* Capture plan — photos and technical data, driven by the plan of this
          work order (its capture_plan_key, or its work type) */}
      {plan && evaluation ? (
        <CapturePlanForm
          plan={plan}
          answers={answers}
          evaluation={evaluation}
          photos={photos}
          projectCenter={projectCenter}
          photoUrls={photoUrls}
          exampleUrls={exampleUrls}
          pending={pendingPhotos}
          highlightedNodeId={highlightedNodeId}
          deletingPhotoId={deletingPhotoId}
          onFieldChange={handleFieldChange}
          onCapture={handleCapture}
          onRetry={handleRetry}
          onDeletePhoto={(photo) => handlePhotoDelete(photo.id, photo.storage_path)}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
        />
      ) : (
        <div className="rounded-l border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {t('capture.planMissing', { key: order.capture_plan_key ?? order.work_type })}
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
                {vehicle.name} · {L.team(vehicle.team)}
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

      {/* Technician notes */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <label className="mb-1 block text-xs font-medium text-fg-2">
          {t('rueckmeldung.notes.label')}
        </label>
        <textarea
          value={techNotes}
          onChange={(e) => setTechNotes(e.target.value)}
          rows={3}
          placeholder={t('rueckmeldung.notes.placeholder')}
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
          {t('rueckmeldung.saved')}
        </div>
      )}
      {queuedNotice && (
        <div className="rounded-s border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {queuedNotice}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={isSaving || isSending}
          onClick={handleSave}
          className="rounded-l border border-line px-4 py-3 text-sm font-semibold text-fg-1 hover:bg-bg-0 disabled:opacity-50 transition-colors"
        >
          {isSaving ? t('rueckmeldung.actions.saving') : t('rueckmeldung.actions.save')}
        </button>
        {/* Never greyed out when incomplete: it says what is missing and, on tap,
            scrolls to the first thing the plan is still waiting for. */}
        <button
          disabled={isSaving || isSending}
          onClick={handleSend}
          className={`rounded-l px-4 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 ${
            evaluation && !evaluation.canSubmit
              ? 'border border-accent bg-transparent text-accent'
              : 'bg-accent text-ink'
          }`}
        >
          {isSending
            ? t('rueckmeldung.actions.sending')
            : evaluation && !evaluation.canSubmit
              ? t('capture.missing.summary', { count: evaluation.missing.length })
              : order.status === 'returned'
                ? t('rueckmeldung.actions.sendCorrected')
                : t('rueckmeldung.actions.send')}
        </button>
      </div>

      <p className="text-center text-xs text-fg-2">
        {t('rueckmeldung.footer')}
      </p>
    </div>
  )
}
