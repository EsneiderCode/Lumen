import { NavLink } from 'react-router'
import { ROUTES } from '@/config/routes'

const NAV_ITEMS = [
  { label: 'Dashboard', path: ROUTES.ADMIN.DASHBOARD, icon: '📊' },
  { label: 'Aufträge', path: ROUTES.ADMIN.ORDERS, icon: '📋' },
  { label: 'Zertifizierung', path: ROUTES.ADMIN.CERTIFICATION, icon: '✅' },
  { label: 'Personal', path: ROUTES.ADMIN.PERSONNEL, icon: '👥' },
  { label: 'Material', path: ROUTES.ADMIN.MATERIALS, icon: '📦' },
  { label: 'Einstellungen', path: ROUTES.ADMIN.SETTINGS, icon: '⚙️' },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-gf-base">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-gf-border-dark px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gf-primary/20 bg-gf-base-light">
          <span className="font-display text-sm font-bold text-gf-primary">L</span>
        </div>
        <span className="font-display text-lg font-bold text-gf-text-inverse">LUMEN</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.ADMIN.DASHBOARD}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-l-2 border-gf-primary bg-gf-primary/10 text-gf-primary'
                  : 'border-l-2 border-transparent text-gf-text-muted hover:bg-gf-border-dark hover:text-gf-text-inverse'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gf-border-dark px-6 py-4">
        <p className="text-xs text-gf-text-muted/50">Nexus Engineering GmbH</p>
      </div>
    </aside>
  )
}
