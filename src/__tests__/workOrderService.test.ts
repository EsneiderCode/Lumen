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
          is_pass_through: false,
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
          is_pass_through: false,
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
  slotPhoto('dp', 'fiber_dp'),
  slotPhoto('dp', 'fiber_dp_gasblock'),
  slotPhoto('pop', 'fiber_pop_label'),
  slotPhoto('pop', 'balloon_pop'),
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
    expect(result).toContain('Rückmeldung unvollständig')
    expect(result).toContain('Pflichtfotos (1)')
    expect(result).toContain('• Ballon im POP')
    expect(result).not.toContain('pop.balloon_pop')
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
    expect(result).toContain('• Verwendeter Strang')
    expect(result).toContain('• Verwendetes Rohr')
    expect(result).toContain('• Grund der Abweichung')
    expect(result).not.toContain('checklist.trunk_used')
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
    expect(result).toContain('• Grube 1 — Grube offen')
    expect(result).toContain('• Grube 1 — Wiederhergestellt')
    expect(result).not.toContain('Grube 1 — Vor dem Öffnen')
  })

  it('caps the list so the admin gets a sentence, not a wall', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: { plan_key: 'soplado_ra', plan_version: SOPLADO_RA_PLAN.version, answers: {} },
      photos: [],
    })
    const result = await validateTransitionPrerequisites('id-1', 'internally_certified')
    expect(result).toMatch(/… und \d+ weitere Anforderungen$/)
    expect((result ?? '').split('\n').filter((line) => line.startsWith('• '))).toHaveLength(6)
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
  parseAssignedTeamRoster,
  ASSIGNMENT_REQUIRES_TECHNICIAN,
} from '@/services/workOrderService'
import de from '@/i18n/locales/de.json'
import es from '@/i18n/locales/es.json'

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

  it('recomputes a readable message when the database completeness gate rejects the RPC', async () => {
    setupSupabaseFor({
      order: { work_type: 'soplado', client_id: 'client-1', capture_plan_key: 'soplado_ra' },
      plans: [SOPLADO_RA_PLAN],
      report: {
        plan_key: 'soplado_ra',
        plan_version: SOPLADO_RA_PLAN.version,
        answers: SOPLADO_RA_ANSWERS,
      },
      photos: SOPLADO_RA_PHOTOS,
    })
    const baseFrom = mockSupabase.from as unknown as (table: string) => unknown
    let photoRead = 0
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'work_order_photos') {
        const currentPhotos = photoRead++ === 0 ? SOPLADO_RA_PHOTOS : []
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: currentPhotos, error: null }),
          }),
        }
      }
      return baseFrom(table)
    })
    mockSupabase.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'Rückmeldung unvollständig (soplado_ra): Fotos mandatory.fiber_dp (1)',
      },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await certifyWorkOrderInternal({
      workOrderId: 'wo-1',
      changedBy: 'admin-1',
      dataHash: 'hash-2',
    })

    expect(result.ok).toBe(false)
    expect(result.reasons[0]?.message).toContain('Pflichtfotos (4)')
    expect(result.reasons[0]?.message).toContain('Faser im DP')
    expect(result.reasons[0]?.message).not.toContain('mandatory.fiber_dp')
    expect(consoleError).toHaveBeenCalledWith(
      'Internal certification rejected by database completeness gate',
      expect.objectContaining({ rawMessage: expect.stringContaining('mandatory.fiber_dp') }),
    )
    consoleError.mockRestore()
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

/**
 * Assignment stub. `crew` is what a `profiles` query filtered by team returns —
 * the people the roster is built from; `updateSpy` captures the row written to
 * `work_orders`.
 */
function setupSupabaseForRosterAssignment(args: {
  crew?: Array<{ id: string; full_name: string | null; role: string | null }>
  responsible?: { id: string; full_name: string | null; role: string | null } | null
  /** Failure of the crew lookup — not the same thing as an empty team. */
  crewError?: { message: string }
  /** Failure of the fallback lookup for a responsible person outside the crew. */
  responsibleError?: { message: string }
}) {
  const updateSpy = vi.fn((_payload: Record<string, unknown>) => ({
    eq: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'wo-1', status: 'assigned' }, error: null }),
      }),
    }),
  }))

  mockSupabase.from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          // Crew lookup: .eq('team').eq('is_active').in('role').order('full_name')
          eq: () => ({
            eq: () => ({
              in: () => ({
                order: () =>
                  Promise.resolve({
                    data: args.crewError ? null : args.crew ?? [],
                    error: args.crewError ?? null,
                  }),
              }),
            }),
            // Fallback lookup for the responsible person: .eq('id').single()
            single: () =>
              Promise.resolve({
                data: args.responsibleError ? null : args.responsible ?? null,
                error: args.responsibleError ?? null,
              }),
          }),
        }),
      }
    }
    return {
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { status: 'created' }, error: null }) }),
      }),
      update: table === 'work_orders' ? updateSpy : vi.fn(),
      insert: () => Promise.resolve({ data: null, error: null }),
    }
  })

  return updateSpy
}

// The owner's rule, at the only place the app writes an assignment: exactly one
// responsible person per order, and the rest of the crew merely documented.
describe('assignWorkOrder — one responsible technician, the crew documented', () => {
  it('refuses a team-only assignment instead of leaving the order ownerless', async () => {
    setupSupabaseForAssignment({ profileRole: 'technician' })

    const result = await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1')

    expect(result.data).toBeNull()
    expect(result.reasons).toEqual([expect.objectContaining({ code: 'invalid_transition' })])
  })

  // The service carries no i18next — no service in this repo does — so its own
  // rule violations come back as a code the screen translates. A literal English
  // sentence here would be rendered verbatim to a German-speaking admin.
  it('reports the missing technician as a translatable code, not English prose', async () => {
    setupSupabaseForAssignment({ profileRole: 'technician' })

    const result = await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1')

    expect(result.error).toBe(ASSIGNMENT_REQUIRES_TECHNICIAN)
    expect(result.error).not.toMatch(/\s/)
    expect(de.assignment).toHaveProperty('technicianRequiredError')
    expect(es.assignment).toHaveProperty('technicianRequiredError')
  })

  it('never reaches the database when no technician was chosen', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({})

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', null)

    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('writes the selected technician id when a person is selected', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crew: [{ id: 'tech-1', full_name: 'Ana', role: 'technician' }],
    })

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_technician: 'tech-1' }),
    )
  })

  it('snapshots the whole active crew and marks the single responsible member', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crew: [
        { id: 'tech-1', full_name: 'Ana', role: 'technician' },
        { id: 'tech-2', full_name: 'Bruno', role: 'technician' },
      ],
    })

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    const payload = updateSpy.mock.calls[0][0]
    expect(payload.assigned_team_roster).toEqual([
      { profile_id: 'tech-1', full_name: 'Ana', role: 'technician', is_responsible: true },
      { profile_id: 'tech-2', full_name: 'Bruno', role: 'technician', is_responsible: false },
    ])
    // Migration 068 still reads assigned_team, so it keeps being written.
    expect(payload.assigned_team).toBe('rot')
  })

  // Prices are never visible to technicians or contractors; the roster is shown
  // to them, so it must not carry a single monetary field.
  it('keeps money out of the documented roster', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crew: [{ id: 'tech-1', full_name: 'Ana', role: 'technician' }],
    })

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    const roster = updateSpy.mock.calls[0][0].assigned_team_roster as Array<
      Record<string, unknown>
    >
    for (const entry of roster) {
      expect(Object.keys(entry).sort()).toEqual([
        'full_name',
        'is_responsible',
        'profile_id',
        'role',
      ])
    }
  })

  // A crew list that omits the person actually holding the order would document
  // a lie — it happens when the assignee was moved out of the team.
  it('documents the responsible person even when they are not on the crew list', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crew: [{ id: 'tech-2', full_name: 'Bruno', role: 'technician' }],
      responsible: { id: 'tech-1', full_name: 'Ana', role: 'contractor' },
    })

    await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    expect(
      updateSpy.mock.calls[0][0].assigned_team_roster,
    ).toEqual([
      { profile_id: 'tech-1', full_name: 'Ana', role: 'contractor', is_responsible: true },
      { profile_id: 'tech-2', full_name: 'Bruno', role: 'technician', is_responsible: false },
    ])
  })

  // A failed crew query and an empty team are indistinguishable if you only
  // destructure `data`. Writing [] there stamps "this order had no crew" on the
  // order and still reports success.
  it('abandons the assignment rather than documenting a crew it could not read', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crewError: { message: 'profiles unreachable' },
    })

    const result = await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('profiles unreachable')
    expect(result.reasons).toEqual([expect.objectContaining({ code: 'server_error' })])
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('also fails when the responsible person cannot be looked up', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({
      crew: [{ id: 'tech-2', full_name: 'Bruno', role: 'technician' }],
      responsibleError: { message: 'profile lookup failed' },
    })

    const result = await assignWorkOrder('wo-1', 'rot', '2026-05-15', 'admin-1', 'tech-1')

    expect(result.error).toBe('profile lookup failed')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('assigns directly to a technician with no team and documents nobody else', async () => {
    const updateSpy = setupSupabaseForRosterAssignment({})

    const result = await assignWorkOrder('wo-1', null, '2026-05-15', 'admin-1', 'tech-1')

    expect(result.error).toBeNull()
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assigned_team: null,
        assigned_technician: 'tech-1',
        assigned_team_roster: null,
      }),
    )
  })

  it('returns an error when Supabase update fails', async () => {
    mockSupabase.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { status: 'created' }, error: null }),
          eq: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
    }))

    const result = await assignWorkOrder('wo-1', 'gruen', '2026-05-15', 'admin-1', 'tech-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('DB error')
  })
})

// A stored roster is read back on screens a technician can see; a half-parsed
// entry there would render as a blank row next to a real crew member.
describe('parseAssignedTeamRoster', () => {
  it('returns nothing for anything that is not a roster array', () => {
    expect(parseAssignedTeamRoster(null)).toEqual([])
    expect(parseAssignedTeamRoster(undefined)).toEqual([])
    expect(parseAssignedTeamRoster('rot')).toEqual([])
    expect(parseAssignedTeamRoster({ profile_id: 'tech-1' })).toEqual([])
  })

  it('drops entries with no profile id and normalizes the rest', () => {
    expect(
      parseAssignedTeamRoster([
        { profile_id: 'tech-1', full_name: 'Ana', role: 'technician', is_responsible: true },
        { full_name: 'Ghost' },
        { profile_id: '' },
        null,
        { profile_id: 'tech-2' },
      ]),
    ).toEqual([
      { profile_id: 'tech-1', full_name: 'Ana', role: 'technician', is_responsible: true },
      { profile_id: 'tech-2', full_name: '', role: '', is_responsible: false },
    ])
  })

  // `is_responsible` decides who the UI calls the owner of the order — only a
  // literal true may do that.
  it('treats a truthy non-boolean as not responsible', () => {
    expect(
      parseAssignedTeamRoster([{ profile_id: 'tech-1', is_responsible: 'yes' }])[0].is_responsible,
    ).toBe(false)
  })
})
