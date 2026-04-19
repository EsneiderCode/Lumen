import { NavLink } from 'react-router'
import {
  LayoutGrid,
  ClipboardList,
  CheckCircle2,
  FileText,
  Users,
  Package,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { ROUTES } from '@/config/routes'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.ADMIN.DASHBOARD, icon: LayoutGrid },
  { label: 'Aufträge', path: ROUTES.ADMIN.ORDERS, icon: ClipboardList },
  { label: 'Zertifizierung', path: ROUTES.ADMIN.CERTIFICATION, icon: CheckCircle2 },
  { label: 'Service-Katalog', path: ROUTES.ADMIN.SERVICE_ITEMS, icon: FileText },
  { label: 'Personal', path: ROUTES.ADMIN.PERSONNEL, icon: Users },
  { label: 'Material', path: ROUTES.ADMIN.MATERIALS, icon: Package },
  { label: 'Einstellungen', path: ROUTES.ADMIN.SETTINGS, icon: Settings },
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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
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
                <Icon size={18} strokeWidth={1.5} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-line-s px-6 py-4">
          <p className="text-xs text-fg-2/50">Nexus Engineering GmbH</p>
        </div>
      </aside>
    </>
  )
}
