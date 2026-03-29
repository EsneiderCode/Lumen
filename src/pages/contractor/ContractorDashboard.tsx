import { useAuth } from '@/hooks/useAuth'

export function ContractorDashboard() {
  const { user } = useAuth()
  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
        {[
          { label: 'Zugewiesene Aufträge', value: '0', color: 'bg-gf-primary' },
          { label: 'Abgeschlossen', value: '0', color: 'bg-gf-success' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gf-border bg-gf-card p-4">
            <div className={`mb-2 h-1 w-8 rounded-full ${s.color}`} />
            <p className="font-display text-2xl font-bold text-gf-text">{s.value}</p>
            <p className="mt-0.5 text-xs text-gf-text-muted">{s.label}</p>
          </div>
        ))}
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

      {/* Orders placeholder */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Zugewiesene Aufträge</h3>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gf-surface">
            <span className="text-xl">📋</span>
          </div>
          <p className="text-sm font-medium text-gf-text">Keine aktiven Aufträge</p>
          <p className="text-xs text-gf-text-muted">
            Zugewiesene Aufträge erscheinen hier ab Sprint 4.
          </p>
        </div>
      </div>
    </div>
  )
}
