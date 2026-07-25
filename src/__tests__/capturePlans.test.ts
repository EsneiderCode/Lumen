/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAPTURE_PLAN_VERSION,
  DEFAULT_CAPTURE_PLANS,
  capturePlanKeyForOrder,
  compiledVariantsForWorkType,
  defaultCapturePlanFor,
} from '@/constants/capture-plans'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import { DETAIL_FIELDS } from '@/constants/detail-fields'
import { captureExamplePaths, evaluateCapturePlan } from '@/services/capturePlanEngine'
import type {
  CaptureAnswers,
  CapturePhotoSlot,
  CapturePlan,
  CaptureSection,
  CapturedPhotoRef,
} from '@/types/capture-plan'
import { WorkType } from '@/types/enums'

const migration052 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '052_capture_plans.sql'),
  'utf8',
)
const migration053 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '053_capture_plan_soplado_ra.sql'),
  'utf8',
)

const sectionOf = (plan: CapturePlan, key: string): CaptureSection => {
  const section = plan.sections.find((candidate) => candidate.key === key)
  if (!section) throw new Error(`plan ${plan.key} has no section ${key}`)
  return section
}

const slotsOf = (plan: CapturePlan, sectionKey: string): CapturePhotoSlot[] => {
  const section = sectionOf(plan, sectionKey)
  return 'slots' in section ? section.slots : []
}

const legacyPhotos = (): CapturedPhotoRef[] => [
  { id: 'p1', section_key: 'photos', slot_key: 'before', photo_type: 'before' },
  { id: 'p2', section_key: 'photos', slot_key: 'during', photo_type: 'during' },
  { id: 'p3', section_key: 'photos', slot_key: 'after', photo_type: 'after' },
]

/** A value that satisfies each field type, so only the required-set matters. */
const filledDetails = (workType: WorkType): CaptureAnswers => {
  const values: Record<string, string | number | boolean> = {}
  for (const field of DETAIL_FIELDS[workType]) {
    values[field.key] =
      field.type === 'number' ? 1 : field.type === 'checkbox' ? true : (field.options?.[0] ?? 'x')
  }
  return { details: values }
}

describe('default capture plans', () => {
  it('covers every work type', () => {
    expect(Object.keys(DEFAULT_CAPTURE_PLANS).sort()).toEqual(Object.values(WorkType).sort())
    for (const [key, plan] of Object.entries(DEFAULT_CAPTURE_PLANS)) {
      expect(plan.key).toBe(key)
      expect(plan.version).toBe(CAPTURE_PLAN_VERSION)
    }
  })

  it('reproduces the three legacy photo buckets', () => {
    for (const plan of Object.values(DEFAULT_CAPTURE_PLANS)) {
      const photos = plan.sections.find((section) => section.key === 'photos')
      expect(photos?.kind).toBe('photos')
      expect(photos && 'slots' in photos ? photos.slots : []).toMatchObject([
        { key: 'before', min: 1, legacyType: 'before' },
        { key: 'during', min: 1, legacyType: 'during' },
        { key: 'after', min: 1, legacyType: 'after' },
      ])
    }
  })

  it('carries every detail field, mapped to its legacy column', () => {
    for (const workType of Object.values(WorkType)) {
      const details = DEFAULT_CAPTURE_PLANS[workType].sections.find(
        (section) => section.key === 'details',
      )
      const fields = details && 'fields' in details ? details.fields : []

      expect(fields.map((field) => field.key)).toEqual(DETAIL_FIELDS[workType].map((f) => f.key))
      expect(fields.every((field) => field.legacyColumn === field.key)).toBe(true)
    }
  })

  // Regression guard on the union of the two gates enforced today: the SQL one
  // in 016 and REQUIRED_DETAIL_FIELDS in workOrderService.ts. Loosening this
  // set would let an order through the plan that the current gates reject.
  it('marks exactly the fields both current gates demand', () => {
    const requiredOf = (workType: WorkType) => {
      const details = DEFAULT_CAPTURE_PLANS[workType].sections.find((s) => s.key === 'details')
      const fields = details && 'fields' in details ? details.fields : []
      return fields.filter((field) => field.required).map((field) => field.key)
    }

    expect(requiredOf('soplado')).toEqual(['meters', 'section', 'tube_diameter', 'result'])
    expect(requiredOf('fusion_ap')).toEqual([
      'cabinet_code',
      'splice_count',
      'fiber_type',
      'has_measurement_cert',
    ])
    expect(requiredOf('fusion_dp')).toEqual(requiredOf('fusion_ap'))
    expect(requiredOf('alta')).toEqual(['access_type', 'equipment_installed', 'client_signature'])
    expect(requiredOf('nt_installation')).toEqual(['nt_type', 'serial_number', 'location'])
    expect(requiredOf('patchkabel')).toEqual([
      'connected_section',
      'cable_length',
      'connector_type',
      'test_result',
    ])
    expect(requiredOf('pop')).toEqual([])
  })

  it('lets 0 through on the counters where 0 is a real answer', () => {
    const fusion = DEFAULT_CAPTURE_PLANS.fusion_ap.sections.find((s) => s.key === 'details')
    const fields = fusion && 'fields' in fusion ? fusion.fields : []

    expect(fields.find((field) => field.key === 'card_count')?.min).toBe(0)
    expect(fields.find((field) => field.key === 'splice_count')?.min).toBeUndefined()
  })

  it('resolves the plan key from the order, falling back to the work type', () => {
    expect(capturePlanKeyForOrder({ work_type: 'soplado' })).toBe('soplado')
    expect(capturePlanKeyForOrder({ work_type: 'soplado', capture_plan_key: null })).toBe('soplado')
    expect(capturePlanKeyForOrder({ work_type: 'soplado', capture_plan_key: '  ' })).toBe('soplado')
    expect(capturePlanKeyForOrder({ work_type: 'soplado', capture_plan_key: 'soplado_ra' })).toBe(
      'soplado_ra',
    )
    expect(defaultCapturePlanFor('soplado_ra')).toBe(SOPLADO_RA_PLAN)
    expect(defaultCapturePlanFor('nothing_seeded_this')).toBeNull()
  })
})

describe('default plans match today’s completeness rules', () => {
  it('accepts an order with the three photos and every required field', () => {
    for (const workType of Object.values(WorkType)) {
      const result = evaluateCapturePlan(
        DEFAULT_CAPTURE_PLANS[workType],
        legacyPhotos(),
        filledDetails(workType),
      )
      expect(result.canSubmit, workType).toBe(true)
    }
  })

  it('rejects a missing photo bucket', () => {
    const result = evaluateCapturePlan(
      DEFAULT_CAPTURE_PLANS.soplado,
      legacyPhotos().slice(0, 2),
      filledDetails('soplado'),
    )

    expect(result.canSubmit).toBe(false)
    expect(result.missing).toEqual([
      { nodeId: 'photos:after', kind: 'photos', sectionKey: 'photos', itemId: null, slotKey: 'after', count: 1 },
    ])
  })

  it('rejects an unfilled required detail field', () => {
    const answers = filledDetails('alta')
    const values = answers.details as Record<string, unknown>
    values.client_signature = false

    const result = evaluateCapturePlan(DEFAULT_CAPTURE_PLANS.alta, legacyPhotos(), answers)

    expect(result.canSubmit).toBe(false)
    expect(result.missing[0].fieldKey).toBe('client_signature')
  })

  it('keeps accepting photos uploaded before the plans existed', () => {
    const untagged: CapturedPhotoRef[] = [
      { id: 'p1', photo_type: 'before' },
      { id: 'p2', photo_type: 'during' },
      { id: 'p3', photo_type: 'after' },
    ]
    const result = evaluateCapturePlan(
      DEFAULT_CAPTURE_PLANS.soplado,
      untagged,
      filledDetails('soplado'),
    )

    expect(result.canSubmit).toBe(true)
  })
})

describe('migration 052 seeds exactly the default plans', () => {
  // The seed is generated from src/constants/capture-plans.ts. If this fails,
  // the SQL was hand-edited (or the constants changed) and the DB copy the
  // certification gate will read no longer matches what the app evaluates.
  const seeded = new Map<string, unknown>()
  const rowPattern = /\('([a-z_]+)',\s*(\d+),\s*\$plan\$([\s\S]*?)\$plan\$::jsonb\)/g
  for (const match of migration052.matchAll(rowPattern)) {
    seeded.set(`${match[1]}@${match[2]}`, JSON.parse(match[3]))
  }

  it('seeds one plan per work type', () => {
    expect([...seeded.keys()].sort()).toEqual(
      Object.values(WorkType)
        .map((workType) => `${workType}@${CAPTURE_PLAN_VERSION}`)
        .sort(),
    )
  })

  it('seeds definitions identical to the compiled defaults', () => {
    for (const workType of Object.values(WorkType)) {
      expect(seeded.get(`${workType}@${CAPTURE_PLAN_VERSION}`), workType).toEqual(
        JSON.parse(JSON.stringify(DEFAULT_CAPTURE_PLANS[workType])),
      )
    }
  })
})

describe('the Soplado de RA plan', () => {
  it('is a variant of soplado, offered only on soplado orders', () => {
    expect(SOPLADO_RA_PLAN.key).toBe('soplado_ra')
    expect(SOPLADO_RA_PLAN.workType).toBe('soplado')
    expect(compiledVariantsForWorkType('soplado')).toEqual([SOPLADO_RA_PLAN])
    expect(compiledVariantsForWorkType('alta')).toEqual([])
  })

  // The plan's own completeness is not the only gate: assert_work_order_
  // rueckmeldung_complete (016) still demands one photo of each legacy bucket
  // until phase 5, and the trenches that would supply them are optional. If the
  // mandatory photos stop covering all three, a technician can send a
  // Rückmeldung the plan calls complete that the admin cannot certify.
  it('covers all three legacy photo buckets with the mandatory photos alone', () => {
    const mandatory = slotsOf(SOPLADO_RA_PLAN, 'mandatory')

    expect(mandatory.map((slot) => slot.key)).toEqual([
      'fiber_dp',
      'fiber_dp_gasblock',
      'fiber_pop_label',
      'balloon_pop',
    ])
    expect(mandatory.every((slot) => slot.min === 1)).toBe(true)
    expect(new Set(mandatory.map((slot) => slot.legacyType))).toEqual(
      new Set(['before', 'during', 'after']),
    )
  })

  it('never blocks submission on trenches or incidents', () => {
    const catas = sectionOf(SOPLADO_RA_PLAN, 'catas')
    expect(catas.kind === 'repeater' && catas.min).toBe(0)

    const incidents = sectionOf(SOPLADO_RA_PLAN, 'incidents')
    expect(slotsOf(SOPLADO_RA_PLAN, 'incidents').every((slot) => slot.min === 0)).toBe(true)
    expect(
      'fields' in incidents ? incidents.fields.every((field) => !field.required) : false,
    ).toBe(true)
  })

  it('reveals the safety signage without demanding it', () => {
    const signage = slotsOf(SOPLADO_RA_PLAN, 'catas').find((slot) => slot.key === 'safety_signage')

    expect(signage?.min).toBe(0)
    expect(signage?.condition).toEqual({ path: 'item.left_open', equals: true })
  })

  it('keeps writing wo_detail_soplado, with the fields both gates demand', () => {
    const details = sectionOf(SOPLADO_RA_PLAN, 'details')
    const fields = 'fields' in details ? details.fields : []

    expect(details.kind === 'fields' && details.legacyTable).toBe('wo_detail_soplado')
    expect(details).toEqual(
      DEFAULT_CAPTURE_PLANS.soplado.sections.find((section) => section.key === 'details'),
    )
    expect(fields.filter((field) => field.required).map((field) => field.key)).toEqual([
      'meters',
      'section',
      'tube_diameter',
      'result',
    ])
  })

  it('points every example thumbnail at the plan folder of the bucket', () => {
    const paths = captureExamplePaths(SOPLADO_RA_PLAN)

    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((path) => path.startsWith('soplado_ra/'))).toBe(true)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('evaluating the Soplado de RA plan', () => {
  const mandatoryPhotos = (): CapturedPhotoRef[] =>
    slotsOf(SOPLADO_RA_PLAN, 'mandatory').map((slot, index) => ({
      id: `m${index}`,
      section_key: 'mandatory',
      slot_key: slot.key,
      photo_type: slot.legacyType,
    }))

  const baseAnswers = (): CaptureAnswers => ({
    checklist: { duct_as_planned: true },
    details: { meters: 120, section: 'DP-12 → POP-2', tube_diameter: '7/3.5', result: 'OK' },
  })

  it('accepts a job with no trench at all', () => {
    const result = evaluateCapturePlan(SOPLADO_RA_PLAN, mandatoryPhotos(), baseAnswers())
    expect(result.canSubmit).toBe(true)
  })

  it('demands the four mandatory photos', () => {
    const result = evaluateCapturePlan(
      SOPLADO_RA_PLAN,
      mandatoryPhotos().slice(0, 2),
      baseAnswers(),
    )

    expect(result.canSubmit).toBe(false)
    expect(result.missing.map((node) => node.slotKey)).toEqual(['fiber_pop_label', 'balloon_pop'])
  })

  it('demands trunk, duct and reason as soon as the planned duct was not used', () => {
    const answers = { ...baseAnswers(), checklist: { duct_as_planned: false } }
    const result = evaluateCapturePlan(SOPLADO_RA_PLAN, mandatoryPhotos(), answers)

    expect(result.canSubmit).toBe(false)
    expect(result.missing.map((node) => node.fieldKey)).toEqual([
      'trunk_used',
      'duct_used',
      'change_reason',
    ])
  })

  it('demands the three photos and the data of a trench once one is opened', () => {
    const answers: CaptureAnswers = { ...baseAnswers(), catas: [{ id: 'c1', values: {} }] }
    const result = evaluateCapturePlan(SOPLADO_RA_PLAN, mandatoryPhotos(), answers)

    expect(result.canSubmit).toBe(false)
    expect(result.missing.filter((node) => node.kind === 'photos').map((node) => node.slotKey)).toEqual([
      'before_open',
      'during_open',
      'closed',
    ])
    // The position is not demanded: a denied geolocation must not strand the
    // technician with a Rückmeldung they cannot send.
    expect(result.missing.filter((node) => node.kind === 'field').map((node) => node.fieldKey)).toEqual([
      'left_open',
      'depth_cm',
    ])
  })

  it('accepts a complete trench and only then shows the signage slot', () => {
    const trenchPhotos = (itemId: string): CapturedPhotoRef[] =>
      ['before_open', 'during_open', 'closed'].map((slotKey, index) => ({
        id: `${itemId}-${index}`,
        section_key: 'catas',
        slot_key: slotKey,
        item_id: itemId,
        photo_type: 'during',
      }))

    const answers: CaptureAnswers = {
      ...baseAnswers(),
      catas: [{ id: 'c1', values: { left_open: true, depth_cm: 60 } }],
    }
    const result = evaluateCapturePlan(
      SOPLADO_RA_PLAN,
      [...mandatoryPhotos(), ...trenchPhotos('c1')],
      answers,
    )

    expect(result.canSubmit).toBe(true)
    const signage = result.sections
      .find((section) => section.key === 'catas')
      ?.slots.find((slot) => slot.slotKey === 'safety_signage')
    expect(signage?.visible).toBe(true)
    expect(signage?.missing).toBe(0)

    const closed = evaluateCapturePlan(SOPLADO_RA_PLAN, [...mandatoryPhotos(), ...trenchPhotos('c1')], {
      ...answers,
      catas: [{ id: 'c1', values: { left_open: false, depth_cm: 60 } }],
    })
    expect(
      closed.sections
        .find((section) => section.key === 'catas')
        ?.slots.find((slot) => slot.slotKey === 'safety_signage')?.visible,
    ).toBe(false)
  })
})

describe('migration 053 seeds exactly the Soplado de RA plan', () => {
  const rowPattern = /\('([a-z_]+)',\s*(\d+),\s*\$plan\$([\s\S]*?)\$plan\$::jsonb\)/g
  const seeded = new Map<string, unknown>()
  for (const match of migration053.matchAll(rowPattern)) {
    seeded.set(`${match[1]}@${match[2]}`, JSON.parse(match[3]))
  }

  it('seeds the plan and nothing else', () => {
    expect([...seeded.keys()]).toEqual([`soplado_ra@${SOPLADO_RA_PLAN.version}`])
  })

  it('seeds a definition identical to the compiled plan', () => {
    expect(seeded.get(`soplado_ra@${SOPLADO_RA_PLAN.version}`)).toEqual(
      JSON.parse(JSON.stringify(SOPLADO_RA_PLAN)),
    )
  })

  it('declares its dependency on 052 and creates the example bucket', () => {
    const sql = migration053.toLowerCase()

    expect(sql).toMatch(/--\s*depends on:.*052_capture_plans\.sql/)
    expect(sql).toContain("insert into storage.buckets (id, name, public)")
    expect(sql).toContain("values ('capture-examples', 'capture-examples', false)")
    expect(sql).toContain("has_permission('settings.manage_capture_plans')")
    // A new plan is a new version row, never an edit of an existing one.
    expect(sql).toContain('on conflict (key, version) do update')
  })
})

describe('migration 052 structure', () => {
  const sql = migration052.toLowerCase()

  it('declares its dependencies', () => {
    expect(sql).toMatch(/--\s*depends on:/)
  })

  it('creates the plan catalog and the capture reports', () => {
    expect(sql).toContain('create table if not exists public.capture_plans')
    expect(sql).toContain('create table if not exists public.work_order_capture_reports')
    expect(sql).toMatch(/primary key\s*\(key, version\)/)
  })

  it('adds the plan override to work orders', () => {
    expect(sql).toMatch(
      /alter table public\.work_orders[\s\S]*add column if not exists capture_plan_key/,
    )
  })

  it('stamps photos with their slot and where they were taken', () => {
    const photoAlter = sql.slice(sql.indexOf('alter table public.work_order_photos'))
    for (const column of ['section_key', 'slot_key', 'item_id', 'taken_at', 'lat', 'lng', 'accuracy_m']) {
      expect(photoAlter).toContain(`add column if not exists ${column}`)
    }
  })

  it('keeps photo_type untouched so the legacy gate and the PDF keep working', () => {
    expect(sql).not.toContain('drop column')
    expect(sql).not.toMatch(/alter column photo_type/)
  })

  it('protects the plan catalog with RLS', () => {
    expect(sql).toContain('alter table public.capture_plans enable row level security')
    expect(sql).toContain('alter table public.work_order_capture_reports enable row level security')
    expect(sql).toContain("has_permission('settings.manage_capture_plans')")
  })
})
