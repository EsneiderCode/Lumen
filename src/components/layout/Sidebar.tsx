import { NavLink } from 'react-router'
import { ROUTES } from '@/config/routes'

const NAV_ITEMS = [
  { label: 'Dashboard', path: ROUTES.ADMIN.DASHBOARD, icon: '📊' },
  { label: 'Aufträge', path: ROUTES.ADMIN.ORDERS, icon: '📋' },
  { label: 'Zertifizierung', path: ROUTES.ADMIN.CERTIFICATION, icon: '✅' },
  { label: 'Service-Katalog', path: ROUTES.ADMIN.SERVICE_ITEMS, icon: '📑' },
  { label: 'Personal', path: ROUTES.ADMIN.PERSONNEL, icon: '👥' },
  { label: 'Material', path: ROUTES.ADMIN.MATERIALS, icon: '📦' },
  { label: 'Einstellungen', path: ROUTES.ADMIN.SETTINGS, icon: '⚙️' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-paper transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-line-s px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-btn border border-accent/20 bg-bg-1">
            <span className="font-display text-sm font-bold text-accent">L</span>
          </div>
          <span className="font-display text-lg font-bold text-ink">LUMEN</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ROUTES.ADMIN.DASHBOARD}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-2 border-accent bg-accent/10 text-accent'
                    : 'border-l-2 border-transparent text-fg-2 hover:bg-line-s hover:text-ink'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-line-s px-6 py-4">
          <p className="text-xs text-fg-2/50">Nexus Engineering GmbH</p>
        </div>
      </aside>
    </>
  )
}
