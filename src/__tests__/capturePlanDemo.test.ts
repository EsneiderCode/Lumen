import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same shape as the other *Demo tests: route the service through the in-memory
// demo client so it exercises the seeded fixtures end to end — which is also
// what proves the demo store covers the phase-2 tables (CLAUDE.md: a feature
// touching Supabase must be demoable without credentials).
vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

const { supabase } = await import('@/lib/supabase')
import { resetStore } from '@/lib/demo/store'
import {
  clearCapturePlanCache,
  fetchCapturePlan,
  fetchCapturePlanForOrder,
  fetchCapturePlanVariants,
  fetchCaptureReport,
  saveCaptureReport,
} from '@/services/capturePlanService'
import { DEFAULT_CAPTURE_PLANS } from '@/constants/capture-plans'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import { evaluateCapturePlan } from '@/services/capturePlanEngine'
import { validateTransitionPrerequisites } from '@/services/workOrderService'

const TECH_ID = '00000000-0000-0000-0000-000000000002'

beforeEach(() => {
  resetStore()
  clearCapturePlanCache()
})

describe('capture plans in demo mode', () => {
  it('serves every seeded plan from the store', async () => {
    for (const [key, expected] of Object.entries(DEFAULT_CAPTURE_PLANS)) {
      const plan = await fetchCapturePlan(key)
      expect(plan, key).toEqual(expected)
    }
  })

  it('resolves the plan of an order from its work type', async () => {
    const plan = await fetchCapturePlanForOrder({ work_type: 'soplado' })
    expect(plan?.key).toBe('soplado')
  })

  it('serves the Soplado de RA variant too', async () => {
    const { data: rows } = await supabase.from('capture_plans').select('*')
    expect(rows?.some((row) => (row as { key: string }).key === 'soplado')).toBe(true)

    expect(await fetchCapturePlan('soplado_ra')).toEqual(SOPLADO_RA_PLAN)
  })

  it('resolves the plan of the demo order that carries a capture_plan_key', async () => {
    const { data: orders } = await supabase
      .from('work_orders')
      .select('*')
      .eq('capture_plan_key', 'soplado_ra')
    expect(orders?.length).toBeGreaterThan(0)

    const order = orders![0] as { work_type: string; capture_plan_key?: string | null }
    expect(order.work_type).toBe('soplado')
    expect((await fetchCapturePlanForOrder(order))?.key).toBe('soplado_ra')
  })

  it('offers each variant to the admin form of its own work type only', async () => {
    expect((await fetchCapturePlanVariants('soplado')).map((plan) => plan.key)).toEqual([
      'soplado_ra',
    ])
    expect((await fetchCapturePlanVariants('alta')).map((plan) => plan.key)).toEqual([
      'insyte_bohrung_aktivierung',
    ])
    expect(await fetchCapturePlanVariants('pop')).toEqual([])
  })

  it('reports a key nobody seeded and nobody compiled in', async () => {
    expect(await fetchCapturePlan('nothing_seeded_this')).toBeNull()
  })

  it('caches a plan instead of asking again', async () => {
    const first = await fetchCapturePlan('alta')
    const second = await fetchCapturePlan('alta')
    expect(second).toBe(first)
  })
})

describe('capture reports in demo mode', () => {
  // The freshly created order: since phase 7 every order that has ever been
  // captured carries a report, so an untouched one is what "empty" looks like.
  const workOrderId = '50000000-0000-0000-0000-000000000001'

  it('starts empty, then stores and updates the answers', async () => {
    expect((await fetchCaptureReport(workOrderId)).data).toBeNull()

    const plan = DEFAULT_CAPTURE_PLANS.soplado
    const { error } = await saveCaptureReport({
      workOrderId,
      plan,
      answers: { details: { meters: 120, section: 'A1-B3' } },
      userId: TECH_ID,
    })
    expect(error).toBeNull()

    const stored = (await fetchCaptureReport(workOrderId)).data
    expect(stored).toMatchObject({
      work_order_id: workOrderId,
      plan_key: 'soplado',
      plan_version: plan.version,
      answers: { details: { meters: 120, section: 'A1-B3' } },
    })
    expect(stored?.submitted_at ?? null).toBeNull()

    const { error: updateError } = await saveCaptureReport({
      workOrderId,
      plan,
      answers: { details: { meters: 140, section: 'A1-B3', tube_diameter: '7/3.5', result: 'OK' } },
      userId: TECH_ID,
      submitted: true,
    })
    expect(updateError).toBeNull()

    const { data: rows } = await supabase
      .from('work_order_capture_reports')
      .select('*')
      .eq('work_order_id', workOrderId)
    expect(rows).toHaveLength(1)

    const resubmitted = (await fetchCaptureReport(workOrderId)).data
    expect((resubmitted?.answers.details as Record<string, unknown>).meters).toBe(140)
    expect(resubmitted?.submitted_at).toBeTruthy()
  })

  it('evaluates a seeded order against its plan using the stamped photos', async () => {
    // The order that actually carries photos, not the untouched one above.
    const { data: photos } = await supabase
      .from('work_order_photos')
      .select('*')
      .eq('work_order_id', '50000000-0000-0000-0000-000000000003')

    const plan = await fetchCapturePlanForOrder({ work_type: 'soplado' })
    const evaluation = evaluateCapturePlan(plan!, photos ?? [], {
      details: { meters: 120, section: 'A1-B3', tube_diameter: '7/3.5', result: 'OK' },
    })

    expect(evaluation.missingPhotoCount).toBe(0)
    expect(evaluation.canSubmit).toBe(true)
  })
})

// Phase 5: the certification gate is SQL, which demo mode cannot run. What it
// can run is the client-side twin, and that is what an admin actually hits
// before the RPC — so a demo without credentials still shows the real rule.
describe('the certification gate in demo mode', () => {
  /** The seeded alta order sitting in rueckmeldung_sent — the one an admin certifies. */
  const workOrderId = '50000000-0000-0000-0000-000000000003'
  const completeAlta = {
    details: { access_type: 'Keller', equipment_installed: 'NT-1234', client_signature: true },
  }

  // Migration 055 moved every wo_detail_* row into a report, and the demo
  // fixtures mirror that. So the seeded alta order arrives already judged by its
  // plan, with the data the technician reported.
  it('judges the seeded order by its plan, which its answers satisfy', async () => {
    expect((await fetchCaptureReport(workOrderId)).data).toMatchObject({
      plan_key: 'alta',
      answers: { details: { access_type: 'Tiefbau', client_signature: true } },
    })
    expect(await validateTransitionPrerequisites(workOrderId, 'internally_certified')).toBeNull()
  })

  // Since migration 056 there is no laxer set of rules to fall into: an order
  // nobody ever captured is simply not certifiable.
  it('refuses an order with no capture report at all', async () => {
    const untouched = '50000000-0000-0000-0000-000000000001'
    expect((await fetchCaptureReport(untouched)).data).toBeNull()
    expect(await validateTransitionPrerequisites(untouched, 'internally_certified')).toMatch(
      /Rückmeldung fehlt/i,
    )
  })

  it('accepts the order once its plan is satisfied', async () => {
    await saveCaptureReport({
      workOrderId,
      plan: DEFAULT_CAPTURE_PLANS.alta,
      answers: completeAlta,
      userId: TECH_ID,
      submitted: true,
    })

    expect(await validateTransitionPrerequisites(workOrderId, 'internally_certified')).toBeNull()
  })

  it('names what the plan is still missing', async () => {
    await saveCaptureReport({
      workOrderId,
      plan: DEFAULT_CAPTURE_PLANS.alta,
      answers: { details: { access_type: 'Keller' } },
      userId: TECH_ID,
      submitted: true,
    })

    const result = await validateTransitionPrerequisites(workOrderId, 'internally_certified')
    expect(result).toContain('Rückmeldung unvollständig (alta)')
    expect(result).toContain('Angabe details.equipment_installed')
    expect(result).toContain('Angabe details.client_signature')
  })

  // The report is pinned to the plan it was captured under, but the order's own
  // capture_plan_key is what the gate resolves: moving an order to another plan
  // re-judges it under the new one.
  it('follows the plan key the order carries, not the one it was captured under', async () => {
    await saveCaptureReport({
      workOrderId,
      plan: SOPLADO_RA_PLAN,
      answers: completeAlta,
      userId: TECH_ID,
      submitted: true,
    })

    expect(await validateTransitionPrerequisites(workOrderId, 'internally_certified')).toBeNull()
  })
})
