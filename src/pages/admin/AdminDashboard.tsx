import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { fetchWorkOrders, type WorkOrderWithRelations } from '@/services/workOrderService'
import type { WorkOrderStatus } from '@/types/enums'
import { STATUS_GROUPS } from '@/i18n/labels'

interface StatCounts {
  open: number
  inProgress: number
  pendingCert: number
  done: number
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<StatCounts>({ open: 0, inProgress: 0, pendingCert: 0, done: 0 })
  const [alerts, setAlerts] = useState<WorkOrderWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Use pageSize=1 to minimise data transfer — we only need the `total` count per status.
      // Attention feed needs actual records, so fetch up to 10.
      const countBucket = (statuses: WorkOrderStatus[]) =>
        Promise.all(statuses.map((s) => fetchWorkOrders({ status: s }, 0, 1)))
          .then((rs) => rs.reduce((sum, r) => sum + r.total, 0))

      const [openCount, inProgCount, pendCertCount, doneCount, attnData] = await Promise.all([
        countBucket(STATUS_GROUPS.open),
        countBucket(STATUS_GROUPS.inProgress),
        countBucket(STATUS_GROUPS.pendingCert),
        countBucket(STATUS_GROUPS.done),
        Promise.all(STATUS_GROUPS.attention.map((s) => fetchWorkOrders({ status: s }, 0, 10)))
          .then((rs) => rs.flatMap((r) => r.data)),
      ])
      if (cancelled) return
      setCounts({
        open: openCount,
        inProgress: inProgCount,
        pendingCert: pendCertCount,
        done: doneCount,
      })
      setAlerts(attnData.slice(0, 5))
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const stats = [
    { label: t('dashboard.admin.statOpen'),         value: counts.open,        color: 'bg-accent', group: 'open' },
    { label: t('dashboard.admin.statInProgress'),   value: counts.inProgress,  color: 'bg-info',   group: 'inProgress' },
    { label: t('dashboard.admin.statPendingCert'),  value: counts.pendingCert, color: 'bg-warn',   group: 'pendingCert' },
    { label: t('dashboard.admin.statDone'),         value: counts.done,        color: 'bg-ok',     group: 'done' },
  ]

  return (
    <div>
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('dashboard.admin.title')}</h2>
          <p className="nx-label mt-2">{t('dashboard.admin.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => navigate(`/admin/orders?statusGroup=${stat.group}`)}
            className="nx-kpi-card text-left transition-colors hover:bg-bg-2 cursor-pointer"
          >
            <p className="nx-kpi-label">{stat.label}</p>
            <p className="nx-kpi-value">
              {isLoading ? <span className="text-fg-3">—</span> : stat.value}
            </p>
            <div className={`h-0.5 w-8 rounded-full ${stat.color}`} />
          </button>
        ))}
      </div>

      {/* Attention feed */}
      <div className="nx-panel mt-8">
        <div className="nx-panel-head">
          <h3 className="nx-panel-title">{t('dashboard.admin.attentionTitle')}</h3>
          <span className="nx-panel-meta tabular-nums">
            {t('dashboard.admin.attentionOpen', { count: alerts.length })}
          </span>
        </div>
        <div>
          {isLoading ? (
          <div className="nx-panel-body flex items-center justify-center py-6">
              <div className="nx-loader-sm" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="nx-panel-body text-sm text-fg-2">{t('dashboard.admin.attentionEmpty')}</div>
          ) : (
            alerts.map((order) => {
              const sev = order.status === 'client_rejected' ? 'crit' : 'warn'
              const label =
                order.status === 'client_rejected'
                  ? t('dashboard.admin.attentionRejected')
                  : t('dashboard.admin.attentionReturned')
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="nx-alert-row w-full text-left hover:bg-bg-2 transition-colors"
                >
                  <span className={`nx-alert-sev ${sev}`}>
                    <AlertTriangle size={10} strokeWidth={2} className="inline -mt-px mr-1" />
                    {label}
                  </span>
                  <div className="nx-alert-body">
                    <strong className="text-fg-1">
                      <span className="font-mono">{order.order_number}</span>
                      {' · '}
                      {order.clients?.name ?? '—'}
                    </strong>
                    <div className="nx-alert-meta">
                      {order.projects?.code ?? '—'}
                      {order.assigned_team && ` · ${t('dashboard.admin.team', { team: order.assigned_team })}`}
                    </div>
                  </div>
                  <span className="nx-alert-ts">
                    {timeAgo(order.created_at)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Welcome panel */}
      <div className="nx-panel mt-6">
        <div className="nx-panel-head">
          <h3 className="nx-panel-title">{t('dashboard.admin.welcomeTitle')}</h3>
          <span className="nx-panel-meta">v1.0</span>
        </div>
        <div className="nx-panel-body">
          <p className="text-sm text-fg-2">
            {t('dashboard.admin.welcomeBody')}
          </p>
        </div>
      </div>
    </div>
  )
}
