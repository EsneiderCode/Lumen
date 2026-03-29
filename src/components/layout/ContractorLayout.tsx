import { Outlet } from 'react-router'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS: BottomNavItem[] = [
  { label: 'Aufträge', path: ROUTES.CONTRACTOR.DASHBOARD, icon: '📋' },
  { label: 'Dokumente', path: ROUTES.CONTRACTOR.DOCUMENTS, icon: '📄' },
  { label: 'Zertifikate', path: ROUTES.CONTRACTOR.CERTIFICATIONS, icon: '✅' },
]

export function ContractorLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-gf-surface">
      <header className="flex h-14 items-center gap-3 border-b border-gf-border bg-gf-card px-4">
        <span className="font-display text-sm font-semibold text-gf-text">LUMEN</span>
        <span className="ml-auto text-xs text-gf-text-muted">{user?.fullName}</span>
        <button
          onClick={signOut}
          className="ml-2 rounded-lg px-2 py-1 text-xs text-gf-text-muted transition-colors hover:text-gf-danger"
        >
          Abmelden
        </button>
      </header>

      <main className="flex-1 p-4 pb-20">
        <Outlet />
      </main>

      <BottomNav items={NAV_ITEMS} />
    </div>
  )
}
