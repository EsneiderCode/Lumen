/**
 * Drains what the technician did offline, in the only order that works.
 *
 * Per work order: **photos → capture report → material → transitions**.
 * Never any other way round. The certification gate (migration 054) reads the
 * plan against the photos that are actually in Storage, so a Rückmeldung whose
 * status moves to `rueckmeldung_sent` before its photos are up is a Rückmeldung
 * the admin cannot certify — and the technician is already three villages away.
 *
 * A failure stops that one work order and leaves its queue intact; every other
 * order in the queue still runs. Nothing is ever removed from the queue before
 * the write it stands for has succeeded, so the worst case is a repeated upload,
 * never a lost photo.
 */

import { notifyReportSubmitted } from '@/services/notificationService'
import { registerMaterialConsumption } from '@/services/materialInventoryService'
import { saveCaptureReport, uploadCapturePhoto } from '@/services/capturePlanService'
import {
  fetchWorkOrder,
  normalizeReportedServiceItems,
  transitionWorkOrderStatus,
} from '@/services/workOrderService'
import { rueckmeldungSendPath } from '@/services/workOrderStateMachine'
import type { WorkOrderStatus } from '@/types/enums'
import {
  markPhotoFailed,
  markSubmissionFailed,
  pendingPhotos,
  pendingSubmissions,
  queuedPhotoBlob,
  removePhoto,
  removeSubmission,
  type QueuedPhoto,
  type QueuedSubmission,
} from '@/services/offlineQueue'

export interface SyncResult {
  photosUploaded: number
  photosFailed: number
  submissionsSent: number
  submissionsFailed: number
  /** First error of the run, for the banner. */
  error: string | null
}

const EMPTY_RESULT: SyncResult = {
  photosUploaded: 0,
  photosFailed: 0,
  submissionsSent: 0,
  submissionsFailed: 0,
  error: null,
}

/** IndexedDB keeps bytes; Storage wants a File with a name and a type. */
function toFile(photo: QueuedPhoto): File {
  return new File([queuedPhotoBlob(photo)], photo.fileName, { type: photo.contentType })
}

/**
 * Uploads every queued photo of one work order.
 * Returns the number uploaded and the first error, if any — on an error the
 * caller must NOT run that order's submission.
 */
async function uploadOrderPhotos(
  workOrderId: string,
  userId: string,
  photos: QueuedPhoto[],
): Promise<{ uploaded: number; failed: number; error: string | null }> {
  let uploaded = 0
  let failed = 0
  let firstError: string | null = null

  for (const photo of photos) {
    const { error } = await uploadCapturePhoto({
      workOrderId,
      file: toFile(photo),
      userId,
      sectionKey: photo.sectionKey,
      slotKey: photo.slotKey,
      legacyType: photo.legacyType,
      itemId: photo.itemId,
      location: photo.location,
      takenAt: photo.takenAt,
      skipScaling: true,
    })

    if (error) {
      failed += 1
      firstError ??= error
      await markPhotoFailed(photo, error)
      // Keep going: one rejected file must not hold back the rest of the job.
      continue
    }

    if (photo.id !== undefined) await removePhoto(photo.id)
    uploaded += 1
  }

  return { uploaded, failed, error: firstError }
}

/** The write half of "send the Rückmeldung", replayed exactly as the page does it. */
async function sendSubmission(submission: QueuedSubmission): Promise<string | null> {
  const reportError = await saveCaptureReport({
    workOrderId: submission.workOrderId,
    plan: { key: submission.planKey, version: submission.planVersion },
    answers: submission.answers,
    userId: submission.userId,
    submitted: true,
    // A submission queued before phase 7 has no such field; its reported
    // services are still in `detail`, so recover them rather than send `[]` and
    // wipe what the technician typed into a form with no coverage.
    reportedServiceItems:
      submission.reportedServiceItems ??
      normalizeReportedServiceItems(submission.detail?.reported_service_items),
  })
  if (reportError.error) return reportError.error

  if (submission.consumption && submission.consumption.drafts.length > 0) {
    const result = await registerMaterialConsumption({
      workOrderId: submission.workOrderId,
      vehicleId: submission.consumption.vehicleId,
      reportedBy: submission.userId,
      drafts: submission.consumption.drafts,
    })
    // A stock correction needs the technician to decide; it cannot be resolved
    // by a background flush. The submission stays queued, flagged, and the
    // Rückmeldung screen shows why when they open the order again.
    if (result.correctionRequired.length > 0) {
      return 'stock_correction_required'
    }
    if (result.error) return result.error
  }

  // The route is computed HERE, not when the submission was queued: hours may
  // have passed and the order may have moved on. An order already sent gives an
  // empty path, which is what makes a second drain harmless.
  const { data: order } = await fetchWorkOrder(submission.workOrderId)
  if (!order) return 'work order not found'

  const path = rueckmeldungSendPath(order.status as WorkOrderStatus)
  if (!path) return `not_sendable_from_${order.status}`

  for (const [index, step] of path.entries()) {
    const { error, warning, warningCode } = await transitionWorkOrderStatus(
      submission.workOrderId,
      step,
      submission.userId,
      index === path.length - 1 ? submission.notes : undefined,
      submission.userRole,
    )
    if (error) return error
    // The status write already committed. Retrying this queue item would repeat
    // successful transitions forever merely because the audit row was rejected.
    if (warning) {
      console.warn('Offline transition committed without state history', {
        workOrderId: submission.workOrderId,
        step,
        code: warningCode,
        warning,
      })
    }
  }

  if (submission.notification) {
    // Best effort, exactly as online: a Telegram outage must not requeue a
    // Rückmeldung the server has already accepted.
    await notifyReportSubmitted(submission.notification).catch(() => undefined)
  }

  return null
}

/**
 * Runs one full drain. Safe to call when there is nothing queued (it costs two
 * IndexedDB reads) and safe to call twice — the second run finds the first
 * one's work already removed.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return EMPTY_RESULT
  }

  const [photos, submissions] = await Promise.all([pendingPhotos(), pendingSubmissions()])
  if (photos.length === 0 && submissions.length === 0) return EMPTY_RESULT

  const result: SyncResult = { ...EMPTY_RESULT }

  const photosByOrder = new Map<string, QueuedPhoto[]>()
  for (const photo of photos) {
    const bucket = photosByOrder.get(photo.workOrderId)
    if (bucket) bucket.push(photo)
    else photosByOrder.set(photo.workOrderId, [photo])
  }

  const submissionByOrder = new Map(submissions.map((entry) => [entry.workOrderId, entry]))
  // Orders with a submission first: those are the ones an admin is waiting on.
  const orderIds = [...new Set([...submissionByOrder.keys(), ...photosByOrder.keys()])]

  for (const workOrderId of orderIds) {
    const submission = submissionByOrder.get(workOrderId) ?? null
    const queued = photosByOrder.get(workOrderId) ?? []
    // Photos go up even with no submission behind them: the technician may have
    // shot them and left the screen, and they are still evidence of the job.
    const userId = submission?.userId ?? queued[0]?.userId ?? null

    if (queued.length > 0 && userId) {
      const photoResult = await uploadOrderPhotos(workOrderId, userId, queued)
      result.photosUploaded += photoResult.uploaded
      result.photosFailed += photoResult.failed
      result.error ??= photoResult.error

      // The gate would reject the Rückmeldung: leave it queued and try again.
      if (photoResult.failed > 0) {
        if (submission) {
          result.submissionsFailed += 1
          await markSubmissionFailed(submission, photoResult.error ?? 'photo_upload_failed')
        }
        continue
      }
    }

    if (!submission) continue

    const error = await sendSubmission(submission)
    if (error) {
      result.submissionsFailed += 1
      result.error ??= error
      await markSubmissionFailed(submission, error)
      continue
    }

    await removeSubmission(workOrderId)
    result.submissionsSent += 1
  }

  return result
}
