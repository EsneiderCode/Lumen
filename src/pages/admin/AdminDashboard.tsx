export function AdminDashboard() {
  const stats = [
    { label: 'Offene Aufträge', value: '—', color: 'bg-accent' },
    { label: 'In Bearbeitung', value: '—', color: 'bg-err' },
    { label: 'Zertifizierung ausstehend', value: '—', color: 'bg-warn' },
    { label: 'Abgeschlossen (Monat)', value: '—', color: 'bg-ok' },
  ]

  return (
    <div>
      <h2 className="mb-6 font-display text-xl font-bold text-fg-1">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-card border border-line bg-bg-1 p-5"
          >
            <div className={`mb-3 h-1.5 w-10 rounded-full ${stat.color}`} />
            <p className="font-display text-2xl font-bold text-fg-1">{stat.value}</p>
            <p className="mt-1 text-sm text-fg-2">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-card border border-line bg-bg-1 p-6">
        <h3 className="mb-2 font-display text-base font-semibold text-fg-1">
          Willkommen bei LUMEN
        </h3>
        <p className="text-sm text-fg-2">
          Zentrale Betriebsplattform für HMR Nexus Engineering GmbH. Aufträge, Zertifizierungen und
          Personalverwaltung an einem Ort.
        </p>
      </div>
    </div>
  )
}
