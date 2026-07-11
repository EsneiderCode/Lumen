import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { AdminPanelLink } from './AdminPanelLink'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export function SchedulerLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

  const navItems: BottomNavItem[] = [
    { label: t('nav.appointments'), path: ROUTES.SCHEDULER.APPOINTMENTS, icon: CalendarClock },
  ]

  return (
    <div className="nx-app-shell flex min-h-screen flex-col">
      <OfflineBanner />
      <header className="nx-field-header">
        <div>
          <span className="nx-brand-name text-sm">LUMEN<span className="text-accent">.OS</span></span>
          <div className="nx-brand-meta leading-none">SCHEDULER MODE</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AdminPanelLink />
          <LanguageSelector />
          <span className="hidden text-xs text-fg-2 sm:inline">{user?.fullName}</span>
          <button onClick={signOut} className="btn btn-g btn-sm">
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
