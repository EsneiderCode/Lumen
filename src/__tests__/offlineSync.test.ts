/// <reference types="node" />

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every write the drain can make is recorded in one list, because the thing
// under test is not what it calls — it is the ORDER it calls them in. A
// Rückmeldung whose status reaches `rueckmeldung_sent` before its photos are in
// Storage is one the certification gate (migration 054) will refuse, with the
// technician already gone.
const calls: string[] = []

type UploadResult = { data: { id: string } | null; error: string | null }

const uploadCapturePhoto = vi.fn(async ({ slotKey }: { slotKey: string }): Promise<UploadResult> => {
  calls.push(`upload:${slotKey}`)
  return { data: { id: slotKey }, error: null }
})
const saveCaptureReport = vi.fn(async (args: { reportedServiceItems?: unknown }) => {
  calls.push('answers')
  savedReportedItems = args.reportedServiceItems
  return { error: null as string | null }
})
let savedReportedItems: unknown
const registerMaterialConsumption = vi.fn(async () => {
  calls.push('material')
  return { correctionRequired: [] as unknown[], error: null as string | null }
})
const transitionWorkOrderStatus = vi.fn(async (_id: string, status: string) => {
  calls.push(`status:${status}`)
  return { error: null as string | null }
})
const notifyReportSubmitted = vi.fn(async () => {
  calls.push('telegram')
})
// The drain asks the server where the order actually is before transitioning,
// because hours may have passed since it was queued.
const fetchWorkOrder = vi.fn(async () => ({
  data: { status: 'rueckmeldung_pending' as string },
  error: null,
}))

vi.mock('@/services/capturePlanService', () => ({
  uploadCapturePhoto: (args: { slotKey: string }) => uploadCapturePhoto(args),
  saveCaptureReport: (args: { reportedServiceItems?: unknown }) => saveCaptureReport(args),
}))
vi.mock('@/services/workOrderService', () => ({
  fetchWorkOrder: () => fetchWorkOrder(),
  normalizeReportedServiceItems: (value: unknown) => (Array.isArray(value) ? value : []),
  transitionWorkOrderStatus: (id: string, status: string) => transitionWorkOrderStatus(id, status),
}))
// NOT mocked: the route through the state machine is exactly what these tests
// are checking, and it is pure.
vi.mock('@/services/materialInventoryService', () => ({
  registerMaterialConsumption: () => registerMaterialConsumption(),
}))
vi.mock('@/services/notificationService', () => ({
  notifyReportSubmitted: () => notifyReportSubmitted(),
}))

import { resetLumenDb } from '@/lib/idb'
import {
  enqueuePhoto,
  enqueueSubmission,
  pendingPhotos,
  pendingSubmissions,
} from '@/services/offlineQueue'
import { syncOfflineQueue } from '@/services/offlineSync'

const WO_A = '50000000-0000-0000-0000-0000000000a1'
const WO_B = '50000000-0000-0000-0000-0000000000b2'
const USER = '00000000-0000-0000-0000-000000000002'

function queuePhoto(workOrderId: string, slotKey: string) {
  return enqueuePhoto({
    workOrderId,
    userId: USER,
    sectionKey: 'mandatory',
    slotKey,
    itemId: null,
    legacyType: 'before',
    fileName: `${slotKey}.jpg`,
    contentType: 'image/jpeg',
    file: new Blob([slotKey], { type: 'image/jpeg' }),
    takenAt: '2026-07-25T08:00:00.000Z',
    location: null,
  })
}

function queueSubmission(workOrderId: string, overrides: Record<string, unknown> = {}) {
  return enqueueSubmission({
    workOrderId,
    planKey: 'soplado_ra',
    planVersion: 1,
    answers: { details: { meters: 120 } },
    reportedServiceItems: [],
    notes: 'Fertig',
    consumption: null,
    notification: null,
    userId: USER,
    userRole: 'technician',
    ...overrides,
  })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetLumenDb()
  calls.length = 0
  savedReportedItems = undefined
  vi.clearAllMocks()
  saveCaptureReport.mockImplementation(async (args: { reportedServiceItems?: unknown }) => {
    calls.push('answers')
    savedReportedItems = args.reportedServiceItems
    return { error: null }
  })
  uploadCapturePhoto.mockImplementation(async ({ slotKey }: { slotKey: string }) => {
    calls.push(`upload:${slotKey}`)
    return { data: { id: slotKey }, error: null }
  })
  transitionWorkOrderStatus.mockImplementation(async (_id: string, status: string) => {
    calls.push(`status:${status}`)
    return { error: null }
  })
  registerMaterialConsumption.mockImplementation(async () => {
    calls.push('material')
    return { correctionRequired: [], error: null }
  })
  fetchWorkOrder.mockImplementation(async () => ({
    data: { status: 'rueckmeldung_pending' },
    error: null,
  }))
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('draining the offline queue', () => {
  it('uploads every photo before it writes the answers, and transitions last', async () => {
    await queuePhoto(WO_A, 'fiber_dp')
    await queuePhoto(WO_A, 'balloon_pop')
    await queueSubmission(WO_A)

    const result = await syncOfflineQueue()

    expect(calls).toEqual([
      'upload:fiber_dp',
      'upload:balloon_pop',
      'answers',
      'status:rueckmeldung_sent',
    ])
    expect(result).toMatchObject({ photosUploaded: 2, submissionsSent: 1, submissionsFailed: 0 })
  })

  it('empties the queue only for what actually landed', async () => {
    await queuePhoto(WO_A, 'fiber_dp')
    await queueSubmission(WO_A)

    await syncOfflineQueue()

    expect(await pendingPhotos()).toHaveLength(0)
    expect(await pendingSubmissions()).toHaveLength(0)
  })

  // The technician shot the trench, the network was gone, and they closed the
  // app without sending. The photos are still evidence of the job.
  it('uploads photos of an order that was never sent', async () => {
    await queuePhoto(WO_A, 'fiber_dp')

    const result = await syncOfflineQueue()

    expect(calls).toEqual(['upload:fiber_dp'])
    expect(result.photosUploaded).toBe(1)
    expect(await pendingPhotos()).toHaveLength(0)
    // No submission means no status change: sending is still the tech's call.
    expect(transitionWorkOrderStatus).not.toHaveBeenCalled()
  })

  it('does not send a Rückmeldung whose photos failed to upload', async () => {
    uploadCapturePhoto.mockImplementation(async ({ slotKey }: { slotKey: string }) => {
      calls.push(`upload:${slotKey}`)
      return { data: null, error: 'storage 503' }
    })
    await queuePhoto(WO_A, 'fiber_dp')
    await queueSubmission(WO_A)

    const result = await syncOfflineQueue()

    expect(calls).toEqual(['upload:fiber_dp'])
    expect(saveCaptureReport).not.toHaveBeenCalled()
    expect(transitionWorkOrderStatus).not.toHaveBeenCalled()
    expect(result).toMatchObject({ photosFailed: 1, submissionsSent: 0, submissionsFailed: 1 })

    // Both stay queued, so the next attempt picks up where this one stopped.
    expect(await pendingPhotos(WO_A)).toHaveLength(1)
    expect((await pendingSubmissions())[0].lastError).toBe('storage 503')
  })

  it('one broken order does not hold back the others', async () => {
    uploadCapturePhoto.mockImplementation(async ({ slotKey }: { slotKey: string }) => {
      calls.push(`upload:${slotKey}`)
      return slotKey === 'broken'
        ? { data: null, error: 'storage 503' }
        : { data: { id: slotKey }, error: null }
    })
    await queuePhoto(WO_A, 'broken')
    await queueSubmission(WO_A)
    await queuePhoto(WO_B, 'fine')
    await queueSubmission(WO_B)

    const result = await syncOfflineQueue()

    expect(result).toMatchObject({ submissionsSent: 1, submissionsFailed: 1 })
    expect(await pendingSubmissions()).toHaveLength(1)
    expect((await pendingSubmissions())[0].workOrderId).toBe(WO_A)
  })

  it('walks every hop the state machine demands from where the order IS', async () => {
    // Queued while the job was still open: the drain has to climb the whole
    // ladder, not just the last rung.
    fetchWorkOrder.mockImplementation(async () => ({ data: { status: 'in_progress' }, error: null }))
    await queueSubmission(WO_A)

    await syncOfflineQueue()

    expect(calls).toEqual([
      'answers',
      'status:executed',
      'status:rueckmeldung_pending',
      'status:rueckmeldung_sent',
    ])
  })

  it('takes the single hop when the order is already waiting to be sent', async () => {
    fetchWorkOrder.mockImplementation(async () => ({ data: { status: 'executed' }, error: null }))
    await queueSubmission(WO_A)

    await syncOfflineQueue()

    expect(calls).toEqual([
      'answers',
      'status:rueckmeldung_pending',
      'status:rueckmeldung_sent',
    ])
  })

  it('does not resend an order somebody already sent from another device', async () => {
    fetchWorkOrder.mockImplementation(async () => ({
      data: { status: 'rueckmeldung_sent' },
      error: null,
    }))
    await queueSubmission(WO_A)

    const result = await syncOfflineQueue()

    expect(transitionWorkOrderStatus).not.toHaveBeenCalled()
    expect(result.submissionsSent).toBe(1)
    expect(await pendingSubmissions()).toHaveLength(0)
  })

  it('refuses to force an order the machine cannot take there', async () => {
    fetchWorkOrder.mockImplementation(async () => ({ data: { status: 'cancelled' }, error: null }))
    await queueSubmission(WO_A)

    const result = await syncOfflineQueue()

    expect(transitionWorkOrderStatus).not.toHaveBeenCalled()
    expect(result.submissionsFailed).toBe(1)
    expect((await pendingSubmissions())[0].lastError).toBe('not_sendable_from_cancelled')
  })

  // A phone can hold a submission for days. One queued before phase 7 carries
  // the technician's reported services in the legacy `detail` blob and has no
  // `reportedServiceItems` at all — draining it must recover them, not overwrite
  // the billing evidence with an empty list.
  it('recovers the reported services of a submission queued before phase 7', async () => {
    await queueSubmission(WO_A, {
      reportedServiceItems: undefined,
      detailTable: 'wo_detail_alta',
      detail: {
        access_type: 'Keller',
        reported_service_items: [{ service_item_id: 'si-9', qty: 3, notes: null }],
      },
    })

    await syncOfflineQueue()

    expect(savedReportedItems).toEqual([{ service_item_id: 'si-9', qty: 3, notes: null }])
  })

  it('books material before the transition, and only when there is some', async () => {
    await queueSubmission(WO_A, {
      consumption: { vehicleId: 'v1', drafts: [{ material_id: 'm1', quantity: 2 }] },
    })

    await syncOfflineQueue()

    expect(calls).toEqual(['answers', 'material', 'status:rueckmeldung_sent'])
  })

  it('leaves a stock correction for the technician instead of guessing', async () => {
    registerMaterialConsumption.mockImplementation(async () => {
      calls.push('material')
      return { correctionRequired: [{ material_id: 'm1' }], error: null }
    })
    await queueSubmission(WO_A, {
      consumption: { vehicleId: 'v1', drafts: [{ material_id: 'm1', quantity: 2 }] },
    })

    const result = await syncOfflineQueue()

    expect(transitionWorkOrderStatus).not.toHaveBeenCalled()
    expect(result.submissionsFailed).toBe(1)
    expect((await pendingSubmissions())[0].lastError).toBe('stock_correction_required')
  })

  it('sends the Telegram card only after the server accepted the transition', async () => {
    await queueSubmission(WO_A, {
      notification: { orderNumber: 'LUM-1', orderUrl: 'https://example.test/1' },
    })

    await syncOfflineQueue()

    expect(calls).toEqual(['answers', 'status:rueckmeldung_sent', 'telegram'])
  })

  it('does nothing at all while still offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await queuePhoto(WO_A, 'fiber_dp')
    await queueSubmission(WO_A)

    const result = await syncOfflineQueue()

    expect(calls).toEqual([])
    expect(result).toMatchObject({ photosUploaded: 0, submissionsSent: 0 })
    expect(await pendingSubmissions()).toHaveLength(1)
  })

  it('costs nothing when there is nothing queued', async () => {
    const result = await syncOfflineQueue()
    expect(result).toEqual({
      photosUploaded: 0,
      photosFailed: 0,
      submissionsSent: 0,
      submissionsFailed: 0,
      error: null,
    })
  })
})
