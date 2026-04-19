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
      <div className="mb-5 rounded-card border border-line bg-bg-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg-1">
              Willkommen, {user?.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-fg-2">{today}</p>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Subunternehmer
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="rounded-card border border-line bg-bg-1 p-4 text-left transition-colors hover:border-accent/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-accent" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {activeCount === null ? '—' : activeCount}
          </p>
          <p className="mt-0.5 text-xs text-fg-2">Aktive Aufträge</p>
        </button>
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="rounded-card border border-line bg-bg-1 p-4 text-left transition-colors hover:border-ok/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-ok" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {doneCount === null ? '—' : doneCount}
          </p>
          <p className="mt-0.5 text-xs text-fg-2">Abgerechnet</p>
        </button>
      </div>

      {/* Document status */}
      <div className="mb-4 rounded-card border border-line bg-bg-1 p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">Dokumentenstatus</h3>
        <div className="space-y-2">
          {[
            'Gewerbeanmeldung',
            'Haftpflichtversicherung',
            'Unbedenklichkeitsbescheinigung',
            'Personalausweis',
          ].map((doc) => (
            <div
              key={doc}
              className="flex items-center justify-between rounded-btn border border-line bg-bg-0 px-3 py-2"
            >
              <span className="text-sm text-fg-1">{doc}</span>
              <span className="text-xs text-fg-2">Ausstehend</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick link to orders */}
      <button
        onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
        className="w-full rounded-card border border-accent/30 bg-accent/5 p-4 text-center transition-colors hover:bg-accent/10"
      >
        <p className="text-sm font-semibold text-accent">Alle Aufträge anzeigen →</p>
      </button>
    </div>
  )
}
