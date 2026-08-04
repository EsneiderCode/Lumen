import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

import { supabase } from '@/lib/supabase'
import { resetStore } from '@/lib/demo/store'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import { clearCapturePlanCache } from '@/services/capturePlanService'
import { bulkWorkOrderAction, certifyWorkOrderInternal } from '@/services/workOrderService'

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const TECH_ID = '00000000-0000-0000-0000-000000000002'
const CLIENT_ID = '10000000-0000-0000-0000-000000000001'
const PROJECT_ID = '20000000-0000-0000-0000-000000000001'
const OPERATOR_ID = '30000000-0000-0000-0000-000000000001'

function requiredSopladoRaPhotos(workOrderId: string) {
  return SOPLADO_RA_PLAN.sections.flatMap((section) =>
    section.kind === 'photos'
      ? section.slots
          .filter((slot) => slot.min > 0)
          .map((slot, index) => ({
            work_order_id: workOrderId,
            storage_path: `${workOrderId}/${section.key}/${slot.key}.jpg`,
            photo_type: slot.legacyType ?? 'after',
            section_key: section.key,
            slot_key: slot.key,
            item_id: null,
            uploaded_by: TECH_ID,
            caption: `Evidence ${index + 1}`,
          }))
      : [],
  )
}

async function sopladoServiceItemId(): Promise<string> {
  const { data, error } = await supabase
    .from('service_items')
    .select('id')
    .eq('code', 'SOP-M')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'SOP-M test catalog item missing')
  return data.id
}

async function seedCertifiableSoplado(args: {
  id: string
  meters: unknown
  serviceItemId?: string | null
}) {
  const serviceItemId =
    args.serviceItemId === undefined ? await sopladoServiceItemId() : args.serviceItemId

  const { error: orderError } = await supabase.from('work_orders').insert({
    id: args.id,
    order_number: `LUM-TEST-${args.id.slice(-4)}`,
    client_id: CLIENT_ID,
    project_id: PROJECT_ID,
    operator_id: OPERATOR_ID,
    line: 'NE3',
    work_type: 'soplado',
    capture_plan_key: 'soplado_ra',
    status: 'rueckmeldung_sent',
    priority: 'normal',
    assigned_team: 'rot',
    assigned_technician: TECH_ID,
    assigned_date: '2026-08-04',
    service_item_id: serviceItemId,
    created_by: ADMIN_ID,
  } as never)
  if (orderError) throw new Error(orderError.message)

  const { error: reportError } = await supabase.from('work_order_capture_reports').insert({
    work_order_id: args.id,
    plan_key: SOPLADO_RA_PLAN.key,
    plan_version: SOPLADO_RA_PLAN.version,
    answers: {
      details: {
        result: 'Abgeschlossen',
        meters: args.meters,
        tube_diameter: '7/3.5',
      },
      checklist: { duct_as_planned: true },
    },
    reported_service_items: [],
    submitted_at: '2026-08-04T10:00:00.000Z',
    updated_by: TECH_ID,
  } as never)
  if (reportError) throw new Error(reportError.message)

  const { error: photosError } = await supabase
    .from('work_order_photos')
    .insert(requiredSopladoRaPhotos(args.id) as never)
  if (photosError) throw new Error(photosError.message)
}

async function billingLines(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_billing_lines')
    .select('*')
    .eq('work_order_id', workOrderId)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function workOrderStatus(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', workOrderId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Test work order missing')
  return data.status
}

beforeEach(() => {
  resetStore()
  clearCapturePlanCache()
})

describe('billing materialization before internal certification', () => {
  it('certifies soplado and snapshots one line using reported meters and catalog prices', async () => {
    const id = '90000000-0000-0000-0000-000000000101'
    await seedCertifiableSoplado({ id, meters: 1220 })

    const result = await certifyWorkOrderInternal({
      workOrderId: id,
      changedBy: ADMIN_ID,
      dataHash: 'soplado-certification-hash',
      notes: 'Test certification',
    })

    expect(result.ok).toBe(true)
    expect(await workOrderStatus(id)).toBe('internally_certified')
    expect(await billingLines(id)).toEqual([
      expect.objectContaining({
        work_order_id: id,
        qty: 1220,
        unit_price_snapshot: 1.85,
        unit_price_external_snapshot: 1.2,
      }),
    ])
  })

  it('does not duplicate or reprice an existing snapshot when certification is retried', async () => {
    const id = '90000000-0000-0000-0000-000000000102'
    await seedCertifiableSoplado({ id, meters: 25 })

    const first = await certifyWorkOrderInternal({
      workOrderId: id,
      changedBy: ADMIN_ID,
      dataHash: 'first-hash',
    })
    expect(first.ok).toBe(true)

    await supabase
      .from('service_items')
      .update({ unit_price: 999 } as never)
      .eq('id', await sopladoServiceItemId())

    await certifyWorkOrderInternal({
      workOrderId: id,
      changedBy: ADMIN_ID,
      dataHash: 'retry-hash',
    })

    expect(await billingLines(id)).toEqual([
      expect.objectContaining({ qty: 25, unit_price_snapshot: 1.85 }),
    ])
  })

  it.each([
    {
      label: 'missing service item',
      id: '90000000-0000-0000-0000-000000000103',
      meters: 10,
      serviceItemId: null,
      message: /Service-Posten/i,
    },
    {
      label: 'zero meters',
      id: '90000000-0000-0000-0000-000000000104',
      meters: 0,
      serviceItemId: undefined,
      message: /Meter|Abrechnungsmenge/i,
    },
  ])('refuses $label without leaving the order certified', async (scenario) => {
    await seedCertifiableSoplado(scenario)

    const result = await certifyWorkOrderInternal({
      workOrderId: scenario.id,
      changedBy: ADMIN_ID,
      dataHash: 'invalid-billing-hash',
    })

    expect(result.ok).toBe(false)
    expect(result.reasons.map((reason) => reason.message).join(' ')).toMatch(scenario.message)
    expect(await workOrderStatus(scenario.id)).toBe('rueckmeldung_sent')
    expect(await billingLines(scenario.id)).toHaveLength(0)
  })

  it('materializes billing lines for the bulk internal-certification path', async () => {
    const id = '90000000-0000-0000-0000-000000000105'
    await seedCertifiableSoplado({ id, meters: 1460 })

    const result = await bulkWorkOrderAction({
      action: 'internal_certify',
      workOrders: [{ id, orderNumber: 'LUM-BULK-1' }],
      changedBy: ADMIN_ID,
      dataHash: 'bulk-certification-hash',
      notes: 'Bulk test',
    })

    expect(result).toMatchObject({ total: 1, succeeded: 1, failed: 0 })
    expect(await billingLines(id)).toEqual([
      expect.objectContaining({ qty: 1460, unit_price_snapshot: 1.85 }),
    ])
  })
})
