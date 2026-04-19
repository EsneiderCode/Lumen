import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { fetchWorkOrders, type WorkOrderWithRelations } from '@/services/workOrderService'
import type { WorkOrderStatus } from '@/types/enums'

interface StatCounts {
  open: number
  inProgress: number
  pendingCert: number
  done: number
}

// Status buckets for the dashboard KPIs
const OPEN_STATUSES: WorkOrderStatus[] = ['created', 'assigned']
const IN_PROGRESS_STATUSES: WorkOrderStatus[] = ['in_progress', 'executed', 'rueckmeldung_pending']
const PENDING_CERT_STATUSES: WorkOrderStatus[] = ['rueckmeldung_sent']
const DONE_STATUSES: WorkOrderStatus[] = ['client_accepted', 'invoiced', 'paid']

// Attention buckets for the alert feed
const ATTENTION_STATUSES: WorkOrderStatus[] = ['returned', 'client_rejected']

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<StatCounts>({ open: 0, inProgress: 0, pendingCert: 0, done: 0 })
  const [alerts, setAlerts] = useState<WorkOrderWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [open, inProg, pend, done, attn] = await Promise.all([
        ...OPEN_STATUSES.map((s) => fetchWorkOrders({ status: s })),
        fetchWorkOrders({ status: 'in_progress' }).then(async (r) => {
          const more = await Promise.all(
            IN_PROGRESS_STATUSES.slice(1).map((s) => fetchWorkOrders({ status: s })),
          )
          return { data: [...r.data, ...more.flatMap((m) => m.data)], total: 0, error: null }
        }),
        ...PENDING_CERT_STATUSES.map((s) => fetchWorkOrders({ status: s })),
        fetchWorkOrders({ status: 'client_accepted' }).then(async (r) => {
          const more = await Promise.all(
            DONE_STATUSES.slice(1).map((s) => fetchWorkOrders({ status: s })),
          )
          return { data: [...r.data, ...more.flatMap((m) => m.data)], total: 0, error: null }
        }),
        Promise.all(ATTENTION_STATUSES.map((s) => fetchWorkOrders({ status: s }))).then((rs) => ({
          data: rs.flatMap((r) => r.data),
        })),
      ])
      if (cancelled) return
      setCounts({
        open: open.data.length,
        inProgress: inProg.data.length,
        pendingCert: pend.data.length,
        done: done.data.length,
      })
      setAlerts(attn.data.slice(0, 5))
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const stats = [
    { label: 'Offene Aufträge',           value: counts.open,        color: 'bg-accent' },
    { label: 'In Bearbeitung',            value: counts.inProgress,  color: 'bg-info' },
    { label: 'Zertifizierung ausstehend', value: counts.pendingCert, color: 'bg-warn' },
    { label: 'Abgeschlossen · Monat',     value: counts.done,        color: 'bg-ok' },
  ]

  return (
    <div>
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">Dashboard</h2>
          <p className="nx-label mt-2">§ Operations · Overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="nx-kpi-card">
            <p className="nx-kpi-label">{stat.label}</p>
            <p className="nx-kpi-value">
              {isLoading ? <span className="text-fg-3">—</span> : stat.value}
            </p>
            <div className={`h-0.5 w-8 rounded-full ${stat.color}`} />
          </div>
        ))}
      </div>

      {/* Attention feed */}
      <div className="nx-panel mt-8">
        <div className="nx-panel-head">
          <h3 className="nx-panel-title">Benötigt Aufmerksamkeit</h3>
          <span className="nx-panel-meta tabular-nums">
            {alerts.length} offen
          </span>
        </div>
        <div>
          {isLoading ? (
            <div className="nx-panel-body flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="nx-panel-body text-sm text-fg-2">Keine offenen Meldungen.</div>
          ) : (
            alerts.map((order) => {
              const sev = order.status === 'client_rejected' ? 'crit' : 'warn'
              const label = order.status === 'client_rejected' ? 'Abgelehnt' : 'Zurück'
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
                      {order.assigned_team && ` · Team ${order.assigned_team}`}
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
          <h3 className="nx-panel-title">Willkommen bei LUMEN</h3>
          <span className="nx-panel-meta">v1.0</span>
        </div>
        <div className="nx-panel-body">
          <p className="text-sm text-fg-2">
            Zentrale Betriebsplattform für HMR Nexus Engineering GmbH. Aufträge, Zertifizierungen und
            Personalverwaltung an einem Ort.
          </p>
        </div>
      </div>
    </div>
  )
}
