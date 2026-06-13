/**
 * Cycle milestone conventions (plan 009 §2).
 *
 * Four fixed milestone types, each mapped to an i18n label key and a NEXUS
 * semantic color TOKEN. Colors are NEVER hardcoded as hex — they are the
 * design-system token utility classes (text-*, bg-*, border-*) defined in
 * `src/index.css @theme`. This map is the single source of truth shared by the
 * admin panel and the contractor calendar legend.
 */

export type CycleMilestoneType = 'emission' | 'review' | 'final_cert' | 'payment'

export interface CycleMilestoneConvention {
  /** i18n key under `cycle.milestone.*` */
  labelKey: string
  /** NEXUS semantic token name (without the utility prefix) */
  token: 'info' | 'warn' | 'ok' | 'accent'
  /** Text color utility class */
  textClass: string
  /** Background dot/marker utility class */
  bgClass: string
  /** Border utility class */
  borderClass: string
  /** The collaborator_cycles column this milestone reads its date from. */
  dateField: 'emission_date' | 'review_start_date' | 'final_cert_date' | 'payment_date'
  /** True when the milestone spans a range (review window = 3 business days). */
  isRange: boolean
}

export const CYCLE_MILESTONES: Record<CycleMilestoneType, CycleMilestoneConvention> = {
  emission: {
    labelKey: 'cycle.milestone.emission',
    token: 'info',
    textClass: 'text-info',
    bgClass: 'bg-info',
    borderClass: 'border-info',
    dateField: 'emission_date',
    isRange: false,
  },
  review: {
    labelKey: 'cycle.milestone.review',
    token: 'warn',
    textClass: 'text-warn',
    bgClass: 'bg-warn',
    borderClass: 'border-warn',
    dateField: 'review_start_date',
    isRange: true,
  },
  final_cert: {
    labelKey: 'cycle.milestone.final_cert',
    token: 'ok',
    textClass: 'text-ok',
    bgClass: 'bg-ok',
    borderClass: 'border-ok',
    dateField: 'final_cert_date',
    isRange: false,
  },
  payment: {
    labelKey: 'cycle.milestone.payment',
    token: 'accent',
    textClass: 'text-accent',
    bgClass: 'bg-accent',
    borderClass: 'border-accent',
    dateField: 'payment_date',
    isRange: false,
  },
}

/** Ordered list for legends and iteration (chronological intent). */
export const CYCLE_MILESTONE_ORDER: CycleMilestoneType[] = [
  'emission',
  'review',
  'final_cert',
  'payment',
]
