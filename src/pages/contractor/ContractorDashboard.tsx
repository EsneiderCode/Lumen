import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { fetchContractorWorkOrders } from '@/services/workOrderService'
import type { WorkOrderStatus } from '@/types/enums'
import { ROUTES } from '@/config/routes'

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'assigned', 'in_progress', 'executed', 'rueckmeldung_pending', 'rueckmeldung_sent',
]
const DONE_STATUSES: WorkOrderStatus[] = ['paid', 'invoiced', 'client_accepted']

export function ContractorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    if (!user) return
    fetchContractorWorkOrders(user.id).then(({ data }) => {
      setActiveCount(data.filter((o) => ACTIVE_STATUSES.includes(o.status as WorkOrderStatus)).length)
      setDoneCount(data.filter((o) => DONE_STATUSES.includes(o.status as WorkOrderStatus)).length)
    })
  }, [user])

  return (
    <div>
      {/* Greeting */}
      <div className="panel mb-5">
        <div className="pbody">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="nx-label mb-2">CONTRACTOR DASHBOARD</p>
            <h2 className="font-display text-lg font-semibold text-fg-1">
              Willkommen, {user?.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-fg-2">{today}</p>
          </div>
          <span className="badge badge-info">
            Subunternehmer
          </span>
        </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="kpi text-left transition-colors hover:border-accent/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-accent" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {activeCount === null ? '—' : activeCount}
          </p>
          <p className="nx-label mt-1">Aktive Aufträge</p>
        </button>
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="kpi text-left transition-colors hover:border-ok/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-ok" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {doneCount === null ? '—' : doneCount}
          </p>
          <p className="nx-label mt-1">Abgerechnet</p>
        </button>
      </div>

      {/* Document status */}
      <div className="panel mb-4">
        <div className="phead">
          <h3 className="title">Dokumentenstatus</h3>
          <span className="m">PAYMENT GATE</span>
        </div>
        <div className="pbody">
        <div className="space-y-2">
          {[
            'Gewerbeanmeldung',
            'Haftpflichtversicherung',
            'Unbedenklichkeitsbescheinigung',
            'Personalausweis',
          ].map((doc) => (
            <div
              key={doc}
              className="flex items-center justify-between rounded-s border border-line bg-bg-0 px-3 py-2"
            >
              <span className="text-sm text-fg-1">{doc}</span>
              <span className="badge badge-neutral">Ausstehend</span>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Quick link to orders */}
      <button
        onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
        className="nx-card-button border-accent/30 bg-accent/5 p-4 text-center"
      >
        <p className="text-sm font-semibold text-accent">Alle Aufträge anzeigen →</p>
      </button>
    </div>
  )
}
