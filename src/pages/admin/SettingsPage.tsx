import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('nav.settings')}</h2>
          <p className="nx-label mt-2">{t('settings.subtitle', 'Configuración del sistema')}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-l border border-line bg-bg-1 py-20">
        <Settings size={32} strokeWidth={1.5} className="mb-4 text-fg-3" />
        <p className="text-sm text-fg-2">{t('settings.comingSoon', 'Módulo en construcción')}</p>
      </div>
    </div>
  )
}
