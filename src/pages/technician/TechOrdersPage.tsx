import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { fetchMyWorkOrders } from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import type { Database } from '@/types/database.types'
import { STATUS_LABELS, WORK_TYPE_LABELS, PRIORITY_LABELS } from '@/constants/labels'
import { STATUS_COLORS, TEAM_DOT, PRIORITY_COLORS } from '@/constants/styles'

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'] & {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
}

export function TechOrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<WorkOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const userId = user.id
    const team = user.team
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error } = await fetchMyWorkOrders(userId, team)
      if (cancelled) return
      if (error) setError(error)
      else setOrders(data as unknown as WorkOrderRow[])
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const filtered = search.trim()
    ? orders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(search.toLowerCase()) ||
          (o.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (o.city ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : orders

  const returnedOrders = filtered.filter((o) => o.status === 'returned')
  const activeOrders = filtered.filter(
    (o) => ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(o.status),
  )
  const otherOrders = filtered.filter(
    (o) => !['assigned', 'in_progress', 'executed', 'rueckmeldung_pending', 'returned'].includes(o.status),
  )

  function OrderCard({ order }: { order: WorkOrderRow }) {
    const isActive = ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(order.status)
    return (
      <button
        onClick={() => navigate(`/tech/orders/${order.id}`)}
        className={`w-full rounded-gf-card border p-4 text-left transition-all active:scale-[0.99] ${
          isActive
            ? 'border-gf-primary/40 bg-gf-card shadow-gf-sm'
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
      <div className="rounded-gf-btn border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-gf-text">Meine Aufträge</h2>
          <p className="text-sm text-gf-text-muted">{orders.length} Aufträge zugewiesen</p>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Auftrag suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-gf-btn border border-gf-border bg-gf-card px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          />
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-gf-card border border-gf-border bg-gf-card py-16 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-gf-text-muted">Keine aktiven Aufträge</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returnedOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">
                ⚠ Zurückgegeben — Korrektur erforderlich ({returnedOrders.length})
              </p>
              <div className="space-y-2">
                {returnedOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
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
