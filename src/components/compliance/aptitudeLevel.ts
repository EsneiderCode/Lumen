import type { ProfileComplianceResult } from '@/services/complianceService'

export type ComplianceLevel = 'green' | 'yellow' | 'red'

export const DOT_CLASS: Record<ComplianceLevel, string> = {
  green: 'bg-ok',
  yellow: 'bg-warn',
  red: 'bg-err',
}

/** Traffic-light level for a (contractor, obra) compliance result. */
export function complianceLevel(result: ProfileComplianceResult): ComplianceLevel {
  if (!result.hasEntity || result.isBlocked || result.aptitude?.level === 'red') return 'red'
  return result.aptitude?.level === 'yellow' ? 'yellow' : 'green'
}
