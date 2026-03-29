export function AdminDashboard() {
  const stats = [
    { label: 'Offene Aufträge', value: '—', color: 'bg-gf-primary' },
    { label: 'In Bearbeitung', value: '—', color: 'bg-gf-accent' },
    { label: 'Zertifizierung ausstehend', value: '—', color: 'bg-gf-warning' },
    { label: 'Abgeschlossen (Monat)', value: '—', color: 'bg-gf-success' },
  ]

  return (
    <div>
      <h2 className="mb-6 font-display text-xl font-bold text-gf-text">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gf-border bg-gf-card p-5"
          >
            <div className={`mb-3 h-1.5 w-10 rounded-full ${stat.color}`} />
            <p className="font-display text-2xl font-bold text-gf-text">{stat.value}</p>
            <p className="mt-1 text-sm text-gf-text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gf-border bg-gf-card p-6">
        <h3 className="mb-2 font-display text-base font-semibold text-gf-text">
          Willkommen bei LUMEN
        </h3>
        <p className="text-sm text-gf-text-muted">
          Zentrale Betriebsplattform für HMR Nexus Engineering GmbH. Aufträge, Zertifizierungen und
          Personalverwaltung an einem Ort.
        </p>
      </div>
    </div>
  )
}
