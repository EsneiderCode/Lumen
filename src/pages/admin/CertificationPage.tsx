import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchWorkOrders } from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import { ROUTES } from '@/config/routes'

interface Order {
  id: string
  order_number: string
  work_type: WorkType
  status: WorkOrderStatus
  priority: string
  assigned_team: TeamColor | null
  assigned_date: string | null
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Int. zertifiziert',
  sent_to_client: 'An Kunden gesendet',
  client_accepted: 'Akzeptiert',
  client_rejected: 'Abgelehnt',
  invoiced: 'Fakturiert',
}

const STATUS_COLORS: Record<string, string> = {
  rueckmeldung_sent: 'bg-gf-warning/10 text-amber-600',
  internally_certified: 'bg-gf-success/15 text-emerald-700',
  sent_to_client: 'bg-gf-primary/10 text-gf-primary-dark',
  client_accepted: 'bg-gf-success/20 text-emerald-700',
  client_rejected: 'bg-gf-danger/15 text-rose-700',
  invoiced: 'bg-gf-accent/10 text-purple-700',
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

const CERT_STATUSES: WorkOrderStatus[] = [
  'rueckmeldung_sent',
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
]

const SECTIONS: { status: WorkOrderStatus; label: string; description: string }[] = [
  { status: 'rueckmeldung_sent', label: 'Rückmeldung eingegangen', description: 'Warten auf interne Zertifizierung' },
  { status: 'internally_certified', label: 'Intern zertifiziert', description: 'Bereit zur Weiterleitung an den Kunden' },
  { status: 'sent_to_client', label: 'Beim Kunden', description: 'Warten auf Kundenentscheid' },
  { status: 'client_rejected', label: 'Abgelehnt', description: 'Zur Überarbeitung zurückgegeben' },
  { status: 'client_accepted', label: 'Akzeptiert', description: 'Bereit zur Fakturierung' },
  { status: 'invoiced', label: 'Fakturiert', description: 'Warten auf Zahlungseingang' },
]

export function CertificationPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all(CERT_STATUSES.map((s) => fetchWorkOrders({ status: s }))).then((results) => {
      const all = results.flatMap((r) => (r.data as unknown as Order[]) ?? [])
      setOrders(all)
      setIsLoading(false)
    })
  }, [])

  const byStatus = (status: WorkOrderStatus) => orders.filter((o) => o.status === status)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
      </div>
    )
  }

  const total = orders.length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-gf-text">Zertifizierung</h2>
        <p className="mt-1 text-sm text-gf-text-muted">
          {total === 0 ? 'Keine Aufträge im Zertifizierungsprozess' : `${total} Aufträge im Prozess`}
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-gf-border bg-gf-card px-6 py-12 text-center">
          <p className="text-gf-text-muted">Alle Aufträge sind auf dem neuesten Stand.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map(({ status, label, description }) => {
            const items = byStatus(status)
            if (items.length === 0) return null
            return (
              <div key={status}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm font-semibold text-gf-text">{label}</span>
                  <span className="text-xs text-gf-text-muted">— {description}</span>
                  <span className="ml-auto text-xs text-gf-text-muted">{items.length}</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-gf-border bg-gf-card">
                  {items.map((order, i) => (
                    <button
                      key={order.id}
                      onClick={() => navigate(ROUTES.ADMIN.ORDERS_DETAIL.replace(':id', order.id))}
                      className={`flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-gf-surface transition-colors ${
                        i < items.length - 1 ? 'border-b border-gf-border' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gf-text">{order.order_number}</span>
                          <span className="text-xs text-gf-text-muted">{WORK_TYPE_LABELS[order.work_type]}</span>
                        </div>
                        <p className="text-xs text-gf-text-muted">
                          {order.clients?.name ?? '—'} · {order.projects?.code ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {order.assigned_team && (
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
                            <span className="text-xs capitalize text-gf-text-muted">{order.assigned_team}</span>
                          </div>
                        )}
                        {order.assigned_date && (
                          <span className="text-xs text-gf-text-muted">
                            {new Date(order.assigned_date).toLocaleDateString('de-DE')}
                          </span>
                        )}
                        <span className="text-xs text-gf-text-muted">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
