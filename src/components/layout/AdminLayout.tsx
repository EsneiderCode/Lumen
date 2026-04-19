import { useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function AdminLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isInstallable, promptInstall } = useInstallPrompt()

  return (
    <div className="flex h-screen flex-col">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b border-line bg-bg-1 px-4 md:px-6">
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-btn border border-line text-fg-2 transition-colors hover:border-accent hover:text-accent md:hidden"
                aria-label={t('nav.menuOpen', { defaultValue: 'Menü öffnen' })}
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
              <h1 className="font-display text-base font-semibold text-fg-1 md:text-lg">
                {t('nav.admin')}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {isInstallable && (
                <button
                  onClick={promptInstall}
                  className="hidden rounded-btn border border-accent px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent hover:text-paper sm:flex"
                >
                  {t('nav.installApp', { defaultValue: 'App installieren' })}
                </button>
              )}
              <LanguageSelector />
              <span className="hidden text-sm text-fg-2 sm:block">{user?.fullName}</span>
              <button
                onClick={signOut}
                className="rounded-btn border border-line px-3 py-1.5 text-sm text-fg-2 transition-colors hover:border-err/30 hover:text-err"
              >
                {t('auth.signOut')}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto nexus-bg p-4 md:p-6">
            <div className="page-fade-in">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
