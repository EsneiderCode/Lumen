import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { bulkWorkOrderAction } from '@/services/workOrderService'

const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bulkWorkOrderAction', () => {
  it('returns one structured result per selected invoice item with mixed outcomes', async () => {
    rpcMock.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      if (args.p_work_order_id === 'wo-ok') {
        return { data: { id: 'wo-ok', status: 'invoiced' }, error: null }
      }
      return {
        data: null,
        error: { message: 'client invoice requires client_accepted status and client audit' },
      }
    })

    const result = await bulkWorkOrderAction({
      action: 'invoice',
      workOrders: [
        { id: 'wo-ok', orderNumber: 'LUM-1' },
        { id: 'wo-fail', orderNumber: 'LUM-2' },
      ],
      changedBy: 'admin-1',
      billingReference: 'INV-42',
      notes: 'Bulk invoice',
    })

    expect(result).toMatchObject({
      action: 'invoice',
      total: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
    })
    expect(result.items).toEqual([
      expect.objectContaining({ workOrderId: 'wo-ok', orderNumber: 'LUM-1', outcome: 'succeeded', reasons: [] }),
      expect.objectContaining({
        workOrderId: 'wo-fail',
        orderNumber: 'LUM-2',
        outcome: 'failed',
        reasons: [expect.objectContaining({ code: 'missing_client_audit' })],
      }),
    ])
  })

  it('marks unsupported selected actions as skipped without dropping items', async () => {
    const result = await bulkWorkOrderAction({
      action: 'send_to_client',
      workOrders: [{ id: 'wo-1', orderNumber: 'LUM-1' }],
      changedBy: 'admin-1',
      notes: 'Send',
    })

    expect(result.total).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.items).toEqual([
      expect.objectContaining({
        workOrderId: 'wo-1',
        outcome: 'skipped',
        reasons: [expect.objectContaining({ code: 'invalid_transition' })],
      }),
    ])
  })
})
