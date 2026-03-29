import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { fetchMyWorkOrders } from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import type { Database } from '@/types/database.types'

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'] & {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created: 'Erstellt',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  executed: 'Ausgeführt',
  rueckmeldung_pending: 'RM ausstehend',
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Zertifiziert',
  sent_to_client: 'An Kunden',
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

const PRIORITY_COLORS = {
  normal: 'text-gf-text-muted',
  alta: 'text-gf-warning',
  urgente: 'text-gf-danger',
}

const PRIORITY_LABELS = { normal: 'Normal', alta: 'Hoch', urgente: 'Dringend' }

export function TechOrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<WorkOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data, error } = await fetchMyWorkOrders(user.id, user.team)
    if (error) setError(error)
    else setOrders(data as unknown as WorkOrderRow[])
    setIsLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const activeOrders = orders.filter(
    (o) => ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(o.status),
  )
  const otherOrders = orders.filter(
    (o) => !['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(o.status),
  )

  function OrderCard({ order }: { order: WorkOrderRow }) {
    const isActive = ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(order.status)
    return (
      <button
        onClick={() => navigate(`/tech/orders/${order.id}`)}
        className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
          isActive
            ? 'border-gf-primary/40 bg-gf-card shadow-sm'
            : 'border-gf-border bg-gf-card opacity-75'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-gf-primary">{order.order_number}</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-gf-text">{WORK_TYPE_LABELS[order.work_type]}</span>
          <span className="text-xs text-gf-text-muted">{order.line}</span>
          {order.assigned_team && (
            <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team as TeamColor]}`} />
          )}
        </div>

        {(order.address || order.city) && (
          <p className="mb-2 text-xs text-gf-text-muted">
            {[order.address, order.city].filter(Boolean).join(', ')}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-gf-text-muted">
            {order.clients?.code ?? '—'} · {order.projects?.code ?? '—'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
              {PRIORITY_LABELS[order.priority]}
            </span>
            {order.assigned_date && (
              <span className="text-xs text-gf-text-muted">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold text-gf-text">Meine Aufträge</h2>
        <p className="text-sm text-gf-text-muted">{orders.length} Aufträge zugewiesen</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-gf-border bg-gf-card py-16 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-gf-text-muted">Keine aktiven Aufträge</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted">
                Aktiv ({activeOrders.length})
              </p>
              <div className="space-y-2">
                {activeOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
          {otherOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted">
                Abgeschlossen / Gesendet ({otherOrders.length})
              </p>
              <div className="space-y-2">
                {otherOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
