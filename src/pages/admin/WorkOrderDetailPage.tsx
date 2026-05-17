import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Receipt,
  CreditCard,
  Send,
  Undo2,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrderPhotos,
  fetchStateHistory,
  fetchBillingLines,
  buildBillingDraftsFromReportedItems,
  normalizeReportedServiceItems,
  transitionWorkOrderStatus,
  certifyWorkOrderInternal,
  acceptWorkOrderClient,
  invoiceWorkOrder,
  workTypeToDetailTable,
  getPhotoSignedUrls,
  generateDataHash,
  insertCertificationAudit,
  fetchCertificationAudits,
  upsertBillingLines,
  getCollaboratorType,
  type CollaboratorType,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import { generateCertificatePdf } from '@/services/pdfService'
import type { WorkOrderStatus, UserRole } from '@/types/enums'
import { useTranslation } from 'react-i18next'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'
import { DocumentUploader } from '@/components/ui/DocumentUploader'
import {
  notifyOrderReturnedForCorrection,
  notifyOrderStatusChanged,
} from '@/services/notificationService'
import { fetchServiceItems } from '@/services/serviceItemService'
import { InvoicePreviewModal } from '@/components/admin/InvoicePreviewModal'
import { fetchContractorDocumentCompliance } from '@/services/contractorDocumentService'
import type { ContractorDocumentType } from '@/types/contractor-documents'

// Catalog detail_form values for infra work — hide address, show
// supporting-document uploaders. POP items live here too: they're
// central-site installations, not customer installations.
const INFRA_DETAIL_FORMS = new Set(['soplado', 'fusion_ap', 'fusion_dp', 'pop'])

// detail_form -> document types to render on the detail page, matching
// WorkOrderFormPage. Keep in sync.
const DOCUMENT_TYPES_BY_DETAIL_FORM: Record<
  string,
  Array<{
    type: 'plano' | 'cartas_empalme' | 'diagrama_routing'
    label: string
    hint: string
  }>
> = {
  soplado: [
    { type: 'plano', label: 'Plan / Trassenplan', hint: 'PDF oder Excel' },
    {
      type: 'cartas_empalme',
      label: 'Spleißprotokolle (Cartas de empalme)',
      hint: 'PDF oder Excel',
    },
  ],
  fusion_ap: [
    { type: 'plano', label: 'Plan / Trassenplan', hint: 'PDF oder Excel' },
    {
      type: 'cartas_empalme',
      label: 'Spleißprotokolle (Cartas de empalme)',
      hint: 'PDF oder Excel',
    },
  ],
  fusion_dp: [
    { type: 'plano', label: 'Plan / Trassenplan', hint: 'PDF oder Excel' },
    {
      type: 'cartas_empalme',
      label: 'Spleißprotokolle (Cartas de empalme)',
      hint: 'PDF oder Excel',
    },
  ],
  pop: [
    { type: 'diagrama_routing', label: 'Diagramm Routing-Pipes', hint: 'PDF, Excel oder Bild' },
  ],
}

type PhotoType = 'before' | 'during' | 'after'

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

// Ordered workflow stages for the progress bar. Keep aligned with state machine.
const WORKFLOW_STAGES: WorkOrderStatus[] = [
  'created',
  'assigned',
  'in_progress',
  'executed',
  'rueckmeldung_pending',
  'rueckmeldung_sent',
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'invoiced',
  'paid',
]

function workflowProgress(status: WorkOrderStatus): { pct: number; variant: string } {
  if (status === 'client_rejected') return { pct: 70, variant: 'err' }
  if (status === 'returned' || status === 'cancelled') return { pct: 10, variant: 'warn' }
  const idx = WORKFLOW_STAGES.indexOf(status)
  if (idx < 0) return { pct: 0, variant: 'ok' }
  const pct = Math.round(((idx + 1) / WORKFLOW_STAGES.length) * 100)
  return { pct, variant: status === 'paid' ? 'ok' : '' }
}

type ModalType =
  | 'send_to_client'
  | 'accept'
  | 'reject'
  | 'invoice'
  | 'mark_paid'
  | 'return_nonconformity'
  | null

interface ModalState {
  type: ModalType
  inputValue: string
  categoryValue: string
}

export function WorkOrderDetailPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<WorkOrderWithRelations | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<StateEntry[]>([])
  const [certAudits, setCertAudits] = useState<
    Array<{
      id: string
      cert_type: 'internal' | 'client' | 'external'
      certified_at: string
      data_hash: string
      notes: string | null
      profiles: { full_name: string } | null
    }>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: null, inputValue: '', categoryValue: '' })

  // Invoice preview modal — replaces the LUM-018 free-text invoice number prompt
  const [previewOpen, setPreviewOpen] = useState(false)
  // Collaborator type — derived from assignee's profile.role on order load
  const [collabType, setCollabType] = useState<CollaboratorType>('internal')
  // Whether an external cert audit already exists for this order
  const hasExternalCert = certAudits.some((a) => a.cert_type === 'external')
  // External cert confirmation modal
  const [externalCertOpen, setExternalCertOpen] = useState(false)
  const [externalCertNotes, setExternalCertNotes] = useState('')
  const [isCertifyingExternal, setIsCertifyingExternal] = useState(false)
  const [externalDocCompliance, setExternalDocCompliance] = useState<{
    isCompliant: boolean
    missingTypes: ContractorDocumentType[]
  } | null>(null)

  const externalMissingDocs = externalDocCompliance?.missingTypes ?? []
  const externalDocsBlocked = Boolean(externalDocCompliance && !externalDocCompliance.isCompliant)
  const externalMissingDocLabels = externalMissingDocs
    .map((type) => t(`contractorDocs.types.${type}`))
    .join(', ')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchWorkOrder(id),
      fetchWorkOrderPhotos(id),
      fetchStateHistory(id),
      fetchCertificationAudits(id),
    ]).then(
      async ([
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
        setOrder(orderData)
        const loadedPhotos = (photoData ?? []) as Photo[]
        setPhotos(loadedPhotos)
        getPhotoSignedUrls(loadedPhotos.map((p) => p.storage_path)).then(setPhotoUrls)
        setHistory((histData ?? []) as unknown as StateEntry[])
        setCertAudits(auditData)

        // Resolve collaborator type from the assignee's profile role
        setCollabType('internal')
        setExternalDocCompliance(null)
        if (orderData.assigned_technician) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', orderData.assigned_technician)
            .single()
          const role = (prof as { role?: UserRole } | null)?.role
          const resolvedCollabType = getCollaboratorType(role)
          setCollabType(resolvedCollabType)
          if (resolvedCollabType === 'external') {
            const { data: compliance } = await fetchContractorDocumentCompliance(
              orderData.assigned_technician,
            )
            setExternalDocCompliance({
              isCompliant: compliance.isCompliant,
              missingTypes: compliance.missingTypes,
            })
          }
        }

        const table = workTypeToDetailTable(orderData.work_type)
        const { data: detailData } = await fetchWorkOrderDetail(table, id)
        if (detailData) {
          const {
            id: _i,
            work_order_id: _w,
            created_at: _c,
            ...rest
          } = detailData as Record<string, unknown>
          void _i
          void _w
          void _c
          setDetail(rest)
        }
        setIsLoading(false)
      },
    )
  }, [id])

  async function refreshLifecycleEvidence(workOrderId: string) {
    const [{ data: histData }, { data: auditData }] = await Promise.all([
      fetchStateHistory(workOrderId),
      fetchCertificationAudits(workOrderId),
    ])
    setHistory((histData ?? []) as unknown as StateEntry[])
    setCertAudits(auditData)
  }

  async function doTransition(toStatus: WorkOrderStatus, notes: string) {
    if (!id || !user || !order) return
    setIsTransitioning(true)
    setError(null)
    const { data: updated, error: err } = await transitionWorkOrderStatus(
      id,
      toStatus,
      user.id,
      notes,
      user.role,
    )
    if (err) {
      setError(err)
    } else {
      setOrder((prev) => (prev ? { ...prev, status: updated!.status } : prev))
      await refreshLifecycleEvidence(id)
      setModal({ type: null, inputValue: '', categoryValue: '' })
      // Skip 'returned' — notifyOrderReturnedForCorrection is called at the call site
      if (toStatus !== 'returned')
        void notifyOrderStatusChanged(
          order.order_number,
          L.status(toStatus),
          user.email ?? undefined,
        )
    }
    setIsTransitioning(false)
  }

  async function handleClientAccept(notes: string) {
    if (!id || !user || !order) return
    setIsTransitioning(true)
    setError(null)
    const hash = await generateDataHash({
      order_number: order.order_number,
      status: 'client_accepted',
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
      notes,
    })
    const result = await acceptWorkOrderClient({
      workOrderId: id,
      changedBy: user.id,
      dataHash: hash,
      notes,
    })
    if (!result.ok) {
      setError(
        result.reasons.map((reason) => reason.message).join('; ') || 'Kundenabnahme fehlgeschlagen',
      )
    } else {
      setOrder((prev) => (prev ? { ...prev, status: result.data!.status } : prev))
      await refreshLifecycleEvidence(id)
      setModal({ type: null, inputValue: '', categoryValue: '' })
    }
    setIsTransitioning(false)
  }

  async function handleInvoice(invoiceNumber: string) {
    if (!id || !user || !order) return
    setIsTransitioning(true)
    setError(null)
    const notes = `Rechnung: ${invoiceNumber}`
    const result = await invoiceWorkOrder({
      workOrderId: id,
      changedBy: user.id,
      billingReference: invoiceNumber,
      notes,
    })
    if (!result.ok) {
      setError(
        result.reasons.map((reason) => reason.message).join('; ') || 'Fakturierung fehlgeschlagen',
      )
    } else {
      setOrder((prev) => (prev ? { ...prev, status: result.data!.status } : prev))
      await refreshLifecycleEvidence(id)
      setModal({ type: null, inputValue: '', categoryValue: '' })
    }
    setIsTransitioning(false)
  }

  async function handleCertify() {
    if (!order || !user) return
    // Prices belong to admin certification, not to the service order visible
    // in the field. Before sealing an Alta order, refresh price snapshots from
    // the admin-only billing/catalog query so technicians never need to carry
    // or see amounts.
    if (order.work_type === 'alta') {
      const reportedItems = normalizeReportedServiceItems(detail.reported_service_items)
      let drafts = []

      if (reportedItems.length > 0) {
        const { data: catalog, error: catalogErr } = await fetchServiceItems({
          includeInactive: true,
          includePrices: true,
        })
        if (catalogErr) {
          setError(catalogErr)
          return
        }

        drafts = buildBillingDraftsFromReportedItems(reportedItems, catalog)
        if (drafts.length !== reportedItems.length) {
          setError(
            'Ein oder mehrere gemeldete Service-Posten fehlen im Katalog oder haben keinen internen Preis.',
          )
          return
        }
      } else {
        // Backward compatibility for Alta orders reported before migration 015.
        const { data: lines, error: lineErr } = await fetchBillingLines(order.id)
        if (lineErr) {
          setError(lineErr)
          return
        }
        if (lines.length === 0) {
          setError('Keine geleisteten Posten für diese Alta-Rückmeldung vorhanden.')
          return
        }
        drafts = lines.map((line) => ({
          id: line.id,
          service_item_id: line.service_item_id,
          qty: Number(line.qty),
          unit_price_snapshot: Number(
            line.service_items?.unit_price ?? line.unit_price_snapshot ?? 0,
          ),
          unit_price_external_snapshot:
            line.service_items?.unit_price_external ?? line.unit_price_external_snapshot ?? null,
          notes: line.notes,
        }))
      }

      const { error: priceErr } = await upsertBillingLines(order.id, drafts)
      if (priceErr) {
        setError(priceErr)
        return
      }
    }
    // LUM-024: generate audit hash before transitioning.
    // Include sorted photo paths so swapping a photo post-certification
    // invalidates the hash — photos are load-bearing evidence, they must
    // be covered by the integrity seal.
    const photoPaths = photos.map((p) => p.storage_path).sort()
    const hashData = {
      order_number: order.order_number,
      work_type: order.work_type,
      detail,
      photo_paths: photoPaths,
      certified_by: user.id,
      certified_at: new Date().toISOString(),
    }
    const hash = await generateDataHash(hashData)
    setIsTransitioning(true)
    setError(null)
    const result = await certifyWorkOrderInternal({
      workOrderId: order.id,
      changedBy: user.id,
      dataHash: hash,
      notes: 'Interne Zertifizierung',
    })
    if (!result.ok) {
      setError(
        result.reasons.map((reason) => reason.message).join('; ') ||
          'Interne Zertifizierung fehlgeschlagen',
      )
    } else {
      setOrder((prev) => (prev ? { ...prev, status: result.data!.status } : prev))
      await refreshLifecycleEvidence(order.id)
    }
    setIsTransitioning(false)
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
        void handleClientAccept(modal.inputValue.trim() || 'Vom Kunden akzeptiert')
        break
      case 'reject':
        if (!modal.inputValue.trim()) return
        void doTransition('client_rejected', modal.inputValue.trim())
        break
      case 'invoice':
        if (!modal.inputValue.trim()) return
        void handleInvoice(modal.inputValue.trim())
        break
      case 'mark_paid':
        void doTransition('paid', 'Als bezahlt markiert')
        break
      case 'return_nonconformity': {
        if (!modal.categoryValue || modal.inputValue.trim().length < 20) return
        const reason = `Nichtkonformität (${modal.categoryValue}): ${modal.inputValue.trim()}`
        void doTransition('returned', reason)
        if (order)
          void notifyOrderReturnedForCorrection(
            order.order_number,
            reason,
            user?.email ?? undefined,
          )
        break
      }
    }
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        role="status"
        aria-label="Wird geladen"
      >
        <div className="nx-loader" aria-hidden="true" />
      </div>
    )
  }

  if (!order) {
    return (
      <div
        role="alert"
        className="rounded-s border border-err/30 bg-err/10 px-4 py-4 text-sm text-err"
      >
        <p className="font-semibold">{error ?? 'Auftrag nicht gefunden'}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => navigate('/admin/orders')}
            className="rounded-s border border-err/30 px-3 py-1.5 text-xs text-err hover:bg-err/10 transition-colors"
          >
            ← Zur Übersicht
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-s border border-err/30 px-3 py-1.5 text-xs text-err hover:bg-err/10 transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
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
    [
      'rueckmeldung_sent',
      'internally_certified',
      'sent_to_client',
      'client_accepted',
      'client_rejected',
      'invoiced',
      'paid',
    ].includes(order.status),
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
            aria-label="Zurück"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-fg-1">{order.order_number}</h2>
              <span className={`badge badge-dot ${STATUS_COLORS[order.status]}`}>
                {L.status(order.status)}
              </span>
            </div>
            <p className="text-sm text-fg-2">
              {L.workType(order.work_type)} · Linie {order.line}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showPdfButton && (
            <button
              onClick={handlePdfDownload}
              className="inline-flex items-center gap-1.5 rounded-s border border-line px-3 py-1.5 text-xs font-medium text-fg-2 hover:border-accent hover:text-accent transition-colors"
            >
              <FileText size={14} strokeWidth={1.5} />
              PDF
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/orders/${id}/edit`)}
            className="rounded-s border border-line px-3 py-1.5 text-xs font-medium text-fg-2 hover:border-accent hover:text-accent transition-colors"
          >
            Bearbeiten
          </button>
        </div>
      </div>

      {/* Workflow progress */}
      {(() => {
        const { pct, variant } = workflowProgress(order.status)
        return (
          <div className="rounded-l border border-line bg-bg-1 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="nx-label">Workflow</span>
              <span className="font-mono text-xs tabular-nums text-fg-2">
                {pct}% · {L.status(order.status)}
              </span>
            </div>
            <div className="nx-progress">
              <div className={`nx-progress-fill ${variant}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })()}

      {/* ── Workflow banners ── */}

      {/* rueckmeldung_sent → internally_certified */}
      {order.status === 'rueckmeldung_sent' && (
        <div className="rounded-l border border-warn/40 bg-warn/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-warn">{t('workOrder.rueckmeldungPresent')}</p>
              <p className="text-sm text-warn">
                Technische Daten und Fotos geprüft? Intern zertifizieren.
              </p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('return_nonconformity')}
                className="flex-1 rounded-s border border-err/40 px-3 py-2 text-sm font-semibold text-err hover:bg-err/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 size={14} strokeWidth={1.5} />
                  Zurückgeben
                </span>
              </button>
              <button
                disabled={isTransitioning}
                onClick={handleCertify}
                className="flex-1 rounded-s bg-ok px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity sm:flex-none"
              >
                {isTransitioning ? (
                  'Wird zertifiziert…'
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={14} strokeWidth={1.5} />
                    Intern zertifizieren
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* internally_certified → sent_to_client / direct invoice (LUM-015) */}
      {order.status === 'internally_certified' && order.client_id !== null && (
        <div className="rounded-l border border-ok/40 bg-ok/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ok">{t('workOrder.internallyCertified')}</p>
              <p className="text-sm text-ok">
                Auftrag kann jetzt an den Kunden weitergeleitet werden.
              </p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('return_nonconformity')}
                className="flex-1 rounded-s border border-err/40 px-3 py-2 text-sm font-semibold text-err hover:bg-err/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 size={14} strokeWidth={1.5} />
                  Zurückgeben
                </span>
              </button>
              <button
                disabled={isTransitioning}
                onClick={() => openModal('send_to_client')}
                className="flex-1 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors sm:flex-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} strokeWidth={1.5} />
                  An Kunden senden
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sent_to_client → client_accepted / client_rejected (LUM-017) */}
      {order.status === 'sent_to_client' && (
        <div className="rounded-l border border-accent/30 bg-accent/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-accent">Beim Kunden</p>
              <p className="text-sm text-fg-2">
                Auf Rückmeldung des Kunden warten oder Ergebnis eintragen.
              </p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                disabled={isTransitioning}
                onClick={() => openModal('reject')}
                className="flex-1 rounded-s border border-err/40 px-3 py-2 text-sm font-semibold text-err hover:bg-err/10 disabled:opacity-50 transition-colors sm:flex-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  <XCircle size={14} strokeWidth={1.5} />
                  Abgelehnt
                </span>
              </button>
              <button
                disabled={isTransitioning}
                onClick={() => openModal('accept')}
                className="flex-1 rounded-s bg-ok px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity sm:flex-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} strokeWidth={1.5} />
                  Akzeptiert
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* client_rejected — rejection banner + return to revision (LUM-017) */}
      {order.status === 'client_rejected' && (
        <div className="rounded-l border border-err/40 bg-err/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-err">Vom Kunden abgelehnt</p>
              {rejectionEntry?.notes && (
                <p className="mt-1 text-sm text-err">{rejectionEntry.notes}</p>
              )}
            </div>
            <button
              disabled={isTransitioning}
              onClick={() =>
                void doTransition('internally_certified', 'Zur Überarbeitung zurückgegeben')
              }
              className="shrink-0 rounded-s border border-warn/40 px-3 py-2 text-sm font-semibold text-warn hover:bg-warn/10 disabled:opacity-50 transition-colors"
            >
              {isTransitioning ? (
                '…'
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw size={14} strokeWidth={1.5} />
                  Zur Überarbeitung
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* client_accepted → invoiced (LUM-018, replaced by InvoicePreviewModal) */}
      {order.status === 'client_accepted' && (
        <div className="rounded-l border border-ok/40 bg-ok/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-ok">Vom Kunden akzeptiert</p>
              <p className="text-sm text-ok">
                Vorschau der Fakturierung anzeigen — Posten und Beträge.
              </p>
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 rounded-s bg-err px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <span className="inline-flex items-center gap-1.5">
                <Receipt size={14} strokeWidth={1.5} />
                Fakturierung vorbereiten
              </span>
            </button>
          </div>
        </div>
      )}

      {/* internally_certified + Direktauftrag → invoiced (PR #8 shortcut) */}
      {order.status === 'internally_certified' && order.client_id == null && (
        <div className="rounded-l border border-fg-2/30 bg-bg-1 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-fg-1">Direktauftrag — bereit zur Fakturierung</p>
              <p className="text-sm text-fg-2">Kein externer Kunde — direkt fakturieren.</p>
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 rounded-s bg-err px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <span className="inline-flex items-center gap-1.5">
                <Receipt size={14} strokeWidth={1.5} />
                Direkt fakturieren
              </span>
            </button>
          </div>
        </div>
      )}

      {/* External-collaborator certification action (W1.5)
          Visible whenever the assignee is a contractor and the order is at
          internally_certified or beyond. Runs in parallel with the client
          flow — does NOT change order status. */}
      {collabType === 'external' &&
        ['internally_certified', 'sent_to_client', 'client_accepted', 'invoiced', 'paid'].includes(
          order.status,
        ) && (
          <div className="rounded-l border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-accent">Externer Mitarbeiter — Zertifizierung</p>
                <p className="text-sm text-fg-2">
                  {hasExternalCert
                    ? 'Zertifizierung an externen Mitarbeiter bereits ausgestellt.'
                    : externalDocsBlocked
                      ? t('contractorDocs.certificationBlockedWithList', {
                          docs: externalMissingDocLabels,
                        })
                      : 'Ausstellen, sobald die Leistung des Subunternehmers abgenommen ist — gibt die Auszahlung frei.'}
                </p>
              </div>
              <button
                disabled={hasExternalCert || isCertifyingExternal || externalDocsBlocked}
                onClick={() => setExternalCertOpen(true)}
                className="shrink-0 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} strokeWidth={1.5} />
                  {hasExternalCert ? 'Bereits zertifiziert' : 'An externen zertifizieren'}
                </span>
              </button>
            </div>
          </div>
        )}

      {/* invoiced → paid (LUM-018) */}
      {order.status === 'invoiced' && (
        <div className="rounded-l border border-err/30 bg-err/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-info">Fakturiert</p>
              <p className="text-sm text-fg-2">
                {history.findLast((e) => e.to_status === 'invoiced')?.notes ?? 'Rechnung erstellt'}
              </p>
            </div>
            <button
              disabled={isTransitioning}
              onClick={() => openModal('mark_paid')}
              className="shrink-0 rounded-s bg-ok px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <span className="inline-flex items-center gap-1.5">
                <CreditCard size={14} strokeWidth={1.5} />
                Als bezahlt markieren
              </span>
            </button>
          </div>
        </div>
      )}

      {/* returned — correction required banner */}
      {order.status === 'returned' && (
        <div className="rounded-l border border-warn/40 bg-warn/10 p-4">
          <div className="flex items-start gap-3">
            <Undo2 size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warn" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-warn">
                Korrektur erforderlich — Zurückgegeben an Techniker
              </p>
              {(() => {
                const returnEntry = [...history].reverse().find((e) => e.to_status === 'returned')
                return returnEntry?.notes ? (
                  <p className="mt-1 text-sm text-warn break-words">{returnEntry.notes}</p>
                ) : null
              })()}
              <p className="mt-2 text-xs text-fg-2">
                Der Techniker sieht diesen Hinweis und kann die Rückmeldung korrigieren.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* paid — final state banner */}
      {order.status === 'paid' && (
        <div className="rounded-l border border-ok/30 bg-ok/10 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ok">
            <Check size={14} strokeWidth={1.5} />
            Bezahlt — Auftrag abgeschlossen
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err"
        >
          {error}
        </div>
      )}

      {/* Supporting documents — uploaders per catalog detail_form. */}
      {(() => {
        const detailForm = order.service_items?.detail_form
        if (!detailForm || !INFRA_DETAIL_FORMS.has(detailForm) || !user) return null
        const docTypes = DOCUMENT_TYPES_BY_DETAIL_FORM[detailForm] ?? []
        if (docTypes.length === 0) return null
        return (
          <div className="rounded-l border border-line bg-bg-1 p-5">
            <div className="mb-4">
              <h3 className="font-display text-sm font-semibold text-fg-1">
                Unterstützende Dokumente
              </h3>
              <p className="mt-0.5 text-xs text-fg-2">{docTypes.map((d) => d.label).join(' · ')}</p>
            </div>
            <div
              className={`grid grid-cols-1 gap-5 ${docTypes.length > 1 ? 'md:grid-cols-2' : ''}`}
            >
              {docTypes.map((doc) => (
                <DocumentUploader
                  key={doc.type}
                  workOrderId={order.id}
                  uploadedBy={user.id}
                  documentType={doc.type}
                  label={doc.label}
                  hint={doc.hint}
                />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Service item — canonical rate-card reference */}
      {order.service_items && (
        <div className="rounded-l border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">
                Leistung (Katalog)
              </p>
              <p className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-accent">
                  {order.service_items.code}
                </span>
                <span className="text-sm text-fg-1">{order.service_items.description_de}</span>
              </p>
              {order.service_items.description_es && (
                <p className="mt-0.5 text-xs italic text-fg-2">
                  ES: {order.service_items.description_es}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-fg-2 font-mono">
              {order.service_items.unit && <span>{order.service_items.unit}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Order info */}
      <div className="rounded-l border border-line bg-bg-1 p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-fg-1">Auftragsdaten</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-fg-2">Kunde</p>
            <p className="font-medium text-fg-1">
              {order.clients?.name ?? '—'} ({order.clients?.code ?? '—'})
            </p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Projekt</p>
            <p className="font-medium text-fg-1">
              {order.projects?.code ?? '—'} – {order.projects?.name ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Betreiber</p>
            <p className="font-medium text-fg-1">{order.operators?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Team</p>
            <div className="flex items-center gap-1.5">
              {order.assigned_team && (
                <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
              )}
              <span className="font-medium capitalize text-fg-1">{order.assigned_team ?? '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-fg-2">Priorität</p>
            <p className="font-medium capitalize text-fg-1">{order.priority}</p>
          </div>
          {order.assigned_date && (
            <div>
              <p className="text-xs text-fg-2">Einsatzdatum</p>
              <p className="font-medium text-fg-1">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          {(order.address || order.city) && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-fg-2">Adresse</p>
              <p className="font-medium text-fg-1">
                {[order.address, order.postal_code, order.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-fg-2">Interne Notizen</p>
              <p className="font-medium text-fg-1">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* LUM-023: Side-by-side comparison — Beauftragt vs. Gemeldet */}
      {showComparison ? (
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-fg-1">
            {t('comparison.title')} — {L.workType(order.work_type)}
          </h3>
          <p className="mb-4 text-xs text-fg-2">{t('comparison.subtitle')}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-sm">
            {/* Column headers */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-2 border-b border-line pb-1">
              {t('comparison.assigned')}
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent border-b border-line pb-1">
              {t('comparison.reported')}
            </p>
            {/* Field rows — iterate over the union of keys */}
            {Array.from(new Set([...Object.keys(snapshot!), ...Object.keys(detail)])).map((key) => {
              const label = L.detailField(key)
              const assignedVal = snapshot![key]
              const reportedVal = detail[key]
              const isDiff = String(assignedVal ?? '') !== String(reportedVal ?? '')
              const fmt = (v: unknown) => {
                if (v === null || v === undefined || v === '') return '—'
                if (typeof v === 'boolean') return v ? 'Ja ✓' : 'Nein ✗'
                return String(v)
              }
              return (
                <Fragment key={key}>
                  <div className="py-2 border-b border-line/50">
                    <p className="text-xs text-fg-2 capitalize">{label}</p>
                    <p className="font-medium text-fg-1">{fmt(assignedVal)}</p>
                  </div>
                  <div
                    className={`py-2 border-b border-line/50 ${isDiff ? 'bg-warn/5 rounded' : ''}`}
                  >
                    <p className="text-xs text-fg-2 capitalize">{label}</p>
                    <p className={`font-medium ${isDiff ? 'text-warn' : 'text-fg-1'}`}>
                      {fmt(reportedVal)}
                      {isDiff && <span className="ml-1.5 text-xs">↕</span>}
                    </p>
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      ) : hasDetail ? (
        /* Simple view when no snapshot available (old orders) */
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-fg-1">
            Rückmeldung — {L.workType(order.work_type)}
          </h3>
          <p className="mb-4 text-xs text-fg-2">Vom Techniker eingetragene Daten</p>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {Object.entries(detail).map(([key, value]) => {
              const label = L.detailField(key)
              const isEmpty = value === null || value === undefined || value === ''
              return (
                <div key={key}>
                  <p className="text-xs capitalize text-fg-2">{label}</p>
                  <p className={`font-medium ${isEmpty ? 'text-fg-2' : 'text-fg-1'}`}>
                    {isEmpty
                      ? '—'
                      : typeof value === 'boolean'
                        ? value
                          ? 'Ja ✓'
                          : 'Nein ✗'
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
          <div className="rounded-l border border-line bg-bg-1 p-5">
            <h3 className="mb-2 font-display text-sm font-semibold text-fg-1">
              Notizen vom Techniker
            </h3>
            <p className="text-sm text-fg-1">{rmEntry.notes}</p>
          </div>
        )
      })()}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-fg-1">
            Fotos ({photos.length})
          </h3>
          <div className="space-y-4">
            {(['before', 'during', 'after'] as PhotoType[]).map((type) => {
              const typePhotos = photosByType(type)
              if (typePhotos.length === 0) return null
              return (
                <div key={type}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-2">
                    {L.photo(type)} ({typePhotos.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {typePhotos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photoUrls[photo.storage_path] ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square overflow-hidden rounded-s bg-bg-0 ring-1 ring-line hover:ring-accent transition-all"
                      >
                        <img
                          src={photoUrls[photo.storage_path] ?? ''}
                          alt={photo.caption ?? L.photo(type)}
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
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-fg-1">Fotos</h3>
          <p className="text-sm text-fg-2">Noch keine Fotos hochgeladen.</p>
        </div>
      )}

      {/* LUM-024: Certification audit trail */}
      {certAudits.length > 0 && (
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-fg-1">
            {t('certification.auditLog')}
          </h3>
          <p className="mb-4 text-xs text-fg-2">{t('certification.auditSubtitle')}</p>
          <div className="space-y-3">
            {certAudits.map((audit) => (
              <div key={audit.id} className="border border-line/60 p-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold ${
                        audit.cert_type === 'internal'
                          ? 'bg-ok/15 text-ok'
                          : 'bg-accent/15 text-accent'
                      }`}
                    >
                      {audit.cert_type === 'internal'
                        ? t('certification.internal')
                        : t('certification.client')}
                    </span>
                    <p className="mt-1 text-xs text-fg-2">
                      {new Date(audit.certified_at).toLocaleString('de-DE')}
                      {audit.profiles?.full_name && (
                        <span className="ml-1.5">· {audit.profiles.full_name}</span>
                      )}
                    </p>
                    {audit.notes && <p className="mt-0.5 text-xs text-fg-1">{audit.notes}</p>}
                  </div>
                </div>
                {/* Hash */}
                <div className="mt-2 border-t border-line/40 pt-2">
                  <p className="mb-0.5 text-xs text-fg-2">SHA-256</p>
                  <p className="font-mono text-xs text-fg-2 break-all">{audit.data_hash}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="rounded-l border border-line bg-bg-1 p-5">
          <h3 className="mb-4 font-display text-sm font-semibold text-fg-1">Statusverlauf</h3>
          <ol className="space-y-3">
            {history.map((entry, i) => (
              <li key={entry.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-0.5 h-2.5 w-2.5 rounded-full ${i === history.length - 1 ? 'bg-accent' : 'bg-line'}`}
                  />
                  {i < history.length - 1 && <div className="mt-1 h-6 w-px bg-line" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge badge-dot ${STATUS_COLORS[entry.to_status]}`}>
                      {L.status(entry.to_status)}
                    </span>
                    {entry.from_status && (
                      <span className="inline-flex items-center gap-1 text-xs text-fg-2">
                        <ArrowLeft size={12} strokeWidth={1.5} />
                        {L.status(entry.from_status)}
                      </span>
                    )}
                  </div>
                  {entry.notes && <p className="mt-0.5 text-xs text-fg-1">{entry.notes}</p>}
                  <p className="text-xs text-fg-2">
                    {new Date(entry.created_at).toLocaleString('de-DE')}
                    {entry.profiles?.full_name && (
                      <span className="ml-1.5 text-fg-2">· {entry.profiles.full_name}</span>
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
          className="modal-scrim centered"
          role="dialog"
          aria-modal="true"
          aria-label="Aktion bestätigen"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="w-full max-w-sm rounded-l border border-line bg-bg-1 p-6">
            {modal.type === 'send_to_client' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  An Kunden senden?
                </h3>
                <p className="mb-6 text-sm text-fg-2">
                  Der Auftrag wird an den Kunden weitergeleitet. Diese Aktion kann nicht rückgängig
                  gemacht werden.
                </p>
              </>
            )}
            {modal.type === 'accept' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  Vom Kunden akzeptiert
                </h3>
                <p className="mb-3 text-sm text-fg-2">Optionale Notiz zum Abschluss.</p>
                <textarea
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="Notiz (optional)…"
                  rows={3}
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder-fg-4 focus:border-accent focus:outline-none mb-5"
                />
              </>
            )}
            {modal.type === 'reject' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  Auftrag abgelehnt
                </h3>
                <p className="mb-3 text-sm text-fg-2">
                  Bitte Ablehnungsgrund angeben (Pflichtfeld).
                </p>
                <textarea
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="Ablehnungsgrund…"
                  rows={3}
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder-fg-4 focus:border-accent focus:outline-none mb-5"
                  autoFocus
                />
              </>
            )}
            {modal.type === 'invoice' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  Rechnung erstellen
                </h3>
                <p className="mb-3 text-sm text-fg-2">Rechnungsnummer eingeben (Pflichtfeld).</p>
                <input
                  type="text"
                  value={modal.inputValue}
                  onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                  placeholder="z.B. RE-2026-0042"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder-fg-4 focus:border-accent focus:outline-none mb-5"
                  autoFocus
                />
              </>
            )}
            {modal.type === 'mark_paid' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  Als bezahlt markieren?
                </h3>
                <p className="mb-6 text-sm text-fg-2">
                  Der Zahlungseingang wird bestätigt und der Auftrag als abgeschlossen markiert.
                </p>
              </>
            )}
            {modal.type === 'return_nonconformity' && (
              <>
                <h3 className="mb-2 font-display text-base font-bold text-fg-1">
                  Auftrag zurückgeben
                </h3>
                <p className="mb-4 text-sm text-fg-2">
                  Nichtkonformität angeben — beide Felder sind Pflicht.
                </p>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-fg-2">Kategorie</label>
                  <select
                    value={modal.categoryValue}
                    onChange={(e) => setModal((m) => ({ ...m, categoryValue: e.target.value }))}
                    autoFocus
                    className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none"
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
                  <label className="mb-1.5 block text-xs font-medium text-fg-2">
                    Beschreibung <span className="text-fg-4">(min. 20 Zeichen)</span>
                  </label>
                  <textarea
                    value={modal.inputValue}
                    onChange={(e) => setModal((m) => ({ ...m, inputValue: e.target.value }))}
                    placeholder="Detaillierte Beschreibung der Nichtkonformität…"
                    rows={4}
                    className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder-fg-4 focus:border-accent focus:outline-none resize-none"
                  />
                  {modal.inputValue.length > 0 && modal.inputValue.length < 20 && (
                    <p className="mt-1 text-xs text-err">
                      {20 - modal.inputValue.length} Zeichen fehlen
                    </p>
                  )}
                </div>
                <div className="mb-4" />
              </>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={isTransitioning}
                className="rounded-s border border-line px-4 py-2 text-sm font-medium text-fg-2 hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={
                  isTransitioning ||
                  ((modal.type === 'reject' || modal.type === 'invoice') &&
                    !modal.inputValue.trim()) ||
                  (modal.type === 'return_nonconformity' &&
                    (!modal.categoryValue || modal.inputValue.trim().length < 20))
                }
                className="rounded-s bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {isTransitioning ? '…' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice preview modal — replaces LUM-018 free-text prompt */}
      {previewOpen && (
        <InvoicePreviewModal
          order={{
            id: order.id,
            order_number: order.order_number,
            client_id: order.client_id,
            clients: order.clients,
          }}
          collaboratorType={collabType}
          onClose={() => setPreviewOpen(false)}
          onConfirm={async (invoiceNumber, _totalNote) => {
            void _totalNote
            await handleInvoice(invoiceNumber)
            setPreviewOpen(false)
          }}
        />
      )}

      {/* External-collaborator certification confirmation */}
      {externalCertOpen && (
        <div
          className="modal-scrim centered"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExternalCertOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-l border border-accent/40 bg-bg-1 overflow-hidden">
            <div className="h-0.5 w-full bg-accent" />
            <div className="p-6">
              <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">
                Externer Mitarbeiter
              </p>
              <h3 className="font-display text-base font-bold text-fg-1 mt-1">
                Zertifizierung an externen Mitarbeiter
              </h3>
              <p className="mt-2 text-sm text-fg-2">
                Bestätigt, dass die Leistung des Subunternehmers abgenommen wurde. Diese
                Zertifizierung ist die Grundlage für die Auszahlung an den externen Mitarbeiter —
                sie ändert NICHT den Auftragsstatus.
              </p>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-fg-2">
                  Hinweis (optional)
                </label>
                <textarea
                  rows={3}
                  value={externalCertNotes}
                  onChange={(e) => setExternalCertNotes(e.target.value)}
                  placeholder="z.B. Liquidationsperiode 04/2026"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setExternalCertOpen(false)}
                  disabled={isCertifyingExternal}
                  className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 hover:border-fg-1 hover:text-fg-1 disabled:opacity-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    if (!user) return
                    setIsCertifyingExternal(true)
                    if (order.assigned_technician) {
                      const { data: compliance } = await fetchContractorDocumentCompliance(
                        order.assigned_technician,
                      )
                      setExternalDocCompliance({
                        isCompliant: compliance.isCompliant,
                        missingTypes: compliance.missingTypes,
                      })
                      if (!compliance.isCompliant) {
                        const docs = compliance.missingTypes
                          .map((type) => t(`contractorDocs.types.${type}`))
                          .join(', ')
                        setError(t('contractorDocs.certificationBlockedWithList', { docs }))
                        setIsCertifyingExternal(false)
                        setExternalCertOpen(false)
                        return
                      }
                    }
                    const hash = await generateDataHash({
                      orderId: order.id,
                      certType: 'external',
                      timestamp: new Date().toISOString(),
                      certifiedBy: user.id,
                    })
                    const { error: certErr } = await insertCertificationAudit(
                      order.id,
                      'external',
                      user.id,
                      hash,
                      externalCertNotes.trim() || 'Externe Zertifizierung',
                    )
                    if (certErr) {
                      setError(certErr)
                    } else {
                      // Refresh local audits list so the badge updates without reload
                      const { data: refreshed } = await fetchCertificationAudits(order.id)
                      setCertAudits(refreshed)
                      setExternalCertOpen(false)
                      setExternalCertNotes('')
                    }
                    setIsCertifyingExternal(false)
                  }}
                  disabled={isCertifyingExternal}
                  className="rounded-s bg-accent px-5 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {isCertifyingExternal ? 'Wird ausgestellt…' : 'Zertifizierung ausstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
