import { useTranslation } from 'react-i18next'
import { CYCLE_MILESTONES, CYCLE_MILESTONE_ORDER } from '@/config/cycleMilestones'

/** Convention legend shared by the admin panel and contractor calendar. */
export function CycleLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="nx-label">{t('cycle.legend.title')}</span>
      {CYCLE_MILESTONE_ORDER.map((type) => {
        const conv = CYCLE_MILESTONES[type]
        return (
          <span key={type} className="flex items-center gap-2 text-sm text-fg-2">
            <span
              className={`inline-block h-3 w-3 rounded-s ${conv.bgClass}`}
              aria-hidden="true"
            />
            {t(conv.labelKey)}
            {conv.isRange && (
              <span className="nx-label">{t('cycle.legend.rangeHint')}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
