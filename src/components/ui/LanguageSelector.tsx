import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'de', short: 'DE' },
  { code: 'es', short: 'ES' },
] as const

interface Props {
  className?: string
}

/**
 * Compact language switcher for the app topbar.
 * Persists via i18next-browser-languagedetector (localStorage key
 * `lumen-lang`). Current language is highlighted.
 */
export function LanguageSelector({ className = '' }: Props) {
  const { i18n, t } = useTranslation()
  const current = (i18n.language ?? 'de').split('-')[0]

  return (
    <div
      role="group"
      aria-label={t('language.change', { defaultValue: 'Sprache ändern' })}
      className={`inline-flex overflow-hidden rounded-gf-btn border border-gf-border bg-gf-surface ${className}`}
    >
      {LANGUAGES.map((l) => {
        const active = current === l.code
        return (
          <button
            key={l.code}
            type="button"
            aria-pressed={active}
            onClick={() => void i18n.changeLanguage(l.code)}
            className={
              'px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] transition-colors ' +
              (active
                ? 'bg-gf-primary text-gf-base'
                : 'text-gf-text-muted hover:text-gf-text')
            }
          >
            {l.short}
          </button>
        )
      })}
    </div>
  )
}
