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
    { label: t('nav.documents', { defaultValue: 'Dokumente' }), path: ROUTES.CONTRACTOR.DOCUMENTS, icon: FileText },
  ]

  return (
    <div className="flex min-h-screen flex-col nexus-bg">
      <OfflineBanner />
      <header className="flex h-14 items-center gap-3 border-b border-line bg-bg-1 px-4">
        <span className="font-display text-sm font-semibold text-fg-1">LUMEN</span>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector />
          <span className="hidden text-xs text-fg-2 sm:inline">{user?.fullName}</span>
          <button
            onClick={signOut}
            className="rounded-s px-2 py-1 text-xs text-fg-2 transition-colors hover:text-err"
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
