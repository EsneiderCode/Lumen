import { useAuth } from '@/hooks/useAuth'

const TEAM_COLORS: Record<string, { dot: string; badge: string }> = {
  rot: { dot: 'bg-team-rot', badge: 'bg-team-rot/15 text-red-700' },
  gruen: { dot: 'bg-team-gruen', badge: 'bg-team-gruen/15 text-emerald-700' },
  blau: { dot: 'bg-team-blau', badge: 'bg-team-blau/15 text-blue-700' },
  gelb: { dot: 'bg-team-gelb', badge: 'bg-team-gelb/15 text-yellow-700' },
}

const TEAM_LABELS: Record<string, string> = {
  rot: 'Rot',
  gruen: 'Grün',
  blau: 'Blau',
  gelb: 'Gelb',
}

export function TechDashboard() {
  const { user } = useAuth()
  const team = user?.team ?? null
  const teamStyle = team ? TEAM_COLORS[team] : null
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
              Hallo, {user?.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-gf-text-muted">{today}</p>
          </div>
          {team && teamStyle && (
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${teamStyle.badge}`}>
              <span className={`h-2 w-2 rounded-full ${teamStyle.dot}`} />
              Team {TEAM_LABELS[team]}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Heute', value: '0', color: 'bg-gf-primary' },
          { label: 'Offen', value: '0', color: 'bg-gf-warning' },
          { label: 'Erledigt', value: '0', color: 'bg-gf-success' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gf-border bg-gf-card p-4 text-center">
            <div className={`mx-auto mb-2 h-1 w-8 rounded-full ${s.color}`} />
            <p className="font-display text-xl font-bold text-gf-text">{s.value}</p>
            <p className="text-xs text-gf-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Active orders placeholder */}
      <div className="rounded-xl border border-gf-border bg-gf-card p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-gf-text">Meine Aufträge</h3>
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
