export function AdminDashboard() {
  const stats = [
    { label: 'Offene Aufträge',           value: '—', color: 'bg-accent' },
    { label: 'In Bearbeitung',            value: '—', color: 'bg-err' },
    { label: 'Zertifizierung ausstehend', value: '—', color: 'bg-warn' },
    { label: 'Abgeschlossen · Monat',     value: '—', color: 'bg-ok' },
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
            <p className="nx-kpi-value">{stat.value}</p>
            <p className="nx-kpi-delta neut">— steady</p>
          </div>
        ))}
      </div>

      <div className="nx-panel mt-8">
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
