import { Menu, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Breadcrumb } from './Breadcrumb'
import { NotificationBell } from './NotificationBell'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { useAuth } from '@/hooks/useAuth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

interface TopbarProps {
  onOpenSidebar: () => void
}

const ENV_LABEL = import.meta.env.MODE === 'production' ? 'LIVE · PROD' : 'LIVE · DEV'

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { isInstallable, promptInstall } = useInstallPrompt()

  return (
    <header className="flex h-12 items-center gap-4 border-b border-line bg-bg-1 px-4 md:px-5">
      {/* Hamburger — mobile only */}
      <button
        onClick={onOpenSidebar}
        className="nx-tb-btn md:hidden"
        aria-label={t('nav.menuOpen')}
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      <Breadcrumb />

      {/* Search (desktop) */}
      <div className="nx-tb-search ml-auto hidden md:inline-flex">
        <Search size={14} strokeWidth={1.5} />
        <input
          type="text"
          placeholder={t('nav.search')}
          aria-label={t('nav.search')}
        />
        <span className="nx-kbd">⌘K</span>
      </div>

      {/* Env badge */}
      <span className="nx-env-badge hidden sm:inline-flex">{ENV_LABEL}</span>

      {/* Install CTA (if available) */}
      {isInstallable && (
        <button onClick={promptInstall} className="nx-tb-btn hidden lg:inline-flex">
          {t('nav.installApp')}
        </button>
      )}

      <NotificationBell />

      <LanguageSelector />

      {/* User + signout */}
      <span className="nx-label hidden max-w-44 truncate md:inline-block">{user?.fullName}</span>
      <button onClick={signOut} className="nx-tb-btn" aria-label={t('auth.signOut')}>
        {t('auth.signOut')}
      </button>
    </header>
  )
}
