import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSupabaseClient } from '@/lib/demo/supabase-mock'
import { getStore, resetStore } from '@/lib/demo/store'

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
const CREATED_WO_ID = '50000000-0000-0000-0000-000000000001'
const DIRECT_WO_ID = '50000000-0000-0000-0000-000000000004'
const EXTERNAL_WO_ID = '50000000-0000-0000-0000-000000000007'

beforeEach(() => {
  resetStore()
})

describe('demo business-rule RPC parity', () => {
  it('blocks assignment to non-compliant demo contractors without mutating the work order', async () => {
    const client = createDemoSupabaseClient()

    const result = await client.rpc('assign_work_order_checked', {
      p_work_order_id: CREATED_WO_ID,
      p_team: 'gelb',
      p_assignee_id: CONTRACTOR_ID,
      p_assigned_date: '2026-04-28',
      p_changed_by: ADMIN_ID,
      p_notes: 'demo assignment',
    })

    expect(result.data).toBeNull()
    expect(result.error?.message).toMatch(/unbedenklichkeit_sozialkasse/)
    const unchanged = getStore().work_orders.find((order) => order.id === CREATED_WO_ID)
    expect(unchanged?.assigned_technician).toBeNull()
    expect(unchanged?.status).toBe('created')
  })

  it('atomically accepts a client work order and creates a client audit', async () => {
    const client = createDemoSupabaseClient()
    const store = getStore()
    const order = store.work_orders.find((item) => item.id === EXTERNAL_WO_ID)
    if (order) order.status = 'sent_to_client'
    window.localStorage.setItem('lumen-demo-store-v1', JSON.stringify(store))

    const result = await client.rpc('accept_work_order_client', {
      p_work_order_id: EXTERNAL_WO_ID,
      p_changed_by: ADMIN_ID,
      p_data_hash: 'client-hash',
      p_notes: 'accepted in demo',
    })

    expect(result.error).toBeNull()
    const accepted = result.data as Record<string, unknown> | null
    expect(accepted?.status).toBe('client_accepted')
    const updatedStore = getStore()
    expect(updatedStore.certification_audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          work_order_id: EXTERNAL_WO_ID,
          cert_type: 'client',
          data_hash: 'client-hash',
        }),
      ]),
    )
    expect(updatedStore.work_order_state_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ work_order_id: EXTERNAL_WO_ID, to_status: 'client_accepted' }),
      ]),
    )
  })

  it('invoices direct orders with internal audit without requiring client audit', async () => {
    const client = createDemoSupabaseClient()

    const result = await client.rpc('invoice_work_order_checked', {
      p_work_order_id: DIRECT_WO_ID,
      p_changed_by: ADMIN_ID,
      p_billing_reference: 'DEMO-INV-1',
      p_notes: 'direct invoice',
    })

    expect(result.error).toBeNull()
    const invoiced = result.data as Record<string, unknown> | null
    expect(invoiced?.status).toBe('invoiced')
    expect(invoiced?.billing_reference).toBe('DEMO-INV-1')
  })
})
