import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function OfflineFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center nexus-bg px-4 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-l border border-line bg-bg-1">
        <WifiOff size={32} strokeWidth={1.5} className="text-fg-2" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-fg-1">{t('offline.title')}</h1>
      <p className="max-w-sm text-sm text-fg-2">
        {t('offline.message')}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-s bg-accent px-6 py-2.5 text-sm font-medium text-ink hover:bg-accent transition-colors"
      >
        {t('common.retry')}
      </button>
    </div>
  )
}
