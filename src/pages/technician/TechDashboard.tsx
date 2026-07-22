import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchMyWorkOrders, type WorkOrderWithRelations } from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'

const ACTIVE_STATUSES: WorkOrderStatus[] = ['assigned', 'in_progress', 'executed', 'rueckmeldung_pending']
const DONE_STATUSES: WorkOrderStatus[] = ['rueckmeldung_sent', 'internally_certified', 'sent_to_client', 'client_accepted', 'invoiced', 'paid']

// Class names must stay literal so Tailwind picks them up at build time.
const TEAM_COLORS: Record<string, { dot: string; badge: string }> = {
  rot: { dot: 'bg-team-rot', badge: 'bg-team-rot/15 text-team-rot' },
  gruen: { dot: 'bg-team-gruen', badge: 'bg-team-gruen/15 text-team-gruen' },
  blau: { dot: 'bg-team-blau', badge: 'bg-team-blau/15 text-team-blau' },
  gelb: { dot: 'bg-team-gelb', badge: 'bg-team-gelb/15 text-team-gelb' },
  weiss: { dot: 'bg-team-weiss', badge: 'bg-team-weiss/15 text-team-weiss' },
  grau: { dot: 'bg-team-grau', badge: 'bg-team-grau/15 text-team-grau' },
  braun: { dot: 'bg-team-braun', badge: 'bg-team-braun/15 text-team-braun' },
  violett: { dot: 'bg-team-violett', badge: 'bg-team-violett/15 text-team-violett' },
  tuerkis: { dot: 'bg-team-tuerkis', badge: 'bg-team-tuerkis/15 text-team-tuerkis' },
  schwarz: { dot: 'bg-team-schwarz', badge: 'bg-team-schwarz/15 text-team-schwarz' },
  orange: { dot: 'bg-team-orange', badge: 'bg-team-orange/15 text-team-orange' },
  rosa: { dot: 'bg-team-rosa', badge: 'bg-team-rosa/15 text-team-rosa' },
}

export function TechDashboard() {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { user } = useAuth()
  const team = user?.team ?? null
  const teamStyle = team ? TEAM_COLORS[team] : null
  const today = new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const todayIso = new Date().toISOString().slice(0, 10)

  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data } = await fetchMyWorkOrders(user!.id, user!.team)
      if (!cancelled) {
        setOrders(data)
        setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, user?.team])

  const todayCount = orders.filter(
    (o) => o.assigned_date?.slice(0, 10) === todayIso,
  ).length
  const openCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status as WorkOrderStatus)).length
  const doneCount = orders.filter((o) => DONE_STATUSES.includes(o.status as WorkOrderStatus)).length

  const activeOrders = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status as WorkOrderStatus))
    .slice(0, 5)

  return (
    <div>
      {/* Greeting */}
      <div className="panel mb-5">
        <div className="pbody">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="nx-label mb-2">FIELD DASHBOARD</p>
            <h2 className="font-display text-lg font-semibold text-fg-1">
              {t('dashboard.tech.greeting', { name: user?.fullName ?? '' })}
            </h2>
            <p className="mt-0.5 text-sm text-fg-2">{today}</p>
          </div>
          {team && teamStyle && (
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${teamStyle.badge}`}>
              <span className={`h-2 w-2 rounded-full ${teamStyle.dot}`} />
              {t('dashboard.tech.team', { name: L.team(team as TeamColor) })}
            </span>
          )}
        </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="kpi compact text-center">
                <div className="nx-loader-sm mx-auto" />
                <div className="nx-label mt-3">[LOADING]</div>
              </div>
            ))
          : [
              { label: t('dashboard.tech.statToday'),  value: todayCount, color: 'bg-accent' },
              { label: t('dashboard.tech.statOpen'),   value: openCount,  color: 'bg-warn' },
              { label: t('dashboard.tech.statDone'),   value: doneCount,  color: 'bg-ok' },
            ].map((s) => (
              <div key={s.label} className="kpi compact text-center">
                <div className={`mx-auto mb-2 h-1 w-8 rounded-full ${s.color}`} />
                <p className="font-display text-xl font-semibold tabular-nums text-fg-1">{s.value}</p>
                <p className="nx-label mt-1">{s.label}</p>
              </div>
            ))}
      </div>

      {/* Active orders */}
      <div className="nx-panel">
        <div className="nx-panel-head">
          <h3 className="nx-panel-title">{t('dashboard.tech.myOrders')}</h3>
          {orders.length > 0 && (
            <button
              onClick={() => navigate('/tech/orders')}
              className="nx-label hover:text-accent transition-colors"
            >
              {t('dashboard.tech.viewAll')}
            </button>
          )}
        </div>
        <div className="nx-panel-body">

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="nx-loader-sm" />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-0">
              <ClipboardList size={18} strokeWidth={1.5} className="text-fg-2" />
            </div>
            <p className="text-sm font-medium text-fg-1">{t('dashboard.tech.emptyTitle')}</p>
            <p className="text-xs text-fg-2">
              {t('dashboard.tech.emptyBody')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/tech/orders/${order.id}`)}
                className="nx-card-button px-3 py-2.5 text-left"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-accent">{order.order_number}</span>
                  <span className={`badge badge-dot ${STATUS_COLORS[order.status as WorkOrderStatus]}`}>
                    {L.status(order.status as WorkOrderStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-fg-1">{L.workType(order.work_type as WorkType)}</span>
                  {order.assigned_team && (
                    <span className={`h-1.5 w-1.5 rounded-full ${TEAM_DOT[order.assigned_team as TeamColor]}`} />
                  )}
                  {(order.address || order.city) && (
                    <span className="truncate text-xs text-fg-2">
                      {[order.address, order.city].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
