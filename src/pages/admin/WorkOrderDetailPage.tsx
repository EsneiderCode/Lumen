import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrderPhotos,
  fetchStateHistory,
  transitionWorkOrderStatus,
  workTypeToDetailTable,
  getPhotoSignedUrls,
  generateDataHash,
  insertCertificationAudit,
  fetchCertificationAudits,
} from '@/services/workOrderService'
import { generateCertificatePdf } from '@/services/pdfService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created: 'Erstellt',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  executed: 'Ausgeführt',
  rueckmeldung_pending: 'RM ausstehend',
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Int. zertifiziert',
  sent_to_client: 'An Kunden gesendet',
  client_accepted: 'Akzeptiert',
  client_rejected: 'Abgelehnt',
  invoiced: 'Fakturiert',
  paid: 'Bezahlt',
  returned: 'Zurückgegeben',
  cancelled: 'Storniert',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'bg-gf-text-muted/20 text-gf-text-muted',
  assigned: 'bg-gf-primary/15 text-gf-primary-dark',
  in_progress: 'bg-gf-accent/15 text-gf-accent',
  executed: 'bg-gf-warning/15 text-amber-700',
  rueckmeldung_pending: 'bg-gf-warning/20 text-amber-700',
  rueckmeldung_sent: 'bg-gf-warning/10 text-amber-600',
  internally_certified: 'bg-gf-success/15 text-emerald-700',
  sent_to_client: 'bg-gf-primary/10 text-gf-primary-dark',
  client_accepted: 'bg-gf-success/20 text-emerald-700',
  client_rejected: 'bg-gf-danger/15 text-rose-700',
  invoiced: 'bg-gf-accent/10 text-purple-700',
  paid: 'bg-gf-success/25 text-emerald-800',
  returned: 'bg-gf-warning/15 text-amber-700',
  cancelled: 'bg-gf-danger/10 text-rose-600',
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

const TEAM_DOT: Record<TeamColor, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

const DETAIL_FIELD_LABELS: Record<string, string> = {
  meters: 'Meter',
  section: 'Abschnitt',
  tube_diameter: 'Rohrdurchmesser',
  result: 'Ergebnis',
  splice_count: 'Spleiß-Anzahl',
  fiber_type: 'Fasertyp',
  fusion_losses: 'Schmelzverluste (dB)',
  has_measurement_cert: 'Meßprotokoll',
  access_type: 'Zugangstyp',
  equipment_installed: 'Installierte Geräte',
  client_signature: 'Kundenunterschrift',
  nt_type: 'NT-Typ',
  serial_number: 'Seriennummer',
  location: 'Standort',
  configuration: 'Konfiguration',
  connected_section: 'Verbundener Abschnitt',
  cable_length: 'Kabellänge (m)',
  connector_type: 'Steckertyp',
  test_result: 'Testergebnis',
}

type PhotoType = 'before' | 'during' | 'after'

const PHOTO_LABELS: Record<PhotoType, string> = {
  before: 'Vorher',
  during: 'Während',
  after: 'Nachher',
}

interface Photo {
  id: string
  storage_path: string
  photo_type: PhotoType
  caption: string | null
}

interface StateEntry {
  id: string
  from_status: WorkOrderStatus | null
  to_status: WorkOrderStatus
  changed_by: string
  notes: string | null
  created_at: string
  profiles: { full_name: string } | null
}

// Statuses where PDF download is available
const PDF_VISIBLE_STATUSES: WorkOrderStatus[] = [
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
  'paid',
]

type ModalType = 'send_to_client' | 'accept' | 'reject' | 'invoice' | 'mark_paid' | 'return_nonconformity' | null

interface ModalState {
  type: ModalType
  inputValue: string
  categoryValue: string
}

export function WorkOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<{
    id: string
    order_number: string
    work_type: WorkType
    status: WorkOrderStatus
    priority: string
    line: string
    address: string | null
    postal_code: string | null
    city: string | null
    internal_notes: string | null
    assigned_date: string | null
    assigned_team: TeamColor | null
    assigned_detail_snapshot: Record<string, unknown> | null
    clients: { name: string; code: string } | null
    projects: { name: string; code: string } | null
    operators: { name: string; code: string } | null
  } | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<StateEntry[]>([])
  const [certAudits, setCertAudits] = useState<Array<{
    id: string
    cert_type: 'internal' | 'client'
    certified_at: string
    data_hash: string
    notes: string | null
    profiles: { full_name: string } | null
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: null, inputValue: '', categoryValue: '' })

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchWorkOrder(id),
      fetchWorkOrderPhotos(id),
      fetchStateHistory(id),
      fetchCertificationAudits(id),
    ]).then(async ([
      { data: orderData, error: orderErr },
      { data: photoData },
      { data: histData },
      { data: auditData },
    ]) => {
      if (orderErr || !orderData) {
        setError(orderErr ?? 'Auftrag nicht gefunden')
        setIsLoading(false)
        return
      }
      setOrder(orderData as unknown as typeof order)
      const loadedPhotos = (photoData ?? []) as Photo[]
      setPhotos(loadedPhotos)
      getPhotoSignedUrls(loadedPhotos.map((p) => p.storage_path)).then(setPhotoUrls)
      setHistory((histData ?? []) as unknown as StateEntry[])
      setCertAudits(auditData)

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

  async function doTransition(toStatus: WorkOrderStatus, notes: string) {
    if (!id || !user || !order) return
    setIsTransitioning(true)
    setError(null)
    const { data: updated, error: err } = await transitionWorkOrderStatus(id, toStatus, user.id, notes, user.role)
    if (err) {
      setError(err)
    } else {
      setOrder((prev) => (prev ? { ...prev, status: updated!.status } : prev))
      const { data: histData } = await fetchStateHistory(id)
      setHistory((histData ?? []) as unknown as StateEntry[])
      setModal({ type: null, inputValue: '', categoryValue: '' })
    }
    setIsTransitioning(false)
  }

  async function handleCertify() {
    if (!order || !user) return
    // LUM-024: generate audit hash before transitioning
    const hashData = {
      order_number: order.order_number,
      work_type: order.work_type,
      detail,
      certified_by: user.id,
      certified_at: new Date().toISOString(),
    }
    const hash = await generateDataHash(hashData)
    await doTransition('internally_certified', 'Intern zertifiziert durch Admin')
    await insertCertificationAudit(order.id, 'internal', user.id, hash, 'Interne Zertifizierung')
    const { data: auditData } = await fetchCertificationAudits(order.id)
    setCertAudits(auditData)
  }

  async function handlePdfDownload() {
    if (!order) return
    const paths = photos.map((p) => p.storage_path)
    const urls = paths.length > 0 ? await getPhotoSignedUrls(paths) : {}
    generateCertificatePdf(order, detail, photos, history, (path) => urls[path] ?? '')
  }

  function openModal(type: ModalType) {
    setModal({ type, inputValue: '', categoryValue: '' })
  }

  function closeModal() {
    setModal({ type: null, inputValue: '', categoryValue: '' })
  }

  function handleModalConfirm() {
    if (!modal.type) return
    switch (modal.type) {
      case 'send_to_client':
        void doTransition('sent_to_client', 'An Kunden gesendet')
        break
      case 'accept':
        void doTransition('client_accepted', modal.inputValue.trim() || 'Vom Kunden akzeptiert')
        break
      case 'reject':
        if (!modal.inputValue.trim()) return
        void doTransition('client_rejected', modal.inputValue.trim())
        break
      case 'invoice':
        if (!modal.inputValue.trim()) return
        void doTransition('invoiced', `Rechnung: ${modal.inputValue.trim()}`)
        break
      case 'mark_paid':
        void doTransition('paid', 'Als bezahlt markiert')
        break
      case 'return_nonconformity':
        if (!modal.categoryValue || modal.inputValue.trim().length < 20) return
        void doTransition('returned', `Nichtkonformität (${modal.categoryValue}): ${modal.inputValue.trim()}`)
        break
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
      <div className="rounded-gf-btn border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
        {error ?? 'Auftrag nicht gefunden'}
      </div>
    )
  }

  const hasDetail = Object.keys(detail).length > 0
  const photosByType = (type: PhotoType) => photos.filter((p) => p.photo_type === type)
  const showPdfButton = PDF_VISIBLE_STATUSES.includes(order.status)
  const snapshot = order.assigned_detail_snapshot
  // Show comparison only once the technician has submitted their report
  const showComparison = Boolean(
    snapshot &&
    hasDetail &&
    ['rueckmeldung_sent', 'internally_certified', 'sent_to_client',
     'client_accepted', 'client_rejected', 'invoiced', 'paid'].includes(order.status)
  )

  // Get the rejection reason from history
  const rejectionEntry = history.findLast((e) => e.to_status === 'client_rejected')

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-gf-btn border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-gf-text">{order.order_number}</h2>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="text-sm text-gf-text-muted">{WORK_TYPE_LABELS[order.work_type]} · Linie {order.line}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showPdfButton && (
            <button
              onClick={handlePdfDownload}
              className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
            >
              📄 PDF
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/orders/${id}/edit`)}
            className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
          >
            Bearbeiten
          </button>
        </div>
      </div>

      {/* ── Workflow banners ── */}

      {/* rueckmeldung_sent → internally_certified */}
      {order.status === 'rueckmeldung_sent' && (
        <div className="rounded-gf-card border border-gf-warning/40 bg-gf-warning/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-amber-700">Rückmeldung liegt vor</p>
              <p className="text-sm text-amber-600">Technische Daten und Fotos geprüft? Intern zertifizieren.</p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('return_nonconformity')}
                className="flex-1 rounded-gf-btn border border-gf-danger/40 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-gf-danger/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                ↩ Zurückgeben
              </button>
              <button
                disabled={isTransitioning}
                onClick={handleCertify}
                className="flex-1 rounded-gf-btn bg-gf-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity sm:flex-none"
              >
                {isTransitioning ? 'Wird zertifiziert…' : '✓ Intern zertifizieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* internally_certified → sent_to_client (LUM-015) */}
      {order.status === 'internally_certified' && (
        <div className="rounded-gf-card border border-gf-success/40 bg-gf-success/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-700">Intern zertifiziert</p>
              <p className="text-sm text-emerald-600">Auftrag kann jetzt an den Kunden weitergeleitet werden.</p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('return_nonconformity')}
                className="flex-1 rounded-gf-btn border border-gf-danger/40 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-gf-danger/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                ↩ Zurückgeben
              </button>
              <button
                disabled={isTransitioning}
                onClick={() => openModal('send_to_client')}
                className="flex-1 rounded-gf-btn bg-gf-primary px-4 py-2 text-sm font-semibold text-gf-base hover:bg-gf-primary-light disabled:opacity-50 transition-colors sm:flex-none"
              >
                📤 An Kunden senden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sent_to_client → client_accepted / client_rejected (LUM-017) */}
      {order.status === 'sent_to_client' && (
        <div className="rounded-gf-card border border-gf-primary/30 bg-gf-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-gf-primary-dark">Beim Kunden</p>
              <p className="text-sm text-gf-text-muted">Auf Rückmeldung des Kunden warten oder Ergebnis eintragen.</p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('reject')}
                className="flex-1 rounded-gf-btn border border-gf-danger/40 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-gf-danger/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                ❌ Abgelehnt
              </button>
              <button
                disabled={isTransitioning}
                onClick={() => openModal('accept')}
                className="flex-1 rounded-gf-btn bg-gf-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity sm:flex-none"
              >
                ✅ Akzeptiert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* client_rejected — rejection banner + return to revision (LUM-017) */}
      {order.status === 'client_rejected' && (
        <div className="rounded-gf-card border border-gf-danger/40 bg-gf-danger/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-rose-700">Vom Kunden abgelehnt</p>
              {rejectionEntry?.notes && (
                <p className="mt-1 text-sm text-rose-600">{rejectionEntry.notes}</p>
              )}
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => void doTransition('internally_certified', 'Zur Überarbeitung zurückgegeben')}
              className="shrink-0 rounded-gf-btn border border-gf-warning/40 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-gf-warning/10 disabled:opacity-50 transition-colors"
            >
              {isTransitioning ? '…' : '🔄 Zur Überarbeitung'}
            </button>
          </div>
        </div>
      )}

      {/* client_accepted → invoiced (LUM-018) */}
      {order.status === 'client_accepted' && (
        <div className="rounded-gf-card border border-gf-success/40 bg-gf-success/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-emerald-700">Vom Kunden akzeptiert</p>
              <p className="text-sm text-emerald-600">Rechnung erstellen und Auftrag fakturieren.</p>
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => openModal('invoice')}
              className="shrink-0 rounded-gf-btn bg-gf-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              🧾 Fakturieren
            </button>
          </div>
        </div>
      )}

      {/* invoiced → paid (LUM-018) */}
      {order.status === 'invoiced' && (
        <div className="rounded-gf-card border border-gf-accent/30 bg-gf-accent/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-purple-700">Fakturiert</p>
              <p className="text-sm text-gf-text-muted">
                {history.findLast((e) => e.to_status === 'invoiced')?.notes ?? 'Rechnung erstellt'}
              </p>
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => openModal('mark_paid')}
              className="shrink-0 rounded-gf-btn bg-gf-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              💳 Als bezahlt markieren
            </button>
          </div>
        </div>
      )}

      {/* paid — final state banner */}
      {order.status === 'paid' && (
        <div className="rounded-gf-card border border-gf-success/30 bg-gf-success/10 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700">✓ Bezahlt — Auftrag abgeschlossen</p>
        </div>
      )}

      {error && (
        <div className="rounded-gf-btn border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Order info */}
      <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Auftragsdaten</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-gf-text-muted">Kunde</p>
            <p className="font-medium text-gf-text">{order.clients?.name ?? '—'} ({order.clients?.code ?? '—'})</p>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Projekt</p>
            <p className="font-medium text-gf-text">{order.projects?.code ?? '—'} – {order.projects?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Betreiber</p>
            <p className="font-medium text-gf-text">{order.operators?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Team</p>
            <div className="flex items-center gap-1.5">
              {order.assigned_team && (
                <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
              )}
              <span className="font-medium capitalize text-gf-text">{order.assigned_team ?? '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Priorität</p>
            <p className="font-medium capitalize text-gf-text">{order.priority}</p>
          </div>
          {order.assigned_date && (
            <div>
              <p className="text-xs text-gf-text-muted">Einsatzdatum</p>
              <p className="font-medium text-gf-text">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          {(order.address || order.city) && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-gf-text-muted">Adresse</p>
              <p className="font-medium text-gf-text">
                {[order.address, order.postal_code, order.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-gf-text-muted">Interne Notizen</p>
              <p className="font-medium text-gf-text">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* LUM-023: Side-by-side comparison — Beauftragt vs. Gemeldet */}
      {showComparison ? (
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-gf-text">
            Vergleich — {WORK_TYPE_LABELS[order.work_type]}
          </h3>
          <p className="mb-4 text-xs text-gf-text-muted">Beauftragte Werte vs. gemeldete Istwerte</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-sm">
            {/* Column headers */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted border-b border-gf-border pb-1">
              Beauftragt
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-primary border-b border-gf-border pb-1">
              Gemeldet
            </p>
            {/* Field rows — iterate over the union of keys */}
            {Array.from(new Set([
              ...Object.keys(snapshot!),
              ...Object.keys(detail),
            ])).map((key) => {
              const label = DETAIL_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
              const assignedVal = snapshot![key]
              const reportedVal = detail[key]
              const isDiff = String(assignedVal ?? '') !== String(reportedVal ?? '')
              const fmt = (v: unknown) => {
                if (v === null || v === undefined || v === '') return '—'
                if (typeof v === 'boolean') return v ? 'Ja ✓' : 'Nein ✗'
                return String(v)
              }
              return (
                <>
                  <div key={`${key}-assigned`} className="py-2 border-b border-gf-border/50">
                    <p className="text-xs text-gf-text-muted capitalize">{label}</p>
                    <p className="font-medium text-gf-text">{fmt(assignedVal)}</p>
                  </div>
                  <div key={`${key}-reported`} className={`py-2 border-b border-gf-border/50 ${isDiff ? 'bg-gf-warning/5 rounded' : ''}`}>
                    <p className="text-xs text-gf-text-muted capitalize">{label}</p>
                    <p className={`font-medium ${isDiff ? 'text-gf-warning' : 'text-gf-text'}`}>
                      {fmt(reportedVal)}
                      {isDiff && <span className="ml-1.5 text-xs">↕</span>}
                    </p>
                  </div>
                </>
              )
            })}
          </div>
        </div>
      ) : hasDetail ? (
        /* Simple view when no snapshot available (old orders) */
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-gf-text">
            Rückmeldung — {WORK_TYPE_LABELS[order.work_type]}
          </h3>
          <p className="mb-4 text-xs text-gf-text-muted">Vom Techniker eingetragene Daten</p>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {Object.entries(detail).map(([key, value]) => {
              const label = DETAIL_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
              const isEmpty = value === null || value === undefined || value === ''
              return (
                <div key={key}>
                  <p className="text-xs capitalize text-gf-text-muted">{label}</p>
                  <p className={`font-medium ${isEmpty ? 'text-gf-text-muted' : 'text-gf-text'}`}>
                    {isEmpty
                      ? '—'
                      : typeof value === 'boolean'
                        ? value ? 'Ja ✓' : 'Nein ✗'
                        : String(value)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Technician notes */}
      {(() => {
        const rmEntry = history.find((e) => e.to_status === 'rueckmeldung_sent')
        if (!rmEntry?.notes || rmEntry.notes === 'Rückmeldung gesendet') return null
        return (
          <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
            <h3 className="mb-2 font-display text-sm font-semibold text-gf-text">Notizen vom Techniker</h3>
            <p className="text-sm text-gf-text">{rmEntry.notes}</p>
          </div>
        )
      })()}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Fotos ({photos.length})</h3>
          <div className="space-y-4">
            {(['before', 'during', 'after'] as PhotoType[]).map((type) => {
              const typePhotos = photosByType(type)
              if (typePhotos.length === 0) return null
              return (
                <div key={type}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted">
                    {PHOTO_LABELS[type]} ({typePhotos.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {typePhotos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photoUrls[photo.storage_path] ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square overflow-hidden rounded-gf-btn bg-gf-surface ring-1 ring-gf-border hover:ring-gf-primary transition-all"
                      >
                        <img
                          src={photoUrls[photo.storage_path] ?? ''}
                          alt={photo.caption ?? PHOTO_LABELS[type]}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-gf-text">Fotos</h3>
          <p className="text-sm text-gf-text-muted">Noch keine Fotos hochgeladen.</p>
        </div>
      )}

      {/* LUM-024: Certification audit trail */}
      {certAudits.length > 0 && (
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-gf-text">Zertifizierungsprotokoll</h3>
          <p className="mb-4 text-xs text-gf-text-muted">Kryptografischer Nachweis — manipulationssicher</p>
          <div className="space-y-3">
            {certAudits.map((audit) => (
              <div key={audit.id} className="border border-gf-border/60 p-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold ${
                      audit.cert_type === 'internal'
                        ? 'bg-gf-success/15 text-gf-success'
                        : 'bg-gf-primary/15 text-gf-primary'
                    }`}>
                      {audit.cert_type === 'internal' ? 'Interne Zertifizierung' : 'Kundenzertifizierung'}
                    </span>
                    <p className="mt-1 text-xs text-gf-text-muted">
                      {new Date(audit.certified_at).toLocaleString('de-DE')}
                      {audit.profiles?.full_name && (
                        <span className="ml-1.5">· {audit.profiles.full_name}</span>
                      )}
                    </p>
                    {audit.notes && (
                      <p className="mt-0.5 text-xs text-gf-text">{audit.notes}</p>
                    )}
                  </div>
                </div>
                {/* Hash */}
                <div className="mt-2 border-t border-gf-border/40 pt-2">
                  <p className="mb-0.5 text-xs text-gf-text-muted">SHA-256</p>
                  <p className="font-mono text-xs text-gf-text-muted break-all">
                    {audit.data_hash}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="rounded-gf-card border border-gf-border bg-gf-card p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-gf-text">Statusverlauf</h3>
          <ol className="space-y-3">
            {history.map((entry, i) => (
              <li key={entry.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${i === history.length - 1 ? 'bg-gf-primary' : 'bg-gf-border'}`} />
                  {i < history.length - 1 && <div className="mt-1 h-6 w-px bg-gf-border" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.to_status]}`}>
                      {STATUS_LABELS[entry.to_status]}
                    </span>
                    {entry.from_status && (
                      <span className="text-xs text-gf-text-muted">
                        ← {STATUS_LABELS[entry.from_status]}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="mt-0.5 text-xs text-gf-text">{entry.notes}</p>
                  )}
                  <p className="text-xs text-gf-text-muted">
                    {new Date(entry.created_at).toLocaleString('de-DE')}
                    {entry.profiles?.full_name && (
                      <span className="ml-1.5 text-gf-text-muted">· {entry.profiles.full_name}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Modal ── */}
      {modal.type && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full max-w-sm rounded-gf-card border border-gf-border bg-gf-card p-6 shadow-gf-modal">
            {modal.type === 'send_to_client' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">An Kunden senden?</h3>
                <p className="mb-6 text-sm text-gf-text-muted">
                  Der Auftrag wird an den Kunden weitergeleitet. Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </>
            )}
            {modal.type === 'accept' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">Vom Kunden akzeptiert</h3>
                <p className="mb-3 text-sm text-gf-text-muted">Optionale Notiz zum Abschluss.</p>
                <textarea
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="Notiz (optional)…"
                  rows={3}
                  className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none mb-5"
                />
              </>
            )}
            {modal.type === 'reject' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">Auftrag abgelehnt</h3>
                <p className="mb-3 text-sm text-gf-text-muted">Bitte Ablehnungsgrund angeben (Pflichtfeld).</p>
                <textarea
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="Ablehnungsgrund…"
                  rows={3}
                  className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none mb-5"
                  autoFocus
                />
              </>
            )}
            {modal.type === 'invoice' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">Rechnung erstellen</h3>
                <p className="mb-3 text-sm text-gf-text-muted">Rechnungsnummer eingeben (Pflichtfeld).</p>
                <input
                  type="text"
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="z.B. RE-2026-0042"
                  className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none mb-5"
                  autoFocus
                />
              </>
            )}
            {modal.type === 'mark_paid' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">Als bezahlt markieren?</h3>
                <p className="mb-6 text-sm text-gf-text-muted">
                  Der Zahlungseingang wird bestätigt und der Auftrag als abgeschlossen markiert.
                </p>
              </>
            )}
            {modal.type === 'return_nonconformity' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-gf-text">Auftrag zurückgeben</h3>
                <p className="mb-4 text-sm text-gf-text-muted">Nichtkonformität angeben — beide Felder sind Pflicht.</p>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-gf-text-muted">Kategorie</label>
                  <select
                    value={modal.categoryValue}
                    onChange={(e) => setModal((m) => ({ ...m, categoryValue: e.target.value }))}
                    autoFocus
                    className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none"
                  >
                    <option value="">— Kategorie wählen —</option>
                    <option value="datos incorrectos">Datos incorrectos</option>
                    <option value="fotos insuficientes">Fotos insuficientes</option>
                    <option value="mediciones faltantes">Mediciones faltantes</option>
                    <option value="trabajo incompleto">Trabajo incompleto</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="mb-1.5 block text-xs font-medium text-gf-text-muted">
                    Beschreibung <span className="text-gf-text-placeholder">(min. 20 Zeichen)</span>
                  </label>
                  <textarea
                    value={modal.inputValue}
                    onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                    placeholder="Detaillierte Beschreibung der Nichtkonformität…"
                    rows={4}
                    className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none resize-none"
                  />
                  {modal.inputValue.length > 0 && modal.inputValue.length < 20 && (
                    <p className="mt-1 text-xs text-rose-600">{20 - modal.inputValue.length} Zeichen fehlen</p>
                  )}
                </div>
                <div className="mb-4" />
              </>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={isTransitioning}
                className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary disabled:opacity-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={
                  isTransitioning ||
                  ((modal.type === 'reject' || modal.type === 'invoice') && !modal.inputValue.trim()) ||
                  (modal.type === 'return_nonconformity' && (!modal.categoryValue || modal.inputValue.trim().length < 20))
                }
                className="rounded-gf-btn bg-gf-primary px-4 py-2 text-sm font-semibold text-gf-base hover:bg-gf-primary-light disabled:opacity-50 transition-colors"
              >
                {isTransitioning ? '…' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
