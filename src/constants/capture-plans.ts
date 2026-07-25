// The capture plans compiled into the client.
//
// Two families live here:
//   - the DEFAULTS, one per work type, reproducing today's behaviour: the three
//     fixed photo buckets plus the DETAIL_FIELDS of that work type, so a work
//     order evaluated against its default plan is complete exactly when it is
//     complete under the current rules. Migration 052 seeds them.
//   - the hand-written VARIANTS ("Soplado de RA", migration 053), which live in
//     their own module and are only registered here.
//
// The compiled copies are the offline / demo fallback: the app reads plans from
// `public.capture_plans`, and falls back to these when the round trip fails.
// `capturePlans.test.ts` compares both migrations' seeded JSON with what this
// module produces, so the two can never silently drift.

import { legacyDetailsSection, legacyPhotoSlot } from '@/constants/capture-plan-sections'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CapturePlan, CaptureSection, LegacyPhotoType } from '@/types/capture-plan'
import { WorkType } from '@/types/enums'

export const CAPTURE_PLAN_VERSION = 1

const LEGACY_PHOTO_TYPES: LegacyPhotoType[] = ['before', 'during', 'after']

export function buildDefaultCapturePlan(workType: WorkType): CapturePlan {
  const sections: CaptureSection[] = [
    {
      key: 'photos',
      kind: 'photos',
      titleKey: 'rueckmeldung.photos.title',
      slots: LEGACY_PHOTO_TYPES.map(legacyPhotoSlot),
    },
    legacyDetailsSection(workType),
  ]

  return { key: workType, version: CAPTURE_PLAN_VERSION, sections }
}

export const DEFAULT_CAPTURE_PLANS: Record<WorkType, CapturePlan> = Object.fromEntries(
  Object.values(WorkType).map((workType) => [workType, buildDefaultCapturePlan(workType)]),
) as Record<WorkType, CapturePlan>

/** Plans that are not the default of a work type but a variant of it. */
export const VARIANT_CAPTURE_PLANS: CapturePlan[] = [SOPLADO_RA_PLAN]

/** Every plan the client carries, keyed by plan key. */
export const COMPILED_CAPTURE_PLANS: Record<string, CapturePlan> = {
  ...DEFAULT_CAPTURE_PLANS,
  ...Object.fromEntries(VARIANT_CAPTURE_PLANS.map((plan) => [plan.key, plan])),
}

/**
 * The plan a work order is captured under: its explicit `capture_plan_key`, or
 * its work type. Mirrors `public.work_order_capture_plan_key()` (migration 052).
 */
export function capturePlanKeyForOrder(order: {
  work_type: WorkType | string
  capture_plan_key?: string | null
}): string {
  const explicit = order.capture_plan_key?.trim()
  return explicit && explicit.length > 0 ? explicit : String(order.work_type)
}

/** The work type a plan belongs to — its own key for the defaults. */
export function capturePlanWorkType(plan: CapturePlan): string {
  return plan.workType ?? plan.key
}

/** Fallback used offline / in demo mode when the DB copy of the plan is unavailable. */
export function defaultCapturePlanFor(planKey: string): CapturePlan | null {
  return COMPILED_CAPTURE_PLANS[planKey] ?? null
}

/**
 * The variants an admin can pick for a work type. The default plan is not in the
 * list: it is what "no override" already means on the order.
 */
export function compiledVariantsForWorkType(workType: string): CapturePlan[] {
  return VARIANT_CAPTURE_PLANS.filter(
    (plan) => capturePlanWorkType(plan) === workType && plan.key !== workType,
  )
}
