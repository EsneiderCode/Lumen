/**
 * The last thing the technician saw, kept so they can see it again with no
 * network at all.
 *
 * The Rückmeldung screen needs half a dozen round trips to open (order, photos,
 * history, detail row, plan, capture report, and the catalogs the work type
 * pulls in). Under a rural 4G that drops mid-job, none of them answer. This
 * stores the whole set as one snapshot per work order when they succeed, and
 * hands it back when they do not.
 *
 * What is deliberately NOT cached: signed photo URLs and example thumbnails.
 * They expire in an hour, so a cached one is a broken image rather than a
 * picture — the form shows the slot as filled and moves on.
 */

import { STORE_ORDERS, idbDelete, idbGet, idbPut } from '@/lib/idb'
import type { CaptureAnswers, CapturePlan } from '@/types/capture-plan'
import type { CapturePhotoRow } from '@/services/capturePlanService'
import type { WorkOrderWithRelations, ReportedServiceItemDraft } from '@/services/workOrderService'
import type { ServiceItemWithRelations } from '@/types/service-items'
import type { InventoryVehicle } from '@/types/material-inventory'

export interface CachedOrderSnapshot {
  workOrderId: string
  order: WorkOrderWithRelations
  plan: CapturePlan | null
  answers: CaptureAnswers
  photos: CapturePhotoRow[]
  reportedDrafts: ReportedServiceItemDraft[]
  catalog: ServiceItemWithRelations[]
  vehicles: InventoryVehicle[]
  returnedNote: string | null
  cachedAt: string
}

export async function cacheOrderSnapshot(
  snapshot: Omit<CachedOrderSnapshot, 'cachedAt'>,
): Promise<void> {
  try {
    await idbPut<CachedOrderSnapshot>(STORE_ORDERS, {
      ...snapshot,
      cachedAt: new Date().toISOString(),
    })
  } catch {
    // A device that cannot cache still works online; nothing to tell the user.
  }
}

export async function readOrderSnapshot(workOrderId: string): Promise<CachedOrderSnapshot | null> {
  try {
    return await idbGet<CachedOrderSnapshot>(STORE_ORDERS, workOrderId)
  } catch {
    return null
  }
}

/**
 * Updates just what the technician has entered — what "save draft" does with no
 * network. Does nothing when the order was never cached: there is no snapshot
 * to reopen anyway.
 */
export async function cacheAnswers(
  workOrderId: string,
  answers: CaptureAnswers,
  reportedDrafts: ReportedServiceItemDraft[],
): Promise<void> {
  const snapshot = await readOrderSnapshot(workOrderId)
  if (!snapshot) return
  await cacheOrderSnapshot({ ...snapshot, answers, reportedDrafts })
}

export async function forgetOrderSnapshot(workOrderId: string): Promise<void> {
  try {
    await idbDelete(STORE_ORDERS, workOrderId)
  } catch {
    // Nothing to do.
  }
}
