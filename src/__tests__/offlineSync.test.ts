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
const saveCaptureReport = vi.fn(async () => {
  calls.push('answers')
  return { error: null as string | null }
})
const upsertWorkOrderDetail = vi.fn(async () => {
  calls.push('detail')
  return { data: null, error: null as string | null }
})
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

vi.mock('@/services/capturePlanService', () => ({
  uploadCapturePhoto: (args: { slotKey: string }) => uploadCapturePhoto(args),
  saveCaptureReport: () => saveCaptureReport(),
}))
vi.mock('@/services/workOrderService', () => ({
  upsertWorkOrderDetail: () => upsertWorkOrderDetail(),
  transitionWorkOrderStatus: (id: string, status: string) => transitionWorkOrderStatus(id, status),
}))
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
    detailTable: 'wo_detail_soplado',
    detail: { meters: 120 },
    notes: 'Fertig',
    needsPendingStep: false,
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
  vi.clearAllMocks()
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
      'detail',
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

  it('makes the intermediate status hop the state machine demands', async () => {
    await queueSubmission(WO_A, { needsPendingStep: true })

    await syncOfflineQueue()

    expect(calls).toEqual([
      'answers',
      'detail',
      'status:rueckmeldung_pending',
      'status:rueckmeldung_sent',
    ])
  })

  it('books material before the transition, and only when there is some', async () => {
    await queueSubmission(WO_A, {
      consumption: { vehicleId: 'v1', drafts: [{ material_id: 'm1', quantity: 2 }] },
    })

    await syncOfflineQueue()

    expect(calls).toEqual(['answers', 'detail', 'material', 'status:rueckmeldung_sent'])
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

    expect(calls).toEqual(['answers', 'detail', 'status:rueckmeldung_sent', 'telegram'])
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
