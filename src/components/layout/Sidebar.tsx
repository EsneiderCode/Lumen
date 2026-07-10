import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  LayoutGrid,
  ClipboardList,
  CheckCircle2,
  FileText,
  FolderKanban,
  Users,
  UserRound,
  Package,
  CalendarDays,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { ROUTE_PERMISSIONS } from '@/config/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { LernmodusToggle } from '@/components/LernmodusToggle'
import { G } from '@/i18n/glossarize'

interface NavItem {
  labelKey: string
  path: string
  icon: LucideIcon
}

interface NavSection {
  labelKey: string
  items: NavItem[]
}

// Item visibility is driven by ROUTE_PERMISSIONS: an item only renders when the
// user holds the permission its route requires.
const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'nav.operations',
    items: [
      { labelKey: 'nav.dashboard',     path: ROUTES.ADMIN.DASHBOARD,     icon: LayoutGrid },
      { labelKey: 'nav.orders',        path: ROUTES.ADMIN.ORDERS,        icon: ClipboardList },
      { labelKey: 'nav.certification', path: ROUTES.ADMIN.CERTIFICATION, icon: CheckCircle2 },
    ],
  },
  {
    labelKey: 'nav.catalog',
    items: [
      { labelKey: 'nav.serviceCatalog', path: ROUTES.ADMIN.SERVICE_ITEMS, icon: FileText },
      { labelKey: 'nav.projects',       path: ROUTES.ADMIN.PROJECTS,      icon: FolderKanban },
    ],
  },
  {
    labelKey: 'nav.organization',
    items: [
      { labelKey: 'nav.personnel', path: ROUTES.ADMIN.PERSONNEL, icon: Users },
      { labelKey: 'nav.employees', path: ROUTES.ADMIN.EMPLOYEES, icon: UserRound },
      { labelKey: 'nav.materials', path: ROUTES.ADMIN.MATERIALS, icon: Package },
      { labelKey: 'nav.cycles',    path: ROUTES.ADMIN.CYCLES,    icon: CalendarDays },
      { labelKey: 'nav.roles',     path: ROUTES.ADMIN.ROLES,     icon: ShieldCheck },
      { labelKey: 'nav.settings',  path: ROUTES.ADMIN.SETTINGS,  icon: Settings },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const { can } = usePermissions()

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(ROUTE_PERMISSIONS[item.path])),
  })).filter((section) => section.items.length > 0)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-bg-0/80 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`nx-sidebar fixed inset-y-0 left-0 z-50 flex h-screen flex-col transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="nx-sb-brand">
          <div className="nx-brand-mark h-8 w-8">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="6"  y="6" width="6" height="28" fill="var(--color-fg-1)"/>
              <rect x="28" y="6" width="6" height="28" fill="var(--color-fg-1)"/>
              <path d="M12 8 L28 32 L28 26 L12 2 Z" fill="var(--color-accent)"/>
            </svg>
          </div>
          <div>
            <div className="nx-brand-name text-[14px]">
              LUMEN<span className="text-accent">.OS</span>
            </div>
            <div className="nx-brand-meta">NEXUS FIELD OPS</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-auto px-2 py-2">
          {visibleSections.map((section) => (
            <div key={section.labelKey}>
              <div className="nx-sb-section"><G>{t(section.labelKey)}</G></div>
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === ROUTES.ADMIN.DASHBOARD}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `nx-sb-link ${isActive ? 'nx-sb-link-active' : ''}`
                    }
                  >
                    <Icon size={14} strokeWidth={1.5} className="opacity-70" />
                    <G>{t(item.labelKey)}</G>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="px-2 pb-2">
          <LernmodusToggle />
        </div>

        <div className="nx-sb-foot">
          <span className="nx-label">Tenant</span>
          <span className="text-[12px] text-fg-2">HMR Nexus GmbH</span>
        </div>
      </aside>
    </>
  )
}
