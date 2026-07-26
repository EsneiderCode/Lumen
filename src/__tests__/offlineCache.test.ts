/// <reference types="node" />

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Rückmeldung screen opens on six round trips. Here they are all under
// control, so the question the tests can ask is the only one that matters in a
// trench: what does the technician see when the network stops answering?
const fetchWorkOrder = vi.fn()
const fetchWorkOrderPhotos = vi.fn(async () => ({ data: [{ id: 'p1', storage_path: 'a.jpg' }] }))
const fetchStateHistory = vi.fn(async () => ({
  data: [{ to_status: 'returned', notes: 'Foto unscharf' }],
}))
const fetchCapturePlanForOrder = vi.fn(async () => ({
  key: 'soplado',
  version: 1,
  sections: [],
}))
const fetchCaptureReport = vi.fn(async () => ({
  data: {
    answers: { details: { meters: 140 } },
    reported_service_items: [{ service_item_id: 'si-1', qty: 2, notes: null }],
  },
}))

vi.mock('@/services/workOrderService', () => ({
  fetchWorkOrder: (id: string) => fetchWorkOrder(id),
  fetchWorkOrderPhotos: () => fetchWorkOrderPhotos(),
  fetchStateHistory: () => fetchStateHistory(),
  normalizeReportedServiceItems: (value: unknown) => (Array.isArray(value) ? value : []),
}))
vi.mock('@/services/serviceItemService', () => ({ fetchServiceItems: async () => ({ data: [] }) }))
vi.mock('@/services/materialInventoryService', () => ({
  fetchVehicles: async () => ({ data: [{ id: 'v1' }] }),
}))
vi.mock('@/services/capturePlanService', () => ({
  fetchCapturePlanForOrder: () => fetchCapturePlanForOrder(),
  fetchCaptureReport: () => fetchCaptureReport(),
}))

import { resetLumenDb } from '@/lib/idb'
import { cacheAnswers, readOrderSnapshot } from '@/services/offlineCache'
import { loadRueckmeldung } from '@/services/rueckmeldungLoader'

const WO = '50000000-0000-0000-0000-000000000003'

const ORDER = {
  id: WO,
  order_number: 'LUM-20260427-0003',
  work_type: 'soplado',
  status: 'in_progress',
  client_id: 'c1',
  operator_id: 'o1',
  assigned_team: 'rot',
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetLumenDb()
  vi.clearAllMocks()
  fetchWorkOrder.mockImplementation(async () => ({ data: ORDER, error: null }))
})

describe('opening the Rückmeldung with a network', () => {
  it('assembles the screen and keeps a copy on the device', async () => {
    const result = await loadRueckmeldung(WO, null)

    expect(result.fromCache).toBe(false)
    expect(result.data?.order.order_number).toBe('LUM-20260427-0003')
    expect(result.data?.photos).toHaveLength(1)
    expect(result.data?.returnedNote).toBe('Foto unscharf')
    // Everything the technician entered comes out of the capture report — the
    // wo_detail_* tables are gone (phase 7).
    expect(result.data?.answers).toMatchObject({ details: { meters: 140 } })

    expect((await readOrderSnapshot(WO))?.order.order_number).toBe('LUM-20260427-0003')
  })
})

describe('opening it again with no network', () => {
  it('hands back the last snapshot instead of an empty screen', async () => {
    await loadRueckmeldung(WO, null)

    fetchWorkOrder.mockImplementation(async () => ({ data: null, error: 'Failed to fetch' }))
    const offline = await loadRueckmeldung(WO, null)

    expect(offline.fromCache).toBe(true)
    expect(offline.error).toBeNull()
    expect(offline.cachedAt).toBeTruthy()
    expect(offline.data?.order.order_number).toBe('LUM-20260427-0003')
    expect(offline.data?.answers).toMatchObject({ details: { meters: 140 } })
  })

  it('survives a request that throws rather than resolving', async () => {
    await loadRueckmeldung(WO, null)

    fetchWorkOrder.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const offline = await loadRueckmeldung(WO, null)

    expect(offline.fromCache).toBe(true)
    expect(offline.data?.order.id).toBe(WO)
  })

  it('shows the draft saved offline, not the one that was loaded', async () => {
    await loadRueckmeldung(WO, null)
    await cacheAnswers(WO, { details: { meters: 999 } }, [])

    fetchWorkOrder.mockImplementation(async () => ({ data: null, error: 'Failed to fetch' }))
    const offline = await loadRueckmeldung(WO, null)

    expect(offline.data?.answers).toMatchObject({ details: { meters: 999 } })
  })

  it('reports the failure when there is nothing cached to fall back on', async () => {
    fetchWorkOrder.mockImplementation(async () => ({ data: null, error: 'Failed to fetch' }))

    const result = await loadRueckmeldung(WO, null)

    expect(result.data).toBeNull()
    expect(result.fromCache).toBe(false)
    expect(result.error).toBe('Failed to fetch')
  })
})
