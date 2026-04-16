import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchContractorWorkOrders } from '@/services/workOrderService'
import type { WorkOrderStatus, TeamColor } from '@/types/enums'
import type { Database } from '@/types/database.types'
import { STATUS_LABELS, WORK_TYPE_LABELS } from '@/constants/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'] & {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
}

// Payment indicator based on status
function PaymentBadge({ status }: { status: WorkOrderStatus }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gf-success/20 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        ✓ Bezahlt
      </span>
    )
  }
  if (status === 'invoiced') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gf-accent/10 px-2 py-0.5 text-xs font-semibold text-purple-700">
        🧾 Fakturiert
      </span>
    )
  }
  if (status === 'client_accepted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gf-warning/15 px-2 py-0.5 text-xs font-medium text-amber-700">
        Abrechnung ausstehend
      </span>
    )
  }
  return null
}

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'assigned', 'in_progress', 'executed',
  'rueckmeldung_pending', 'rueckmeldung_sent',
]

export function ContractorOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<WorkOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error } = await fetchContractorWorkOrders(userId)
      if (cancelled) return
      if (error) setError(error)
      else setOrders(data as unknown as WorkOrderRow[])
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const filtered = search.trim()
    ? orders.filter((o) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        (o.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (o.city ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : orders

  const activeOrders = filtered.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const closedOrders = filtered.filter((o) => !ACTIVE_STATUSES.includes(o.status))

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
          <p className="text-sm text-gf-text-muted">{orders.length} Aufträge</p>
        </div>
      </div>

      {/* Search */}
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
          <p className="mt-2 text-sm font-medium text-gf-text">Keine Aufträge</p>
          <p className="text-xs text-gf-text-muted">Ihnen wurden noch keine Aufträge zugewiesen.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeOrders.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted">
                Aktiv ({activeOrders.length})
              </p>
              <div className="space-y-2">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {closedOrders.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gf-text-muted">
                Abgeschlossen ({closedOrders.length})
              </p>
              <div className="space-y-2">
                {closedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }: { order: WorkOrderRow }) {
  const isActive = ACTIVE_STATUSES.includes(order.status)
  return (
    <div
      className={`rounded-gf-card border p-4 ${
        isActive
          ? 'border-gf-primary/40 bg-gf-card'
          : 'border-gf-border bg-gf-card opacity-80'
      }`}
    >
      {/* Top row: order number + status */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-gf-primary">
          {order.order_number}
        </span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Work type + line + team dot */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-gf-text">
          {WORK_TYPE_LABELS[order.work_type]}
        </span>
        <span className="text-xs text-gf-text-muted">{order.line}</span>
        {order.assigned_team && (
          <span
            className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team as TeamColor]}`}
          />
        )}
      </div>

      {/* Address */}
      {(order.address || order.city) && (
        <p className="mb-2 text-xs text-gf-text-muted">
          {[order.address, order.city].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Bottom row: client/project + date + payment */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-gf-text-muted">
            {order.clients?.code ?? '—'} · {order.projects?.code ?? '—'}
          </p>
          {order.assigned_date && (
            <p className="text-xs text-gf-text-muted">
              {new Date(order.assigned_date).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
        <PaymentBadge status={order.status} />
      </div>
    </div>
  )
}
