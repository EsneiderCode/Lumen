// Grouping the photos of an order the way the office reads them: BY PLACE.
//
// They used to be grouped by the legacy before/during/after buckets, and that
// was wrong twice over. A photo of the DP with the fibre already blown into it
// showed up under "Antes" — it is a finished state, there is nothing "before"
// about it — and the trench photos were scattered across all three buckets,
// mixed in with the DP and POP ones, while ALSO appearing under their own pin
// on the map. Every trench photo was therefore on the screen twice.
//
// So: everything about the DP together, everything about the POP together, and
// one box per trench. Within a place the phases are not worth separating — for
// the mandatory four they are all "after" anyway — but trenches are never mixed
// with each other, because a trench is the unit of work being evidenced.
//
// The grouping is driven by the plan, not hardcoded: a plan that adds a place
// gets a box for free. Pure, so it is tested without rendering anything.

import { repeaterItems } from '@/services/capturePlanEngine'
import type { CaptureAnswers, CapturePlan } from '@/types/capture-plan'

export type LegacyPhotoType = 'before' | 'during' | 'after'

export interface GroupablePhoto {
  id: string
  photo_type: LegacyPhotoType
  section_key?: string | null
  item_id?: string | null
}

export interface CapturePhotoGroup<T> {
  /** Stable across renders: `<sectionKey>` or `<sectionKey>:<itemId>`. */
  id: string
  /** i18n key of the heading. */
  labelKey: string
  /** 1-based position, for the repeater items that show one. */
  index: number | null
  photos: T[]
}

/**
 * Photos with no section — uploaded before migration 052, or under a plan
 * version whose sections have since been renamed — keep their legacy bucket as
 * the heading. It is the only thing known about them, and dropping them from
 * the gallery would hide evidence.
 */
const LEGACY_ORDER: LegacyPhotoType[] = ['before', 'during', 'after']
const LEGACY_LABEL: Record<LegacyPhotoType, string> = {
  before: 'photo.before',
  during: 'photo.during',
  after: 'photo.after',
}

export function buildCapturePhotoGroups<T extends GroupablePhoto>(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
  photos: T[],
): Array<CapturePhotoGroup<T>> {
  const groups: Array<CapturePhotoGroup<T>> = []
  const claimed = new Set<string>()

  const take = (predicate: (photo: T) => boolean): T[] => {
    const taken = photos.filter((photo) => !claimed.has(photo.id) && predicate(photo))
    for (const photo of taken) claimed.add(photo.id)
    return taken
  }

  for (const section of plan?.sections ?? []) {
    if (section.kind === 'repeater') {
      // In plan order, which is capture order: trench 1 is the first one dug.
      repeaterItems(answers, section.key).forEach((item, index) => {
        const itemPhotos = take(
          (photo) => photo.section_key === section.key && (photo.item_id ?? null) === item.id,
        )
        if (itemPhotos.length === 0) return
        groups.push({
          id: `${section.key}:${item.id}`,
          labelKey: section.itemLabelKey,
          index: index + 1,
          photos: itemPhotos,
        })
      })
      continue
    }

    const sectionPhotos = take((photo) => photo.section_key === section.key)
    if (sectionPhotos.length === 0) continue
    groups.push({ id: section.key, labelKey: section.titleKey, index: null, photos: sectionPhotos })
  }

  // Whatever the plan did not account for, by its legacy bucket.
  for (const type of LEGACY_ORDER) {
    const rest = take((photo) => photo.photo_type === type)
    if (rest.length === 0) continue
    groups.push({ id: `legacy:${type}`, labelKey: LEGACY_LABEL[type], index: null, photos: rest })
  }

  return groups
}
