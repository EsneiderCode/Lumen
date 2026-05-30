import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Calendar } from 'lucide-react'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

const TEAM_COLORS: Record<string, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

export function TechnicianLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const teamColorClass = user?.team ? TEAM_COLORS[user.team] ?? 'bg-fg-2' : 'bg-fg-2'

  const navItems: BottomNavItem[] = [
    { label: t('nav.workOrders'), path: ROUTES.TECHNICIAN.ORDERS, icon: ClipboardList },
    { label: t('nav.schedule'), path: ROUTES.TECHNICIAN.SCHEDULE, icon: Calendar },
  ]

  return (
    <div className="nx-app-shell flex min-h-screen flex-col">
      <OfflineBanner />
      <header className="nx-field-header">
        <div className={`h-3 w-3 rounded-full ${teamColorClass}`} />
        <div>
          <span className="nx-brand-name text-sm">LUMEN<span className="text-accent">.OS</span></span>
          <div className="nx-brand-meta leading-none">FIELD MODE</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector />
          <span className="hidden text-xs text-fg-2 sm:inline">{user?.fullName}</span>
          <button
            onClick={signOut}
            className="btn btn-g btn-sm"
          >
            {t('auth.signOut')}
          </button>
        </div>
      </header>

      <main className="nx-main flex-1 p-4 pb-20">
        <div className="nx-main-inner page-fade-in">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="nx-loader" /></div>}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <BottomNav items={navItems} />
    </div>
  )
}
