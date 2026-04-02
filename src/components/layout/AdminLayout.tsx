import { useState } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gf-border bg-gf-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-gf-btn border border-gf-border text-gf-text-muted transition-colors hover:border-gf-primary hover:text-gf-primary md:hidden"
              aria-label="Menü öffnen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="font-display text-base font-semibold text-gf-text md:text-lg">
              Administration
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gf-text-muted sm:block">{user?.fullName}</span>
            <button
              onClick={signOut}
              className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-sm text-gf-text-muted transition-colors hover:border-gf-danger/30 hover:text-gf-danger"
            >
              Abmelden
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto nexus-bg p-4 md:p-6">
          <div className="page-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
