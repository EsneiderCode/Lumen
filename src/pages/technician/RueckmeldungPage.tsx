import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrderPhotos,
  upsertWorkOrderDetail,
  uploadWorkOrderPhoto,
  transitionWorkOrderStatus,
  workTypeToDetailTable,
  getPhotoPublicUrl,
} from '@/services/workOrderService'
import type { WorkType } from '@/types/enums'

// ── Detail field config (same as admin form, result-focused) ───

interface DetailField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox'
  options?: string[]
  placeholder?: string
}

const DETAIL_FIELDS: Record<WorkType, DetailField[]> = {
  soplado: [
    { key: 'meters', label: 'Meter geblasen', type: 'number', placeholder: '0' },
    { key: 'section', label: 'Abschnitt', type: 'text', placeholder: 'z.B. A1-B3' },
    { key: 'tube_diameter', label: 'Rohrdurchmesser', type: 'text', placeholder: 'z.B. 7/3.5' },
    { key: 'result', label: 'Ergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
  fusion_ap: [
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll erstellt', type: 'checkbox' },
  ],
  fusion_dp: [
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll erstellt', type: 'checkbox' },
  ],
  alta: [
    { key: 'access_type', label: 'Zugangstyp', type: 'select', options: ['Keller', 'Erdgeschoss', 'Obergeschoss', 'Dach', 'Außen'] },
    { key: 'equipment_installed', label: 'Installierte Geräte', type: 'text', placeholder: 'z.B. NT-100, Splitter' },
    { key: 'client_signature', label: 'Kundenunterschrift erhalten', type: 'checkbox' },
  ],
  nt_installation: [
    { key: 'nt_type', label: 'NT-Typ', type: 'select', options: ['NT-100', 'NT-200', 'NT-300', 'ONT', 'ONU'] },
    { key: 'serial_number', label: 'Seriennummer', type: 'text', placeholder: 'SN-XXXXXXXX' },
    { key: 'location', label: 'Standort', type: 'text', placeholder: 'z.B. Keller Raum 1' },
    { key: 'configuration', label: 'Konfiguration', type: 'text', placeholder: 'VLAN, IP…' },
  ],
  patchkabel: [
    { key: 'connected_section', label: 'Verbundener Abschnitt', type: 'text', placeholder: 'z.B. ODF-1 → ODF-2' },
    { key: 'cable_length', label: 'Kabellänge (m)', type: 'number', placeholder: '0' },
    { key: 'connector_type', label: 'Steckertyp', type: 'select', options: ['SC/APC', 'SC/UPC', 'LC/APC', 'LC/UPC', 'FC/APC'] },
    { key: 'test_result', label: 'Testergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

type PhotoType = 'before' | 'during' | 'after'

interface Photo {
  id: string
  storage_path: string
  photo_type: PhotoType
  caption: string | null
}

const PHOTO_LABELS: Record<PhotoType, string> = {
  before: 'Vorher',
  during: 'Während',
  after: 'Nachher',
}

export function RueckmeldungPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<{
    id: string
    order_number: string
    work_type: WorkType
    status: string
    address: string | null
    city: string | null
    clients: { name: string } | null
    projects: { code: string } | null
  } | null>(null)

  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [techNotes, setTechNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)

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
    ]).then(async ([{ data: orderData, error: orderErr }, { data: photoData }]) => {
      if (orderErr || !orderData) {
        setError(orderErr ?? 'Auftrag nicht gefunden')
        setIsLoading(false)
        return
      }
      setOrder(orderData as unknown as typeof order)
      setPhotos((photoData ?? []) as Photo[])

      // Load existing detail
      const table = workTypeToDetailTable(orderData.work_type)
      const { data: detailData } = await fetchWorkOrderDetail(table, id)
      if (detailData) {
        const { id: _i, work_order_id: _w, created_at: _c, ...rest } = detailData as Record<string, unknown>
        void _i; void _w; void _c
        setDetail(rest)
      }
      setIsLoading(false)
    })
  }, [id])

  function setDetailField(key: string, value: unknown) {
    setDetail((d) => ({ ...d, [key]: value }))
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
        setPhotos((prev) => [...prev, data as Photo])
      }
    }
    setUploadingType(null)
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
    } else {
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    }
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

    // Build notes string with tech input
    const noteParts: string[] = []
    if (techNotes.trim()) noteParts.push(`Notizen: ${techNotes.trim()}`)
    if (startTime) noteParts.push(`Beginn: ${startTime}`)
    if (endTime) noteParts.push(`Ende: ${endTime}`)
    const notes = noteParts.length > 0 ? noteParts.join(' | ') : 'Rückmeldung gesendet'

    const { error } = await transitionWorkOrderStatus(id, 'rueckmeldung_sent', user.id, notes)
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-lg font-bold text-gf-text">Rückmeldung</h2>
          <p className="text-xs text-gf-text-muted font-mono">{order.order_number} · {WORK_TYPE_LABELS[order.work_type]}</p>
        </div>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-gf-text-muted">Kunde</p>
            <p className="font-medium text-gf-text">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Projekt</p>
            <p className="font-medium text-gf-text">{order.projects?.code ?? '—'}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-gf-text-muted">Adresse</p>
              <p className="font-medium text-gf-text">{[order.address, order.city].filter(Boolean).join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Time inputs */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Einsatzzeiten</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gf-text-muted">Beginn</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gf-text-muted">Ende</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            />
          </div>
        </div>
      </div>

      {/* Dynamic detail fields */}
      {detailFields.length > 0 && (
        <div className="rounded-xl border border-gf-primary/30 bg-gf-card p-4">
          <h3 className="mb-1 font-display text-sm font-semibold text-gf-text">
            Technische Daten — {WORK_TYPE_LABELS[order.work_type]}
          </h3>
          <p className="mb-3 text-xs text-gf-text-muted">Ausgeführte Arbeit dokumentieren</p>
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
                      className="h-5 w-5 rounded border-gf-border text-gf-primary focus:ring-gf-primary"
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
                      className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2.5 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
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
                      className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2.5 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Fotos</h3>
        <div className="space-y-4">
          {(['before', 'during', 'after'] as PhotoType[]).map((type) => {
            const typePhotos = photosByType(type)
            return (
              <div key={type}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gf-text-muted uppercase tracking-wide">
                    {PHOTO_LABELS[type]} ({typePhotos.length})
                  </p>
                  <button
                    type="button"
                    disabled={uploadingType === type}
                    onClick={() => fileInputRefs[type].current?.click()}
                    className="rounded-lg border border-gf-border px-2.5 py-1 text-xs font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors disabled:opacity-50"
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
                  <div className="grid grid-cols-3 gap-2">
                    {typePhotos.map((photo) => (
                      <div key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-gf-surface">
                        <img
                          src={getPhotoPublicUrl(photo.storage_path)}
                          alt={photo.caption ?? PHOTO_LABELS[type]}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gf-border text-xs text-gf-text-muted hover:border-gf-primary/50 transition-colors"
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
      <div className="rounded-xl border border-gf-border bg-gf-card p-4">
        <label className="mb-1 block text-xs font-medium text-gf-text-muted">
          Notizen / Besonderheiten
        </label>
        <textarea
          value={techNotes}
          onChange={(e) => setTechNotes(e.target.value)}
          rows={3}
          placeholder="Besonderheiten, Probleme, Hinweise für Admin…"
          className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary resize-none"
        />
      </div>

      {/* Error / success */}
      {error && (
        <div className="rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {savedOk && (
        <div className="rounded-lg border border-gf-success/30 bg-gf-success/10 px-4 py-3 text-sm text-emerald-700">
          Daten gespeichert.
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={isSaving || isSending}
          onClick={handleSave}
          className="rounded-xl border border-gf-border px-4 py-3 text-sm font-semibold text-gf-text hover:bg-gf-surface disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Speichern…' : 'Zwischenspeichern'}
        </button>
        <button
          disabled={isSaving || isSending}
          onClick={handleSend}
          className="rounded-xl bg-gf-primary px-4 py-3 text-sm font-semibold text-white hover:bg-gf-primary-dark disabled:opacity-50 transition-colors"
        >
          {isSending ? 'Wird gesendet…' : 'Rückmeldung senden'}
        </button>
      </div>

      <p className="text-center text-xs text-gf-text-muted">
        "Rückmeldung senden" übermittelt alle Daten an den Admin zur Zertifizierung.
      </p>
    </div>
  )
}
