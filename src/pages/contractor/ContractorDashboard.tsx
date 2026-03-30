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
      <div className="mb-5 rounded-xl border border-gf-border bg-gf-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-gf-text">
              Willkommen, {user?.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-gf-text-muted">{today}</p>
          </div>
          <span className="rounded-full border border-gf-primary/30 bg-gf-primary/10 px-3 py-1 text-xs font-semibold text-gf-primary">
            Subunternehmer
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="rounded-xl border border-gf-border bg-gf-card p-4 text-left transition-colors hover:border-gf-primary/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-gf-primary" />
          <p className="font-display text-2xl font-bold text-gf-text">
            {activeCount === null ? '—' : activeCount}
          </p>
          <p className="mt-0.5 text-xs text-gf-text-muted">Aktive Aufträge</p>
        </button>
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="rounded-xl border border-gf-border bg-gf-card p-4 text-left transition-colors hover:border-gf-success/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-gf-success" />
          <p className="font-display text-2xl font-bold text-gf-text">
            {doneCount === null ? '—' : doneCount}
          </p>
          <p className="mt-0.5 text-xs text-gf-text-muted">Abgerechnet</p>
        </button>
      </div>

      {/* Document status */}
      <div className="mb-4 rounded-xl border border-gf-border bg-gf-card p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Dokumentenstatus</h3>
        <div className="space-y-2">
          {[
            'Gewerbeanmeldung',
            'Haftpflichtversicherung',
            'Unbedenklichkeitsbescheinigung',
            'Personalausweis',
          ].map((doc) => (
            <div
              key={doc}
              className="flex items-center justify-between rounded-lg border border-gf-border bg-gf-surface px-3 py-2"
            >
              <span className="text-sm text-gf-text">{doc}</span>
              <span className="text-xs text-gf-text-muted">Ausstehend</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick link to orders */}
      <button
        onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
        className="w-full rounded-xl border border-gf-primary/30 bg-gf-primary/5 p-4 text-center transition-colors hover:bg-gf-primary/10"
      >
        <p className="text-sm font-semibold text-gf-primary">Alle Aufträge anzeigen →</p>
      </button>
    </div>
  )
}
