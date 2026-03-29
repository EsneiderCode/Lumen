import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'

export function AdminLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gf-border bg-gf-card px-6">
          <h1 className="font-display text-lg font-semibold text-gf-text">Administration</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gf-text-muted">{user?.fullName}</span>
            <button
              onClick={signOut}
              className="rounded-lg border border-gf-border px-3 py-1.5 text-sm text-gf-text-muted transition-colors hover:border-gf-danger/30 hover:text-gf-danger"
            >
              Abmelden
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gf-surface p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
