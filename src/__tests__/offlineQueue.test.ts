/// <reference types="node" />

// jsdom has no IndexedDB, and the offline path is the one part of the app that
// runs when nothing else does — it gets a real store, not a stub.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetLumenDb } from '@/lib/idb'
import {
  countPending,
  enqueuePhoto,
  enqueueSubmission,
  markPhotoFailed,
  pendingPhotos,
  pendingSubmission,
  pendingSubmissions,
  removePhoto,
  removeSubmission,
  type PhotoToQueue,
} from '@/services/offlineQueue'

const WO_A = '50000000-0000-0000-0000-0000000000a1'
const WO_B = '50000000-0000-0000-0000-0000000000b2'
const USER = '00000000-0000-0000-0000-000000000002'

function photo(workOrderId: string, slotKey: string, overrides: Partial<PhotoToQueue> = {}) {
  return {
    workOrderId,
    sectionKey: 'mandatory',
    slotKey,
    itemId: null,
    legacyType: 'before' as const,
    fileName: `${slotKey}.jpg`,
    contentType: 'image/jpeg',
    file: new Blob([slotKey], { type: 'image/jpeg' }),
    takenAt: new Date().toISOString(),
    location: null,
    ...overrides,
  }
}

function submission(workOrderId: string, overrides = {}) {
  return {
    workOrderId,
    planKey: 'soplado_ra',
    planVersion: 1,
    answers: { details: { meters: 120 } },
    detailTable: 'wo_detail_soplado',
    detail: { meters: 120 },
    notes: 'Fertig',
    consumption: null,
    notification: null,
    userId: USER,
    userRole: 'technician' as const,
    ...overrides,
  }
}

beforeEach(() => {
  // A fresh database per test: the queue is global state by design.
  globalThis.indexedDB = new IDBFactory()
  resetLumenDb()
})

describe('the offline photo queue', () => {
  it('stores a shot with everything the upload will need', async () => {
    const id = await enqueuePhoto(photo(WO_A, 'fiber_dp', { itemId: 'c1', legacyType: 'during' }))
    expect(id).not.toBeNull()

    const [stored] = await pendingPhotos(WO_A)
    expect(stored).toMatchObject({
      workOrderId: WO_A,
      sectionKey: 'mandatory',
      slotKey: 'fiber_dp',
      itemId: 'c1',
      legacyType: 'during',
      contentType: 'image/jpeg',
    })
    expect(new TextDecoder().decode(stored.bytes)).toBe('fiber_dp')
    expect(stored.queuedAt).toBeTruthy()
  })

  it('keeps each order’s photos apart', async () => {
    await enqueuePhoto(photo(WO_A, 'fiber_dp'))
    await enqueuePhoto(photo(WO_A, 'balloon_pop'))
    await enqueuePhoto(photo(WO_B, 'fiber_dp'))

    expect(await pendingPhotos(WO_A)).toHaveLength(2)
    expect(await pendingPhotos(WO_B)).toHaveLength(1)
    expect(await pendingPhotos()).toHaveLength(3)
  })

  it('hands them back in the order they were taken', async () => {
    await enqueuePhoto(photo(WO_A, 'first', { takenAt: '2026-07-25T08:00:00.000Z' }))
    await new Promise((resolve) => setTimeout(resolve, 2))
    await enqueuePhoto(photo(WO_A, 'second'))

    expect((await pendingPhotos(WO_A)).map((row) => row.slotKey)).toEqual(['first', 'second'])
  })

  it('remembers why the last attempt failed without losing the blob', async () => {
    await enqueuePhoto(photo(WO_A, 'fiber_dp'))
    const [stored] = await pendingPhotos(WO_A)

    await markPhotoFailed(stored, 'storage 503')

    const [again] = await pendingPhotos(WO_A)
    expect(again.lastError).toBe('storage 503')
    expect(new TextDecoder().decode(again.bytes)).toBe('fiber_dp')
    expect(await pendingPhotos(WO_A)).toHaveLength(1)
  })

  it('forgets a photo once it is uploaded', async () => {
    await enqueuePhoto(photo(WO_A, 'fiber_dp'))
    const [stored] = await pendingPhotos(WO_A)

    await removePhoto(stored.id!)

    expect(await pendingPhotos(WO_A)).toHaveLength(0)
  })
})

describe('the offline submission queue', () => {
  it('keeps one submission per work order — sending twice replaces the first', async () => {
    expect(await enqueueSubmission(submission(WO_A, { notes: 'erste' }))).toBe(true)
    expect(await enqueueSubmission(submission(WO_A, { notes: 'zweite' }))).toBe(true)

    const stored = await pendingSubmissions()
    expect(stored).toHaveLength(1)
    expect(stored[0].notes).toBe('zweite')
  })

  it('reads back one order’s submission', async () => {
    await enqueueSubmission(submission(WO_A))
    await enqueueSubmission(submission(WO_B))

    expect((await pendingSubmission(WO_A))?.workOrderId).toBe(WO_A)
    expect(await pendingSubmission('50000000-0000-0000-0000-00000000ffff')).toBeNull()
  })

  it('forgets a submission once it lands', async () => {
    await enqueueSubmission(submission(WO_A))
    await removeSubmission(WO_A)
    expect(await pendingSubmissions()).toHaveLength(0)
  })

  it('counts what the banner has to announce', async () => {
    await enqueuePhoto(photo(WO_A, 'fiber_dp'))
    await enqueuePhoto(photo(WO_B, 'fiber_dp'))
    await enqueueSubmission(submission(WO_A))

    expect(await countPending()).toEqual({ photos: 2, submissions: 1 })
  })
})

describe('a device that cannot store anything', () => {
  beforeEach(() => {
    // Private mode / exhausted quota: opening the database throws.
    ;(globalThis as { indexedDB?: unknown }).indexedDB = undefined
    resetLumenDb()
  })

  it('reports the failure instead of pretending the shot is queued', async () => {
    expect(await enqueuePhoto(photo(WO_A, 'fiber_dp'))).toBeNull()
    expect(await enqueueSubmission(submission(WO_A))).toBe(false)
  })

  it('reads as empty rather than throwing into the UI', async () => {
    expect(await pendingPhotos(WO_A)).toEqual([])
    expect(await pendingSubmissions()).toEqual([])
    expect(await countPending()).toEqual({ photos: 0, submissions: 0 })
  })
})
