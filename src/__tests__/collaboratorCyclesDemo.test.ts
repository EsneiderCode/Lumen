import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSupabaseClient } from '@/lib/demo/supabase-mock'
import { resetStore } from '@/lib/demo/store'

const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
const PUBLISHED_CYCLE = 'c1c1c1c1-0000-0000-0000-000000000001'
const DRAFT_CYCLE = 'c1c1c1c1-0000-0000-0000-000000000002'

beforeEach(() => {
  resetStore()
})

describe('demo collaborator cycle publish gate', () => {
  it('returns only the contractor\'s PUBLISHED cycle (draft is hidden)', async () => {
    const client = createDemoSupabaseClient()
    const { data, error } = await client
      .from('collaborator_cycles')
      .select('*')
      .eq('collaborator_id', CONTRACTOR_ID)
      .eq('status', 'published')

    expect(error).toBeNull()
    const rows = (data ?? []) as Array<{ id: string; status: string }>
    expect(rows.map((r) => r.id)).toEqual([PUBLISHED_CYCLE])
    expect(rows.every((r) => r.status === 'published')).toBe(true)
  })

  it('admin (no status filter) sees both the published and the draft cycle', async () => {
    const client = createDemoSupabaseClient()
    const { data } = await client
      .from('collaborator_cycles')
      .select('*')
      .eq('collaborator_id', CONTRACTOR_ID)

    const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id).sort()
    expect(ids).toEqual([PUBLISHED_CYCLE, DRAFT_CYCLE].sort())
  })

  it('exposes the work orders attached to the published cycle via the bridge', async () => {
    const client = createDemoSupabaseClient()
    const { data } = await client
      .from('collaborator_cycle_orders')
      .select('work_order_id')
      .eq('cycle_id', PUBLISHED_CYCLE)

    const ids = (data ?? []) as Array<{ work_order_id: string }>
    expect(ids).toHaveLength(2)
  })
})
