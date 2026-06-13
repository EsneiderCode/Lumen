import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { manualHrefForRole } from '@/config/manuals'

export function ManualCard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  if (!user?.role) return null

  const href = manualHrefForRole(user.role, i18n.language)

  return (
    <div className="rounded-l border border-line bg-bg-1 p-5">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-fg-3">
        {t('manual.title')}
      </p>
      <p className="mb-4 text-sm text-fg-2">{t('manual.description')}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="inline-flex items-center rounded-s border border-line bg-bg-2 px-4 py-2 text-sm font-medium text-fg-1 transition-colors hover:border-accent hover:text-accent"
      >
        {t('manual.open')}
      </a>
    </div>
  )
}
