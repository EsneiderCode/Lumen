import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  workTypeToDetailTable,
  generateDataHash,
  normalizeReportedServiceItems,
  buildBillingDraftsFromReportedItems,
} from '@/services/workOrderService'
import { clearCapturePlanCache } from '@/services/capturePlanService'
import { DEFAULT_CAPTURE_PLANS } from '@/constants/capture-plans'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CapturePlan } from '@/types/capture-plan'
import type { WorkType } from '@/types/enums'

// ── workTypeToDetailTable ───────────────────────────────────────────────────

describe('workTypeToDetailTable', () => {
  const cases: [WorkType, string][] = [
    ['soplado', 'wo_detail_soplado'],
    ['fusion_ap', 'wo_detail_fusion_ap'],
    ['fusion_dp', 'wo_detail_fusion_dp'],
    ['alta', 'wo_detail_alta'],
    ['nt_installation', 'wo_detail_nt'],
    ['patchkabel', 'wo_detail_patchkabel'],
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
    expect(
      normalizeReportedServiceItems([
        { service_item_id: ' item-1 ', qty: '2', notes: ' Router ' },
        { service_item_id: '', qty: 3 },
        { service_item_id: 'item-2', qty: 0 },
        { service_item_id: 'item-3', qty: Number.NaN },
        null,
      ]),
    ).toEqual([{ service_item_id: 'item-1', qty: 2, notes: 'Router' }])
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
          category: null,
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
          category: null,
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
      'from',
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'order',
      'range',
      'not',
      'or',
      'gte',
      'lte',
      'is',
      'maybeSingle',
      'single',
      'limit',
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

// ── The route a Rückmeldung has to walk ─────────────────────────────────────

import { rueckmeldungSendPath, statusPath } from '@/services/workOrderStateMachine'

describe('statusPath', () => {
  it('is empty between a status and itself', () => {
    expect(statusPath('executed', 'executed')).toEqual([])
  })

  it('finds the shortest legal route, target included', () => {
    expect(statusPath('in_progress', 'rueckmeldung_sent')).toEqual([
      'executed',
      'rueckmeldung_pending',
      'rueckmeldung_sent',
    ])
    expect(statusPath('executed', 'rueckmeldung_sent')).toEqual([
      'rueckmeldung_pending',
      'rueckmeldung_sent',
    ])
  })

  it('reports the absence of a route rather than inventing one', () => {
    expect(statusPath('cancelled', 'rueckmeldung_sent')).toBeNull()
    expect(statusPath('paid', 'invoiced')).toBeNull()
  })
})

describe('rueckmeldungSendPath', () => {
  // The screen is reachable by link, and a queued submission drains hours after
  // it was written — neither can assume the order is where it was.
  it('climbs the whole ladder from wherever the order is', () => {
    expect(rueckmeldungSendPath('in_progress')).toEqual([
      'executed',
      'rueckmeldung_pending',
      'rueckmeldung_sent',
    ])
    expect(rueckmeldungSendPath('executed')).toEqual(['rueckmeldung_pending', 'rueckmeldung_sent'])
    expect(rueckmeldungSendPath('returned')).toEqual(['rueckmeldung_pending', 'rueckmeldung_sent'])
    expect(rueckmeldungSendPath('rueckmeldung_pending')).toEqual(['rueckmeldung_sent'])
  })

  it('has nothing to do for an order already sent, so a second drain is harmless', () => {
    expect(rueckmeldungSendPath('rueckmeldung_sent')).toEqual([])
  })

  // An assignment carries a team and a technician and has its own RPC; walking
  // past it here would leave a half-assigned order behind.
  it('never conjures an assignment on the way', () => {
    expect(rueckmeldungSendPath('created')).toBeNull()
  })

  it('refuses orders that are done, dead, or past this point', () => {
    expect(rueckmeldungSendPath('cancelled')).toBeNull()
    expect(rueckmeldungSendPath('internally_certified')).toBeNull()
    expect(rueckmeldungSendPath('paid')).toBeNull()
  })
})

// ── validateTransitionPrerequisites (Migration 004 — business rules) ───────

import { validateTransitionPrerequisites } from '@/services/workOrderService'

interface PrereqScenario {
  order?: {
    work_type: string
    client_id: string | null
    capture_plan_key?: string | null
  } | null
  detail?: Record<string, unknown> | null
  photoTypes?: string[]
  /** Slot-stamped photos, for orders captured under a plan. */
  photos?: Array<Record<string, unknown>>
  audits?: Array<{ cert_type: string }>
  /** Absent = the order predates the capture plans and falls back to the legacy rules. */
  report?: {
    plan_key: string
    plan_version: number
    answers: Record<string, unknown>
  } | null
  /** Plans reachable in the catalog; absent keys resolve to the compiled defaults. */
  plans?: CapturePlan[]
}

function setupSupabaseFor(scenarios: PrereqScenario) {
  // fetchCapturePlan keeps an in-process cache; without this a plan from an
  // earlier scenario would answer for the next one.
  clearCapturePlanCache()
  mockSupabase.from = vi.fn((table: string) => {
    if (table === 'work_order_capture_reports') {
      const rows = scenarios.report ? [scenarios.report] : []
      return {
        select: () => ({
          eq: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }),
        }),
      }
    }
    if (table === 'capture_plans') {
      const rows = (scenarios.plans ?? []).map((plan) => ({
        definition: plan,
        version: plan.version,
      }))
      // Both lookups the service makes: pinned (key + version) and current
      // (key + is_active, newest first). The stub ignores the filters and hands
      // back the scenario's plans — a scenario never declares two of them.
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: rows, error: null }),
              order: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }),
            }),
          }),
        }),
      }
    }
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
      const photos =
        scenarios.photos ?? (scenarios.photoTypes ?? []).map((t) => ({ photo_type: t }))
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
    setupSupabaseFor({}) // would fail any DB query
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

  // Every order that was ever captured has a report (migration 055 backfilled
  // the ones that predate the plans), so no report means nobody reported.
  it('rejects when the order has no capture report', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      report: null,
      photoTypes: ALL_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung fehlt/i)
  })
})

// ── The capture-plan gate (mirror of migration 056) ─────────────────────────

/** Photos stamped with their slot, the shape uploadCapturePhoto writes. */
const slotPhoto = (sectionKey: string, slotKey: string, itemId: string | null = null) => ({
  id: `${sectionKey}-${slotKey}-${itemId ?? 'top'}`,
  photo_type: 'during',
  section_key: sectionKey,
  slot_key: slotKey,
  item_id: itemId,
})

const SOPLADO_RA_PHOTOS = [
  slotPhoto('mandatory', 'fiber_dp'),
  slotPhoto('mandatory', 'fiber_dp_gasblock'),
  slotPhoto('mandatory', 'fiber_pop_label'),
  slotPhoto('mandatory', 'balloon_pop'),
]

const SOPLADO_RA_ANSWERS = {
  details: { meters: 120, section: 'POP-DP12', tube_diameter: '7/4', result: 'OK' },
  checklist: { duct_as_planned: true },
}

describe('validateTransitionPrerequisites — capture plan gate', () => {
  it('accepts a Soplado de RA order that satisfies its plan', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: { plan_key: 'soplado_ra', plan_version: SOPLADO_RA_PLAN.version, answers: SOPLADO_RA_ANSWERS },
      photos: SOPLADO_RA_PHOTOS,
    })
    expect(await validateTransitionPrerequisites('id-1', 'internally_certified')).toBeNull()
  })

  it('names the mandatory photo the plan is still missing', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: { plan_key: 'soplado_ra', plan_version: SOPLADO_RA_PLAN.version, answers: SOPLADO_RA_ANSWERS },
      photos: SOPLADO_RA_PHOTOS.slice(0, 3),
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Rückmeldung unvollständig \(soplado_ra\)/)
    expect(result).toContain('Fotos mandatory.balloon_pop (1)')
  })

  it('names the field a conditional checklist answer just made mandatory', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: {
        plan_key: 'soplado_ra',
        plan_version: SOPLADO_RA_PLAN.version,
        answers: { ...SOPLADO_RA_ANSWERS, checklist: { duct_as_planned: false } },
      },
      photos: SOPLADO_RA_PHOTOS,
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toContain('Angabe checklist.trunk_used')
    expect(result).toContain('Angabe checklist.duct_used')
    expect(result).toContain('Angabe checklist.change_reason')
  })

  it('numbers the trench whose photos are missing', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: {
        plan_key: 'soplado_ra',
        plan_version: SOPLADO_RA_PLAN.version,
        answers: {
          ...SOPLADO_RA_ANSWERS,
          catas: [{ id: 'c1', values: { left_open: false, depth_cm: 60 } }],
        },
      },
      photos: [...SOPLADO_RA_PHOTOS, slotPhoto('catas', 'before_open', 'c1')],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toContain('Fotos catas[1].during_open (1)')
    expect(result).toContain('Fotos catas[1].closed (1)')
    expect(result).not.toContain('catas[1].before_open')
  })

  it('caps the list so the admin gets a sentence, not a wall', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: { plan_key: 'soplado_ra', plan_version: SOPLADO_RA_PLAN.version, answers: {} },
      photos: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/… \(\+\d+\)$/)
    expect((result ?? '').split('; ')).toHaveLength(7)
  })

  it('still counts photos uploaded before the plans existed', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      plans: [DEFAULT_CAPTURE_PLANS.alta],
      report: {
        plan_key: 'alta',
        plan_version: DEFAULT_CAPTURE_PLANS.alta.version,
        answers: { details: COMPLETE_ALTA_DETAIL },
      },
      photos: ALL_PHOTOS.map((type) => ({ id: type, photo_type: type })),
    })
    expect(await validateTransitionPrerequisites('id-1', 'internally_certified')).toBeNull()
  })

  it('refuses to guess when the plan the order points at does not exist', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'ghost_plan' },
      plans: [],
      report: { plan_key: 'ghost_plan', plan_version: 1, answers: {} },
      photos: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/Erfassungsplan "ghost_plan" nicht gefunden/)
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

import {
  acceptWorkOrderClient,
  assignWorkOrder,
  certifyWorkOrderInternal,
  getCollaboratorType,
  invoiceWorkOrder,
} from '@/services/workOrderService'

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

function setupSupabaseForAssignment(args: {
  profileRole: 'admin' | 'technician' | 'contractor'
  rpcResult?: { data: unknown; error: { message: string } | null }
}) {
  mockSupabase.rpc = vi.fn().mockResolvedValue(
    args.rpcResult ?? {
      data: { id: 'wo-1', status: 'assigned' },
      error: null,
    },
  )
  mockSupabase.from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { role: args.profileRole }, error: null }),
          }),
        }),
      }
    }
    return {
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: 'wo-1', status: 'assigned' }, error: null }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
    }
  })
}

describe('single-order lifecycle RPC adapters', () => {
  it('accepts client work orders through the atomic client acceptance RPC', async () => {
    mockSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ data: { id: 'wo-1', status: 'client_accepted' }, error: null })

    const result = await acceptWorkOrderClient({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: 'hash-1',
      notes: 'Client accepted',
    })

    expect(result.ok).toBe(true)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_work_order_client', {
      p_work_order_id: 'wo-1',
      p_changed_by: 'admin-1',
      p_data_hash: 'hash-1',
      p_notes: 'Client accepted',
    })
  })

  it('maps missing client audit RPC errors to structured reasons', async () => {
    mockSupabase.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'client invoice requires client_accepted status and client audit' },
    })

    const result = await invoiceWorkOrder({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      billingReference: 'INV-1',
      notes: 'Invoice',
    })

    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual([expect.objectContaining({ code: 'missing_client_audit' })])
  })

  it('certifies internally through the atomic internal certification RPC', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      report: { plan_key: 'alta', plan_version: 1, answers: { details: COMPLETE_ALTA_DETAIL } },
      photoTypes: ALL_PHOTOS,
    })
    mockSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ data: { id: 'wo-1', status: 'internally_certified' }, error: null })

    const result = await certifyWorkOrderInternal({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: 'hash-2',
      notes: 'Internal cert',
    })

    expect(result.ok).toBe(true)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('certify_work_order_internal', {
      p_work_order_id: 'wo-1',
      p_changed_by: 'admin-1',
      p_data_hash: 'hash-2',
      p_notes: 'Internal cert',
    })
  })

  it('rejects incomplete Rückmeldung before calling the internal certification RPC', async () => {
    setupSupabaseFor({
      order: { work_type: 'alta', client_id: 'client-1' },
      report: null,
      photoTypes: ALL_PHOTOS,
    })
    mockSupabase.rpc = vi.fn()

    const result = await certifyWorkOrderInternal({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: 'hash-2',
      notes: 'Internal cert',
    })

    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual([expect.objectContaining({ code: 'incomplete_rueckmeldung' })])
    expect(mockSupabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects empty lifecycle audit hashes before calling RPCs', async () => {
    mockSupabase.rpc = vi.fn()

    const internal = await certifyWorkOrderInternal({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: '   ',
    })
    const client = await acceptWorkOrderClient({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: '',
    })

    expect(internal.ok).toBe(false)
    expect(client.ok).toBe(false)
    expect(internal.reasons).toEqual([expect.objectContaining({ code: 'invalid_transition' })])
    expect(client.reasons).toEqual([expect.objectContaining({ code: 'invalid_transition' })])
    expect(mockSupabase.rpc).not.toHaveBeenCalled()
  })
})

describe('assignWorkOrder — team-based assignment', () => {
  it('assigns a work order to a team and clears the individual technician', async () => {
    setupSupabaseForAssignment({ profileRole: 'technician' })

    const result = await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual({ id: 'wo-1', status: 'assigned' })
  })


  it('writes null assigned_technician when no person is selected', async () => {
    const updateSpy = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'wo-1', status: 'assigned' }, error: null }),
        }),
      }),
    }))
    mockSupabase.from = vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: table === 'work_orders' ? updateSpy : vi.fn(),
      insert: () => Promise.resolve({ data: null, error: null }),
    }))

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1')

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_technician: null }),
    )
  })

  it('writes the selected technician id when a person is selected', async () => {
    const updateSpy = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'wo-1', status: 'assigned' }, error: null }),
        }),
      }),
    }))
    mockSupabase.from = vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: table === 'work_orders' ? updateSpy : vi.fn(),
      insert: () => Promise.resolve({ data: null, error: null }),
    }))

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_technician: 'tech-1' }),
    )
  })

  it('assigns directly to a technician with no team (assigned_team null)', async () => {
    const updateSpy = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'wo-1', status: 'assigned' }, error: null }),
        }),
      }),
    }))
    mockSupabase.from = vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: table === 'work_orders' ? updateSpy : vi.fn(),
      insert: () => Promise.resolve({ data: null, error: null }),
    }))

    const result = await assignWorkOrder('wo-1', null, '2026-05-15', 'admin-1', 'tech-1')

    expect(result.error).toBeNull()
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_team: null, assigned_technician: 'tech-1' }),
    )
  })

  it('returns an error when Supabase update fails', async () => {
    mockSupabase.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    }))

    const result = await assignWorkOrder('wo-1', 'gruen', '2026-05-15', 'admin-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('DB error')
  })
})
