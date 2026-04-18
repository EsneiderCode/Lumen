import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
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
  const teamColorClass = user?.team ? TEAM_COLORS[user.team] ?? 'bg-gf-text-muted' : 'bg-gf-text-muted'

  const navItems: BottomNavItem[] = [
    { label: t('nav.workOrders'), path: ROUTES.TECHNICIAN.ORDERS, icon: '📋' },
    { label: t('nav.schedule', { defaultValue: 'Kalender' }), path: ROUTES.TECHNICIAN.SCHEDULE, icon: '📅' },
  ]

  return (
    <div className="flex min-h-screen flex-col nexus-bg">
      <OfflineBanner />
      <header className="flex h-14 items-center gap-3 border-b border-gf-border bg-gf-card px-4">
        <div className={`h-3 w-3 rounded-full ${teamColorClass}`} />
        <span className="font-display text-sm font-semibold text-gf-text">LUMEN</span>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector />
          <span className="hidden text-xs text-gf-text-muted sm:inline">{user?.fullName}</span>
          <button
            onClick={signOut}
            className="rounded-gf-btn px-2 py-1 text-xs text-gf-text-muted transition-colors hover:text-gf-danger"
          >
            {t('auth.signOut')}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-20">
        <div className="page-fade-in">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <BottomNav items={navItems} />
    </div>
  )
}
