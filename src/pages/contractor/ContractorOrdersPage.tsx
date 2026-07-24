import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Receipt, ClipboardList } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchContractorWorkOrders, type WorkOrderWithRelations } from '@/services/workOrderService'
import type { WorkOrderStatus, TeamColor } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'

// Payment indicator based on status
function PaymentBadge({ status }: { status: WorkOrderStatus }) {
  const { t } = useTranslation()
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok/20 px-2 py-0.5 text-xs font-semibold text-ok">
        <Check size={12} strokeWidth={1.5} />
        {t('fieldOrders.paymentPaid')}
      </span>
    )
  }
  if (status === 'invoiced') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-err/10 px-2 py-0.5 text-xs font-semibold text-info">
        <Receipt size={12} strokeWidth={1.5} />
        {t('fieldOrders.paymentInvoiced')}
      </span>
    )
  }
  if (status === 'client_accepted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">
        {t('fieldOrders.paymentPending')}
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
  const { t } = useTranslation()
  const { user } = useAuth()
  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const { data, error } = await fetchContractorWorkOrders(userId, user?.team ?? null)
        if (cancelled) return
        if (error) setError(error)
        else setOrders(data)
      } catch {
        if (!cancelled) setError(t('errors.networkError'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, t])

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
        <div className="nx-loader" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-fg-1">{t('fieldOrders.title')}</h2>
          <p className="text-sm text-fg-2">{t('fieldOrders.count', { count: orders.length })}</p>
        </div>
      </div>

      {/* Search */}
      {orders.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={t('fieldOrders.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-l border border-line bg-bg-1 py-16 text-center">
          <ClipboardList size={28} strokeWidth={1.5} className="mx-auto text-fg-3" />
          <p className="mt-2 text-sm font-medium text-fg-1">{t('fieldOrders.emptyTitle')}</p>
          <p className="text-xs text-fg-2">{t('fieldOrders.emptyAssigned')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeOrders.length > 0 && (
            <section>
              <p className="mb-2 nx-label">
                {t('fieldOrders.activeSection', { count: activeOrders.length })}
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
              <p className="mb-2 nx-label">
                {t('fieldOrders.closedSection', { count: closedOrders.length })}
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

function OrderCard({ order }: { order: WorkOrderWithRelations }) {
  const L = useLabels()
  const { i18n } = useTranslation()
  const isActive = ACTIVE_STATUSES.includes(order.status)
  return (
    <div
      className={`rounded-l border p-4 ${
        isActive
          ? 'border-accent/40 bg-bg-1'
          : 'border-line bg-bg-1 opacity-80'
      }`}
    >
      {/* Top row: order number + status */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-accent">
          {order.order_number}
        </span>
        <span
          className={`badge badge-dot ${STATUS_COLORS[order.status]}`}
        >
          {L.status(order.status)}
        </span>
      </div>

      {/* Work type + line + team dot */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-fg-1">
          {L.workType(order.work_type)}
        </span>
        <span className="text-xs text-fg-2">{order.line}</span>
        {order.assigned_team && (
          <span
            className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team as TeamColor]}`}
          />
        )}
      </div>

      {/* Address */}
      {(order.address || order.city) && (
        <p className="mb-2 text-xs text-fg-2">
          {[order.address, order.city].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Bottom row: client/project + date + payment */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-fg-2">
            {order.clients?.code ?? '—'} · {order.projects?.code ?? '—'}
          </p>
          {order.assigned_date && (
            <p className="text-xs text-fg-2">
              {new Date(order.assigned_date).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'de-DE')}
            </p>
          )}
        </div>
        <PaymentBadge status={order.status} />
      </div>
    </div>
  )
}
