import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export function ContractorLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()

  const navItems: BottomNavItem[] = [
    { label: t('nav.dashboard'), path: ROUTES.CONTRACTOR.DASHBOARD, icon: '🏠' },
    { label: t('nav.workOrders'), path: ROUTES.CONTRACTOR.ORDERS, icon: '📋' },
    { label: t('nav.documents', { defaultValue: 'Dokumente' }), path: ROUTES.CONTRACTOR.DOCUMENTS, icon: '📄' },
  ]

  return (
    <div className="flex min-h-screen flex-col nexus-bg">
      <OfflineBanner />
      <header className="flex h-14 items-center gap-3 border-b border-gf-border bg-gf-card px-4">
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
