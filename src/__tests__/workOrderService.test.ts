import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  workTypeToDetailTable,
  generateDataHash,
  normalizeReportedServiceItems,
  buildBillingDraftsFromReportedItems,
} from '@/services/workOrderService'
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

// ── reported service items → billing drafts ────────────────────────────────

describe('reported service items', () => {
  it('normalizes only valid non-priced technician reports', () => {
    expect(normalizeReportedServiceItems([
      { service_item_id: ' item-1 ', qty: '2', notes: ' Router ' },
      { service_item_id: '', qty: 3 },
      { service_item_id: 'item-2', qty: 0 },
      { service_item_id: 'item-3', qty: Number.NaN },
      null,
    ])).toEqual([
      { service_item_id: 'item-1', qty: 2, notes: 'Router' },
    ])
  })

  it('builds admin billing drafts from reported items and priced catalog', () => {
    const drafts = buildBillingDraftsFromReportedItems(
      [
        { service_item_id: 'item-1', qty: 2, notes: 'Router' },
        { service_item_id: 'missing', qty: 1, notes: null },
        { service_item_id: 'no-price', qty: 1, notes: null },
      ],
      [
        {
          id: 'item-1',
          code: 'ALT-001',
          description_de: 'Installation',
          description_es: null,
          unit: 'Stk',
          unit_price: 120,
          unit_price_external: 95,
          operator_id: null,
          client_id: null,
          detail_form: 'alta',
          display_order: 1,
          active: true,
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-price',
          code: 'ALT-NP',
          description_de: 'Missing price',
          description_es: null,
          unit: 'Stk',
          unit_price: null,
          unit_price_external: null,
          operator_id: null,
          client_id: null,
          detail_form: 'alta',
          display_order: 2,
          active: true,
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    )

    expect(drafts).toEqual([
      {
        service_item_id: 'item-1',
        qty: 2,
        unit_price_snapshot: 120,
        unit_price_external_snapshot: 95,
        notes: 'Router',
      },
    ])
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

// ── validateTransitionPrerequisites (Migration 004 — business rules) ───────

import { validateTransitionPrerequisites } from '@/services/workOrderService'

interface PrereqScenario {
  order?: { work_type: string; client_id: string | null } | null
  detail?: Record<string, unknown> | null
  photoTypes?: string[]
  audits?: Array<{ cert_type: string }>
}

function setupSupabaseFor(scenarios: PrereqScenario) {
  mockSupabase.from = vi.fn((table: string) => {
    if (table === 'work_orders') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve(
                scenarios.order === null
                  ? { data: null, error: { message: 'not found' } }
                  : { data: scenarios.order ?? null, error: null },
              ),
          }),
        }),
      }
    }
    if (table.startsWith('wo_detail_')) {
      const detailArray = scenarios.detail ? [scenarios.detail] : []
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: detailArray, error: null }),
            }),
          }),
        }),
      }
    }
    if (table === 'work_order_photos') {
      const photos = (scenarios.photoTypes ?? []).map((t) => ({ photo_type: t }))
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: photos, error: null }),
        }),
      }
    }
    if (table === 'certification_audits') {
      const audits = scenarios.audits ?? []
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: audits, error: null }),
            }),
          }),
        }),
      }
    }
    return {
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }
  })
}

const COMPLETE_ALTA_DETAIL = {
  access_type: 'standard',
  equipment_installed: 'NT-1234',
  client_signature: true,
}
const ALL_PHOTOS = ['before', 'during', 'after']

describe('validateTransitionPrerequisites — short-circuit', () => {
  it('returns null for transitions that do not need prerequisites', async () => {
    setupSupabaseFor({})  // would fail any DB query
    expect(await validateTransitionPrerequisites('id-1', 'assigned')).toBeNull()
    expect(await validateTransitionPrerequisites('id-1', 'in_progress')).toBeNull()
    expect(await validateTransitionPrerequisites('id-1', 'rueckmeldung_sent')).toBeNull()
    expect(await validateTransitionPrerequisites('id-1', 'paid')).toBeNull()
  })
})

describe('validateTransitionPrerequisites — internally_certified', () => {
  it('rejects when work order is not found', async () => {
    setupSupabaseFor({ order: null })
    const result = await validateTransitionPrerequisites('missing', 'internally_certified')
    expect(result).toMatch(/Auftrag nicht gefunden/i)
  })

  it('rejects when no detail row exists', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      detail: null,
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung fehlt/i)
  })

  it('rejects when detail has missing required fields', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      detail: { access_type: 'standard', equipment_installed: '', client_signature: false },
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung unvollständig/i)
    expect(result).toMatch(/equipment_installed/)
    expect(result).toMatch(/client_signature/)
  })

  it('rejects when soplado meters is 0', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1' },
      detail: { meters: 0, section: 'Tramo A' },
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung unvollständig/i)
    expect(result).toMatch(/meters/)
  })

  it('rejects when fusion has_measurement_cert is false', async () => {
    setupSupabaseFor({
      order: { work_type: 'fusion_ap', client_id: 'client-1' },
      detail: { cabinet_code: 'NE3-S-001', fiber_type: 'G.652', has_measurement_cert: false },
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung unvollständig/i)
    expect(result).toMatch(/has_measurement_cert/)
  })

  it('rejects when no photos are uploaded', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      detail: COMPLETE_ALTA_DETAIL,
      photoTypes: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Fehlende Fotos/i)
    expect(result).toMatch(/before/)
    expect(result).toMatch(/during/)
    expect(result).toMatch(/after/)
  })

  it('rejects when only "before" photo exists', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      detail: COMPLETE_ALTA_DETAIL,
      photoTypes: ['before'],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Fehlende Fotos/i)
    expect(result).toMatch(/during/)
    expect(result).toMatch(/after/)
    expect(result).not.toMatch(/before/)
  })

  it('returns null when detail is complete and all 3 photo types exist', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      detail: COMPLETE_ALTA_DETAIL,
      photoTypes: ALL_PHOTOS,
    })
    expect(await validateTransitionPrerequisites('id-1', 'internally_certified')).toBeNull()
  })

  it('rejects work_type that has no required-fields entry (e.g. pop)', async () => {
    setupSupabaseFor({
      order: { work_type: 'pop', client_id: 'client-1' },
      detail: { foo: 'bar' },
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/nicht unterstützt/i)
  })
})

describe('validateTransitionPrerequisites — invoiced', () => {
  it('rejects direct order without internal certification audit', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: null },
      audits: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'invoiced')
    expect(result).toMatch(/Direktauftrag/i)
    expect(result).toMatch(/interne Zertifizierung/i)
  })

  it('rejects with-client order without client certification audit', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      audits: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'invoiced')
    expect(result).toMatch(/Kundenakzeptanz/i)
  })

  it('returns null for direct order with internal certification audit', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: null },
      audits: [{ cert_type: 'internal' }],
    })
    expect(await validateTransitionPrerequisites('id-1', 'invoiced')).toBeNull()
  })

  it('returns null for with-client order with client certification audit', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      audits: [{ cert_type: 'client' }],
    })
    expect(await validateTransitionPrerequisites('id-1', 'invoiced')).toBeNull()
  })
})

// ── getCollaboratorType (Migration 006 — collaborator pricing) ─────────────

import { getCollaboratorType } from '@/services/workOrderService'

describe('getCollaboratorType', () => {
  it('returns external for contractor role', () => {
    expect(getCollaboratorType('contractor')).toBe('external')
  })

  it('returns internal for technician role', () => {
    expect(getCollaboratorType('technician')).toBe('internal')
  })

  it('returns internal for admin role', () => {
    expect(getCollaboratorType('admin')).toBe('internal')
  })

  it('returns internal when role is null (safer default)', () => {
    expect(getCollaboratorType(null)).toBe('internal')
  })

  it('returns internal when role is undefined', () => {
    expect(getCollaboratorType(undefined)).toBe('internal')
  })
})
