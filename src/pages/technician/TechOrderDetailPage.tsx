import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchStateHistory,
  workTypeToDetailTable,
  transitionWorkOrderStatus,
} from '@/services/workOrderService'
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

interface StateHistoryEntry {
  id: string
  from_status: WorkOrderStatus | null
  to_status: WorkOrderStatus
  changed_by: string
  notes: string | null
  created_at: string
}

export function TechOrderDetailPage() {
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
    clients: { name: string; code: string } | null
    projects: { name: string; code: string } | null
    operators: { name: string; code: string } | null
  } | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [history, setHistory] = useState<StateHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchWorkOrder(id),
      fetchStateHistory(id),
    ]).then(async ([{ data: orderData, error: orderErr }, { data: histData }]) => {
      if (orderErr || !orderData) {
        setError(orderErr ?? 'Auftrag nicht gefunden')
        setIsLoading(false)
        return
      }
      setOrder(orderData as unknown as typeof order)
      setHistory(histData as StateHistoryEntry[])

      // Load detail
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

  async function handleTransition(toStatus: WorkOrderStatus, notes: string) {
    if (!id || !user) return
    setIsTransitioning(true)
    setError(null)
    const { data: updated, error } = await transitionWorkOrderStatus(id, toStatus, user.id, notes)
    if (error) {
      setError(error)
      setIsTransitioning(false)
    } else {
      setOrder((prev) => prev ? { ...prev, status: updated!.status } : prev)
      // Refresh history
      const { data: histData } = await fetchStateHistory(id)
      setHistory(histData as StateHistoryEntry[])
      setIsTransitioning(false)
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

  const hasDetail = Object.values(detail).some((v) => v !== null && v !== '' && v !== false)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tech/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-gf-text truncate">{order.order_number}</h2>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-xs text-gf-text-muted">{WORK_TYPE_LABELS[order.work_type]} · {order.line}</p>
        </div>
      </div>

      {/* Action buttons — status transitions */}
      {order.status === 'assigned' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('in_progress', 'Arbeit begonnen')}
          className="w-full rounded-xl bg-gf-accent px-4 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? 'Wird aktualisiert…' : '▶ In Bearbeitung setzen'}
        </button>
      )}

      {order.status === 'in_progress' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('executed', 'Ausführung abgeschlossen')}
          className="w-full rounded-xl bg-gf-warning px-4 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? 'Wird aktualisiert…' : '✓ Ausführung abgeschlossen'}
        </button>
      )}

      {order.status === 'executed' && (
        <button
          onClick={() => navigate(`/tech/orders/${order.id}/rueckmeldung`)}
          className="w-full rounded-xl bg-gf-primary px-4 py-3.5 text-sm font-semibold text-white hover:bg-gf-primary-dark transition-colors"
        >
          📝 Rückmeldung ausfüllen
        </button>
      )}

      {order.status === 'rueckmeldung_sent' && (
        <div className="rounded-xl border border-gf-success/30 bg-gf-success/10 px-4 py-3 text-sm text-emerald-700">
          Rückmeldung wurde gesendet. Der Admin prüft die Daten.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Order info */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Auftragsdetails</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gf-text-muted">Kunde</p>
            <p className="font-medium text-gf-text">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gf-text-muted">Projekt</p>
            <p className="font-medium text-gf-text">{order.projects?.code ?? '—'}</p>
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
              <span className="font-medium capitalize text-gf-text">
                {order.assigned_team ?? '—'}
              </span>
            </div>
          </div>
          {order.assigned_date && (
            <div>
              <p className="text-xs text-gf-text-muted">Einsatzdatum</p>
              <p className="font-medium text-gf-text">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gf-text-muted">Priorität</p>
            <p className="font-medium text-gf-text capitalize">{order.priority}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-gf-text-muted">Adresse</p>
              <p className="font-medium text-gf-text">
                {[order.address, order.postal_code, order.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div className="col-span-2">
              <p className="text-xs text-gf-text-muted">Notizen</p>
              <p className="font-medium text-gf-text">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Technical details (pre-filled by admin) */}
      {hasDetail && (
        <div className="rounded-xl border border-gf-border bg-gf-card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">
            Technische Vorgaben — {WORK_TYPE_LABELS[order.work_type]}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(detail).map(([key, value]) => {
              if (value === null || value === '' || value === undefined) return null
              const label = key.replace(/_/g, ' ')
              return (
                <div key={key}>
                  <p className="text-xs capitalize text-gf-text-muted">{label}</p>
                  <p className="font-medium text-gf-text">
                    {typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : String(value)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="rounded-xl border border-gf-border bg-gf-card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Verlauf</h3>
          <ol className="space-y-2">
            {history.map((entry, i) => (
              <li key={entry.id} className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full ${i === history.length - 1 ? 'bg-gf-primary' : 'bg-gf-border'}`} />
                  {i < history.length - 1 && <div className="mt-1 h-5 w-px bg-gf-border" />}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-xs font-medium text-gf-text">
                    {entry.from_status
                      ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                      : STATUS_LABELS[entry.to_status]}
                  </p>
                  {entry.notes && <p className="text-xs text-gf-text-muted">{entry.notes}</p>}
                  <p className="text-xs text-gf-text-muted">
                    {new Date(entry.created_at).toLocaleString('de-DE')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
