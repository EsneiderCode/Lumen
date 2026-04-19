import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { fetchMyWorkOrders, type WorkOrderWithRelations } from '@/services/workOrderService'
import type { TeamColor } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT, PRIORITY_COLORS } from '@/constants/styles'

const PAGE_SIZE = 20

export function TechOrdersPage() {
  const L = useLabels()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
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
      const { data, total, error } = await fetchMyWorkOrders(userId, team, page, PAGE_SIZE)
      if (cancelled) return
      if (error) setError(error)
      else { setOrders(data); setTotal(total) }
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [user, page])

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

  function OrderCard({ order }: { order: WorkOrderWithRelations }) {
    const isActive = ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending'].includes(order.status)
    return (
      <button
        onClick={() => navigate(`/tech/orders/${order.id}`)}
        className={`w-full rounded-card border p-4 text-left transition-all active:scale-[0.99] ${
          isActive
            ? 'border-accent/40 bg-bg-1'
            : 'border-line bg-bg-1 opacity-75'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-accent">{order.order_number}</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
            {L.status(order.status)}
          </span>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-fg-1">{L.workType(order.work_type)}</span>
          <span className="text-xs text-fg-2">{order.line}</span>
          {order.assigned_team && (
            <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team as TeamColor]}`} />
          )}
        </div>

        {(order.address || order.city) && (
          <p className="mb-2 text-xs text-fg-2">
            {[order.address, order.city].filter(Boolean).join(', ')}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-fg-2">
            {order.clients?.code ?? '—'} · {order.projects?.code ?? '—'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
              {L.priority(order.priority)}
            </span>
            {order.assigned_date && (
              <span className="text-xs text-fg-2">
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-btn border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-fg-1">Meine Aufträge</h2>
          <p className="text-sm text-fg-2">{total} Aufträge zugewiesen</p>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Auftrag suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-card border border-line bg-bg-1 py-16 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-fg-2">Keine aktiven Aufträge</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returnedOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-err">
                ⚠ Zurückgegeben — Korrektur erforderlich ({returnedOrders.length})
              </p>
              <div className="space-y-2">
                {returnedOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
          {activeOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-2">
                Aktiv ({activeOrders.length})
              </p>
              <div className="space-y-2">
                {activeOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
          {otherOrders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-2">
                Abgeschlossen / Gesendet ({otherOrders.length})
              </p>
              <div className="space-y-2">
                {otherOrders.map((o) => <OrderCard key={o.id} order={o} />)}
              </div>
            </div>
          )}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <span className="font-mono text-xs text-fg-2">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} von {total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-btn border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Zurück
                </button>
                <button
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-btn border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Weiter →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
