/**
 * What the technician did without coverage, waiting for a network.
 *
 * Two queues, both in IndexedDB (`src/lib/idb.ts`):
 *   - photos      : one entry per shot, with the slot it belongs to and the blob
 *   - submissions : one entry per work order, the whole "send the Rückmeldung"
 *                   act — answers, legacy detail row, material consumption,
 *                   notes and the status transitions it has to make
 *
 * They are separate because they drain in a fixed order: every photo of an order
 * has to be in Storage before its submission runs, or the certification gate
 * (migration 054) sees a Rückmeldung whose plan is unsatisfied. `offlineSync.ts`
 * owns that ordering; this module only stores and hands back.
 *
 * Nothing here throws for the caller to catch: a device that cannot write to
 * IndexedDB (private mode, quota) reports false, and the UI says the shot could
 * not be saved instead of pretending it is queued.
 */

import {
  STORE_PHOTOS,
  STORE_SUBMISSIONS,
  idbDelete,
  idbGetAll,
  idbGetAllByIndex,
  idbGet,
  idbPut,
} from '@/lib/idb'
import type { ReportSubmittedNotification } from '@/services/notificationService'
import type { CaptureAnswers, CaptureGeoPoint, LegacyPhotoType } from '@/types/capture-plan'
import type { ConsumptionDraft } from '@/types/material-inventory'
import type { UserRole } from '@/types/enums'

export interface QueuedPhoto {
  /** Auto-incremented; present on everything read back out. */
  id?: number
  workOrderId: string
  /**
   * Who took it. Stored per photo, not taken from the order's submission: a
   * technician who shoots and walks away without sending has photos to upload
   * and no submission to borrow an uploader from.
   */
  userId: string
  sectionKey: string
  slotKey: string
  itemId: string | null
  legacyType: LegacyPhotoType
  fileName: string
  contentType: string
  /**
   * The scaled image, as bytes rather than a Blob on purpose: iOS Safari — the
   * browser these phones actually run — has a long history of losing Blobs
   * stored in IndexedDB, and an ArrayBuffer survives a structured clone
   * everywhere. Rebuilt with `new Blob([bytes], { type: contentType })`.
   */
  bytes: ArrayBuffer
  takenAt: string
  location: CaptureGeoPoint | null
  queuedAt: string
  /** Why the last flush could not upload it, shown next to the tile. */
  lastError?: string | null
}

/** The consumption lines a submission still owes the inventory. */
export interface QueuedConsumption {
  vehicleId: string
  drafts: ConsumptionDraft[]
}

export interface QueuedSubmission {
  workOrderId: string
  planKey: string
  planVersion: number
  answers: CaptureAnswers
  detailTable: string
  detail: Record<string, unknown>
  notes: string
  consumption: QueuedConsumption | null
  /** Telegram card, sent after the transition lands. */
  notification: ReportSubmittedNotification | null
  userId: string
  userRole: UserRole
  queuedAt: string
  lastError?: string | null
}

// ── Photos ───────────────────────────────────────────────────────────────────

/** What the caller has in hand: the scaled file, not bytes. */
export type PhotoToQueue = Omit<QueuedPhoto, 'id' | 'queuedAt' | 'bytes'> & { file: Blob }

/** Stores one shot. Returns the queue id, or null when the device cannot store it. */
export async function enqueuePhoto(photo: PhotoToQueue): Promise<number | null> {
  try {
    const { file, ...rest } = photo
    const key = await idbPut<Omit<QueuedPhoto, 'id'>>(STORE_PHOTOS, {
      ...rest,
      bytes: await file.arrayBuffer(),
      queuedAt: new Date().toISOString(),
    })
    return typeof key === 'number' ? key : null
  } catch {
    return null
  }
}

/** The stored bytes as something Storage and `<img>` can take. */
export function queuedPhotoBlob(photo: QueuedPhoto): Blob {
  return new Blob([photo.bytes], { type: photo.contentType })
}

export async function pendingPhotos(workOrderId?: string): Promise<QueuedPhoto[]> {
  try {
    const rows = workOrderId
      ? await idbGetAllByIndex<QueuedPhoto>(STORE_PHOTOS, 'workOrderId', workOrderId)
      : await idbGetAll<QueuedPhoto>(STORE_PHOTOS)
    // Oldest first: the technician's own order of capture is the upload order.
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  } catch {
    return []
  }
}

export async function removePhoto(id: number): Promise<void> {
  try {
    await idbDelete(STORE_PHOTOS, id)
  } catch {
    // A photo that cannot be deleted would be uploaded twice on the next flush.
    // Storage is broken at that point; the duplicate is the lesser problem.
  }
}

export async function markPhotoFailed(photo: QueuedPhoto, error: string): Promise<void> {
  try {
    await idbPut<QueuedPhoto>(STORE_PHOTOS, { ...photo, lastError: error })
  } catch {
    // Best effort: the entry stays queued either way.
  }
}

// ── Submissions ──────────────────────────────────────────────────────────────

/** Queues (or replaces) the pending submission of a work order. */
export async function enqueueSubmission(
  submission: Omit<QueuedSubmission, 'queuedAt'>,
): Promise<boolean> {
  try {
    await idbPut<QueuedSubmission>(STORE_SUBMISSIONS, {
      ...submission,
      queuedAt: new Date().toISOString(),
    })
    return true
  } catch {
    return false
  }
}

export async function pendingSubmissions(): Promise<QueuedSubmission[]> {
  try {
    const rows = await idbGetAll<QueuedSubmission>(STORE_SUBMISSIONS)
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  } catch {
    return []
  }
}

export async function pendingSubmission(workOrderId: string): Promise<QueuedSubmission | null> {
  try {
    return await idbGet<QueuedSubmission>(STORE_SUBMISSIONS, workOrderId)
  } catch {
    return null
  }
}

export async function removeSubmission(workOrderId: string): Promise<void> {
  try {
    await idbDelete(STORE_SUBMISSIONS, workOrderId)
  } catch {
    // Same as removePhoto: nothing useful left to do on a broken store.
  }
}

export async function markSubmissionFailed(
  submission: QueuedSubmission,
  error: string,
): Promise<void> {
  try {
    await idbPut<QueuedSubmission>(STORE_SUBMISSIONS, { ...submission, lastError: error })
  } catch {
    // Best effort.
  }
}

// ── Counts, for the banner ───────────────────────────────────────────────────

export interface PendingCounts {
  photos: number
  submissions: number
}

export async function countPending(): Promise<PendingCounts> {
  const [photos, submissions] = await Promise.all([pendingPhotos(), pendingSubmissions()])
  return { photos: photos.length, submissions: submissions.length }
}
