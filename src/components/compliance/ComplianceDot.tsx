import { useTranslation } from 'react-i18next'
import type { ProfileComplianceResult } from '@/services/complianceService'
import { complianceLevel, DOT_CLASS } from '@/components/compliance/aptitudeLevel'

/**
 * Per-obra aptitude semáforo (Fase 3). A small dot with an accessible label and
 * hover title listing the blocking document codes when red.
 */
export function ComplianceDot({
  result,
  size = 'sm',
}: {
  result: ProfileComplianceResult
  size?: 'sm' | 'md'
}) {
  const { t } = useTranslation()
  const level = complianceLevel(result)
  const base = !result.hasEntity
    ? t('compliance.aptitude.noRecord')
    : t(`compliance.aptitude.${level}`)
  const codes = result.missingCodes
    .map((code) => t(`compliance.codes.${code}`, { defaultValue: code }))
    .join(', ')
  const title = codes ? `${base}: ${codes}` : base
  const dim = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  return (
    <span
      className={`inline-block ${dim} shrink-0 rounded-full ${DOT_CLASS[level]}`}
      title={title}
      role="img"
      aria-label={title}
    />
  )
}
