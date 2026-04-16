import { describe, it, expect, vi, beforeEach } from 'vitest'
import { workTypeToDetailTable, generateDataHash } from '@/services/workOrderService'
import type { WorkType } from '@/types/enums'

// ── workTypeToDetailTable ───────────────────────────────────────────────────

describe('workTypeToDetailTable', () => {
  const cases: [WorkType, string][] = [
    ['soplado',        'wo_detail_soplado'],
    ['fusion_ap',      'wo_detail_fusion_ap'],
    ['fusion_dp',      'wo_detail_fusion_dp'],
    ['alta',           'wo_detail_alta'],
    ['nt_installation','wo_detail_nt'],
    ['patchkabel',     'wo_detail_patchkabel'],
  ]

  it.each(cases)('maps %s → %s', (workType, expected) => {
    expect(workTypeToDetailTable(workType)).toBe(expected)
  })
})

// ── generateDataHash ────────────────────────────────────────────────────────

describe('generateDataHash', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await generateDataHash({ foo: 'bar' })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic regardless of object key insertion order', async () => {
    const h1 = await generateDataHash({ a: 1, b: 2 })
    const h2 = await generateDataHash({ b: 2, a: 1 })
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different data', async () => {
    const h1 = await generateDataHash({ value: 'alpha' })
    const h2 = await generateDataHash({ value: 'beta' })
    expect(h1).not.toBe(h2)
  })

  it('handles nested objects and arrays', async () => {
    const hash = await generateDataHash({ nested: { x: [1, 2, 3] } })
    expect(hash).toHaveLength(64)
  })
})

// ── Supabase-dependent functions (mocked) ──────────────────────────────────

vi.mock('@/lib/supabase', () => {
  const chain = () => {
    const obj: Record<string, unknown> = {}
    const methods = [
      'from', 'select', 'insert', 'update', 'delete', 'eq',
      'order', 'range', 'not', 'or', 'gte', 'lte', 'is',
      'maybeSingle', 'single', 'limit',
    ]
    for (const m of methods) obj[m] = vi.fn(() => obj)
    return obj
  }
  return { supabase: chain() }
})

// Import after mock so the module picks up the mock
import { fetchWorkOrder, fetchWorkOrders } from '@/services/workOrderService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchWorkOrder — error path', () => {
  it('returns null data and error message on Supabase error', async () => {
    // Patch the terminal `.single()` to return an error
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    })

    const result = await fetchWorkOrder('non-existent-id')
    expect(result.data).toBeNull()
    expect(result.error).toBe('not found')
  })
})

describe('fetchWorkOrders — success path', () => {
  it('returns data and total when Supabase responds successfully', async () => {
    const fakeOrders = [{ id: '1', order_number: 'LUM-001' }]
    const rangeMock = vi.fn().mockResolvedValue({
      data: fakeOrders,
      count: 1,
      error: null,
    })
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: rangeMock,
        }),
      }),
    })

    const result = await fetchWorkOrders({}, 0, 25)
    expect(result.error).toBeNull()
    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
  })
})
