import { Outlet } from 'react-router'
import { BottomNav, type BottomNavItem } from './BottomNav'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'

const TEAM_COLORS: Record<string, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

const NAV_ITEMS: BottomNavItem[] = [
  { label: 'Aufträge', path: ROUTES.TECHNICIAN.ORDERS, icon: '📋' },
  { label: 'Kalender', path: ROUTES.TECHNICIAN.SCHEDULE, icon: '📅' },
]

export function TechnicianLayout() {
  const { user, signOut } = useAuth()
  const teamColorClass = user?.team ? TEAM_COLORS[user.team] ?? 'bg-gf-text-muted' : 'bg-gf-text-muted'

  return (
    <div className="flex min-h-screen flex-col bg-gf-surface">
      <header className="flex h-14 items-center gap-3 border-b border-gf-border bg-gf-card px-4">
        <div className={`h-3 w-3 rounded-full ${teamColorClass}`} />
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
