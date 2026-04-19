import { useState } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto nexus-bg p-4 md:p-8">
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
