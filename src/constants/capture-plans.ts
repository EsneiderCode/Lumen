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
import { INSYTE_BOHRUNG_PLAN } from '@/constants/capture-plans-insyte-bohrung'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CapturePlan, CaptureSection, LegacyPhotoType } from '@/types/capture-plan'
import { WorkType } from '@/types/enums'

/**
 * Per work type, because a plan is versioned on its own: changing soplado must
 * not reissue the other six. A bump here needs a migration seeding that exact
 * version — `capturePlans.test.ts` fails until it exists.
 *
 * soplado@2 (migration 059): technical data first, no `section`, result leading.
 */
export const CAPTURE_PLAN_VERSIONS: Record<WorkType, number> = {
  [WorkType.SOPLADO]: 2,
  [WorkType.FUSION_AP]: 1,
  [WorkType.FUSION_DP]: 1,
  [WorkType.ALTA]: 1,
  [WorkType.NT_INSTALLATION]: 1,
  [WorkType.PATCHKABEL]: 1,
  [WorkType.POP]: 1,
}

/**
 * Work types whose plan opens on the technical data instead of the photos.
 * Asked for on soplado, where the result and the metres are what the office is
 * waiting for; the rest keep photos first until someone asks otherwise.
 */
const DETAILS_FIRST = new Set<WorkType>([WorkType.SOPLADO])

const LEGACY_PHOTO_TYPES: LegacyPhotoType[] = ['before', 'during', 'after']

export function buildDefaultCapturePlan(workType: WorkType): CapturePlan {
  const photos: CaptureSection = {
    key: 'photos',
    kind: 'photos',
    titleKey: 'rueckmeldung.photos.title',
    slots: LEGACY_PHOTO_TYPES.map(legacyPhotoSlot),
  }
  const details = legacyDetailsSection(workType)
  const sections: CaptureSection[] = DETAILS_FIRST.has(workType)
    ? [details, photos]
    : [photos, details]

  return { key: workType, version: CAPTURE_PLAN_VERSIONS[workType], sections }
}

export const DEFAULT_CAPTURE_PLANS: Record<WorkType, CapturePlan> = Object.fromEntries(
  Object.values(WorkType).map((workType) => [workType, buildDefaultCapturePlan(workType)]),
) as Record<WorkType, CapturePlan>

/** Plans that are not the default of a work type but a variant of it. */
export const VARIANT_CAPTURE_PLANS: CapturePlan[] = [SOPLADO_RA_PLAN, INSYTE_BOHRUNG_PLAN]

/** Every plan the client carries, keyed by plan key. */
export const COMPILED_CAPTURE_PLANS: Record<string, CapturePlan> = {
  ...DEFAULT_CAPTURE_PLANS,
  ...Object.fromEntries(VARIANT_CAPTURE_PLANS.map((plan) => [plan.key, plan])),
}

/**
 * The plan a work order is captured under: its explicit `capture_plan_key`,
 * failing that the one bound to its catalogue position, failing that its work
 * type. Mirrors `public.work_order_capture_plan_key()` (migrations 052 + 079).
 */
export function capturePlanKeyForOrder(order: {
  work_type: WorkType | string
  capture_plan_key?: string | null
  /** The order's `service_items` embed, when the caller loaded it (079). */
  service_items?: { capture_plan_key?: string | null } | null
}): string {
  const explicit = order.capture_plan_key?.trim()
  if (explicit && explicit.length > 0) return explicit
  const fromItem = order.service_items?.capture_plan_key?.trim()
  if (fromItem && fromItem.length > 0) return fromItem
  return String(order.work_type)
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
