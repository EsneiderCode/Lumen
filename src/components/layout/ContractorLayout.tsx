import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Home, ClipboardList, FileText } from 'lucide-react'
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
    { label: t('nav.dashboard'), path: ROUTES.CONTRACTOR.DASHBOARD, icon: Home },
    { label: t('nav.workOrders'), path: ROUTES.CONTRACTOR.ORDERS, icon: ClipboardList },
    { label: t('nav.documents'), path: ROUTES.CONTRACTOR.DOCUMENTS, icon: FileText },
  ]

  return (
    <div className="nx-app-shell flex min-h-screen flex-col">
      <OfflineBanner />
      <header className="nx-field-header">
        <div>
          <span className="nx-brand-name text-sm">LUMEN<span className="text-accent">.OS</span></span>
          <div className="nx-brand-meta leading-none">CONTRACTOR MODE</div>
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
          <ErrorBoundary>
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
