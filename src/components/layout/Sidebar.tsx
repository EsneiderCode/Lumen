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

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard',     path: ROUTES.ADMIN.DASHBOARD,     icon: LayoutGrid },
      { label: 'Aufträge',      path: ROUTES.ADMIN.ORDERS,        icon: ClipboardList },
      { label: 'Zertifizierung',path: ROUTES.ADMIN.CERTIFICATION, icon: CheckCircle2 },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Service-Katalog', path: ROUTES.ADMIN.SERVICE_ITEMS, icon: FileText },
    ],
  },
  {
    label: 'Organization',
    items: [
      { label: 'Personal',     path: ROUTES.ADMIN.PERSONNEL, icon: Users },
      { label: 'Material',     path: ROUTES.ADMIN.MATERIALS, icon: Package },
      { label: 'Einstellungen',path: ROUTES.ADMIN.SETTINGS,  icon: Settings },
    ],
  },
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
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-line bg-bg-1 transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-12 items-center gap-3 border-b border-line px-5">
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="6"  y="6" width="6" height="28" fill="var(--color-fg-1)"/>
            <rect x="28" y="6" width="6" height="28" fill="var(--color-fg-1)"/>
            <path d="M12 8 L28 32 L28 26 L12 2 Z" fill="var(--color-accent)"/>
          </svg>
          <div className="font-display text-[15px] font-medium tracking-tight text-fg-1">
            LUMEN<span className="text-accent">.OS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-auto px-3 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="nx-sb-section">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === ROUTES.ADMIN.DASHBOARD}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-s px-2 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-bg-3 text-fg-1'
                          : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'
                      }`
                    }
                  >
                    <Icon size={14} strokeWidth={1.5} className="opacity-70" />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
