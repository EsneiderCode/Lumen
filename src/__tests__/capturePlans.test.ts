/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAPTURE_PLAN_VERSIONS,
  DEFAULT_CAPTURE_PLANS,
  capturePlanKeyForOrder,
  compiledVariantsForWorkType,
  defaultCapturePlanFor,
} from '@/constants/capture-plans'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import { DETAIL_FIELDS } from '@/constants/detail-fields'
import {
  captureExamplePaths,
  describeMissingNodes,
  evaluateCapturePlan,
} from '@/services/capturePlanEngine'
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
const migration054 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '054_capture_plan_gate.sql'),
  'utf8',
)
const migration059 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '059_soplado_details_v2.sql'),
  'utf8',
)
const migration071 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '071_capture_plan_soplado_ra_v3.sql'),
  'utf8',
)

const migration076 = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '076_capture_plan_soplado_ra_v4.sql'),
  'utf8',
)

/** Every `('key', version, $plan$…$plan$)` row of a seed migration. */
const seededPlans = (sql: string): Map<string, unknown> => {
  const rowPattern = /\('([a-z_]+)',\s*(\d+),\s*\$plan\$([\s\S]*?)\$plan\$::jsonb\)/g
  const seeded = new Map<string, unknown>()
  for (const match of sql.matchAll(rowPattern)) {
    seeded.set(`${match[1]}@${match[2]}`, JSON.parse(match[3]))
  }
  return seeded
}

/**
 * The whole catalog as the migrations build it, newest seed last. A plan is
 * versioned, never edited in place, so older rows stay here untouched — what
 * has to match the compiled copy is the version the constants currently carry.
 */
const CATALOG = new Map<string, unknown>([
  ...seededPlans(migration052),
  ...seededPlans(migration053),
  ...seededPlans(migration059),
  ...seededPlans(migration071),
  ...seededPlans(migration076),
])

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
      expect(plan.version).toBe(CAPTURE_PLAN_VERSIONS[key as WorkType])
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

  // Regression guard on what the certification gate demands. Since 056 the plan
  // is the only gate, so loosening this set silently lets an order through that
  // the office could not certify before.
  it('marks exactly the fields the gate demands', () => {
    const requiredOf = (workType: WorkType) => {
      const details = DEFAULT_CAPTURE_PLANS[workType].sections.find((s) => s.key === 'details')
      const fields = details && 'fields' in details ? details.fields : []
      return fields.filter((field) => field.required).map((field) => field.key)
    }

    // `section` was dropped in v2 (migration 059): the stretch is already on the
    // order, so the technician was retyping it.
    expect(requiredOf('soplado')).toEqual(['result', 'meters', 'tube_diameter'])
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

describe('the migrations seed exactly the compiled plans', () => {
  // The seeds are generated from src/constants/capture-plans.ts. If this fails,
  // some SQL was hand-edited (or the constants changed without a migration) and
  // the DB copy the certification gate reads no longer matches what the app
  // evaluates.

  it('seeds one v1 plan per work type in 052', () => {
    expect([...seededPlans(migration052).keys()].sort()).toEqual(
      Object.values(WorkType)
        .map((workType) => `${workType}@1`)
        .sort(),
    )
  })

  it('seeds a definition identical to the compiled default of every work type', () => {
    for (const workType of Object.values(WorkType)) {
      const plan = DEFAULT_CAPTURE_PLANS[workType]
      expect(plan.version, workType).toBe(CAPTURE_PLAN_VERSIONS[workType])
      expect(CATALOG.get(`${workType}@${plan.version}`), workType).toEqual(
        JSON.parse(JSON.stringify(plan)),
      )
    }
  })

  it('never rewrites a published version in place', () => {
    // A revision publishes a new row; the old one has to survive, or a
    // Rückmeldung captured under it stops being reproducible.
    for (const workType of Object.values(WorkType)) {
      for (let version = 1; version <= CAPTURE_PLAN_VERSIONS[workType]; version += 1) {
        expect(CATALOG.has(`${workType}@${version}`), `${workType}@${version}`).toBe(true)
      }
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

  // Since v4 the four mandatory photos are split by WHERE they are taken, and
  // all four are `after` — every one of them records a finished state. They
  // used to be spread across the three legacy buckets to satisfy the old
  // assert_work_order_rueckmeldung_complete, which is why a DP with the fibre
  // already inside was filed under "before"; the gate reads the plan now.
  it('splits the mandatory photos by place and calls them all finished states', () => {
    const dp = slotsOf(SOPLADO_RA_PLAN, 'dp')
    const pop = slotsOf(SOPLADO_RA_PLAN, 'pop')

    expect(dp.map((slot) => slot.key)).toEqual(['fiber_dp', 'fiber_dp_gasblock'])
    expect(pop.map((slot) => slot.key)).toEqual(['fiber_pop_label', 'balloon_pop'])
    expect([...dp, ...pop].every((slot) => slot.min === 1)).toBe(true)
    expect([...dp, ...pop].every((slot) => slot.legacyType === 'after')).toBe(true)
  })

  // A renamed section orphans the photos already stored under the old name, so
  // the migration has to move them. Without this the technician of an order in
  // flight watches work he already uploaded disappear.
  it('backfills the photos of the orders in flight into the new sections', () => {
    expect(migration076).toMatch(/update\s+public\.work_order_photos/i)
    expect(migration076).toContain("WHEN 'fiber_dp'          THEN 'dp'")
    expect(migration076).toContain("WHEN 'balloon_pop'       THEN 'pop'")
    expect(migration076).toContain("p.section_key = 'mandatory'")
    // Both statements or neither: a seeded plan whose photos never moved is the
    // exact hole this migration exists to avoid.
    expect(migration076.toLowerCase()).toContain('begin;')
    expect(migration076.toLowerCase()).toContain('commit;')
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

  it('keeps writing wo_detail_soplado, with the fields the gate demands', () => {
    const details = sectionOf(SOPLADO_RA_PLAN, 'details')
    const fields = 'fields' in details ? details.fields : []

    expect(details.kind === 'fields' && details.legacyTable).toBe('wo_detail_soplado')
    expect(details).toEqual(
      DEFAULT_CAPTURE_PLANS.soplado.sections.find((section) => section.key === 'details'),
    )
    expect(fields.filter((field) => field.required).map((field) => field.key)).toEqual([
      'result',
      'meters',
      'tube_diameter',
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
  // Since v4 the mandatory four live in two sections, by place.
  const mandatoryPhotos = (): CapturedPhotoRef[] =>
    (['dp', 'pop'] as const).flatMap((sectionKey) =>
      slotsOf(SOPLADO_RA_PLAN, sectionKey).map((slot, index) => ({
        id: `${sectionKey}${index}`,
        section_key: sectionKey,
        slot_key: slot.key,
        photo_type: slot.legacyType,
      })),
    )

  const baseAnswers = (): CaptureAnswers => ({
    checklist: { duct_as_planned: true },
    details: { meters: 120, section: 'DP-12 → POP-2', tube_diameter: '7/3.5', result: 'OK' },
  })

  /** A trench with everything v3 demands of it except its photos. */
  const trenchData = () => ({
    location: { lat: 51.77685, lng: 9.38042, accuracy_m: null },
    left_open: false,
    depth_cm: 60,
    pin_confirmed: '2026-07-30T09:00:00.000Z',
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
    // Since v3 the position IS demanded, and so is the vouch for its pin: the
    // technician copies the coordinates off the watermark of one of these very
    // photos, which no gallery can strip, and then confirms the pin on the map.
    expect(result.missing.filter((node) => node.kind === 'field').map((node) => node.fieldKey)).toEqual([
      'location',
      'left_open',
      'depth_cm',
      'pin_confirmed',
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
      catas: [{ id: 'c1', values: { ...trenchData(), left_open: true } }],
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
      catas: [{ id: 'c1', values: { ...trenchData(), left_open: false } }],
    })
    expect(
      closed.sections
        .find((section) => section.key === 'catas')
        ?.slots.find((slot) => slot.slotKey === 'safety_signage')?.visible,
    ).toBe(false)
  })

  // These exact strings were compared against capture_plan_missing_nodes() run
  // on Postgres 15 with the plan JSON of migration 053: client and gate must
  // tell the admin the same thing, down to the numbering of the trench.
  it('describes what is missing in the same words as the SQL gate', () => {
    const answers: CaptureAnswers = {
      ...baseAnswers(),
      catas: [{ id: 'c1', values: trenchData() }],
    }
    const result = evaluateCapturePlan(
      SOPLADO_RA_PLAN,
      [
        ...mandatoryPhotos().slice(0, 3),
        { id: 'c1-0', section_key: 'catas', slot_key: 'before_open', item_id: 'c1' },
      ],
      answers,
    )

    expect(describeMissingNodes(result)).toEqual([
      'Fotos pop.balloon_pop (1)',
      'Fotos catas[1].during_open (1)',
      'Fotos catas[1].closed (1)',
    ])
  })

  it('numbers repeater items from one, as the technician sees them', () => {
    const answers: CaptureAnswers = {
      ...baseAnswers(),
      catas: [
        { id: 'c1', values: trenchData() },
        { id: 'c2', values: { ...trenchData(), depth_cm: undefined } },
      ],
    }
    const trenchPhotos = (itemId: string): CapturedPhotoRef[] =>
      ['before_open', 'during_open', 'closed'].map((slotKey) => ({
        id: `${itemId}-${slotKey}`,
        section_key: 'catas',
        slot_key: slotKey,
        item_id: itemId,
      }))

    const result = evaluateCapturePlan(
      SOPLADO_RA_PLAN,
      [...mandatoryPhotos(), ...trenchPhotos('c1'), ...trenchPhotos('c2')],
      answers,
    )

    expect(describeMissingNodes(result)).toEqual(['Angabe catas[2].depth_cm'])
  })
})

describe('migration 071 — the trench states where it was, and vouches for its pin', () => {
  const catas = sectionOf(SOPLADO_RA_PLAN, 'catas')
  const fields = 'fields' in catas ? catas.fields : []

  it('asks for the coordinates before the photos and demands them', () => {
    const location = fields.find((field) => field.key === 'location')

    expect(location?.type).toBe('geopoint')
    expect(location?.required).toBe(true)
    expect(location?.lead).toBe(true)
  })

  it('closes the trench with the vouch for its pin', () => {
    const confirmed = fields.find((field) => field.key === 'pin_confirmed')

    expect(confirmed?.type).toBe('geoconfirm')
    expect(confirmed?.required).toBe(true)
    expect(confirmed?.lead).toBeUndefined()
    // Last of the section: there is nothing to vouch for until the point is in.
    expect(fields[fields.length - 1]?.key).toBe('pin_confirmed')
  })

  it('teaches the SQL gate the new field type', () => {
    // Without this branch capture_field_filled() falls through to `false` and a
    // confirmed trench would count as incomplete for ever.
    expect(migration071).toContain("ELSIF v_type = 'geoconfirm' THEN")
    expect(migration071.toLowerCase()).toContain(
      'create or replace function public.capture_field_filled',
    )
  })

  it('publishes a new version and leaves the old ones alone', () => {
    expect([...seededPlans(migration071).keys()]).toEqual(['soplado_ra@3'])
    expect(CATALOG.has('soplado_ra@1')).toBe(true)
    expect(CATALOG.has('soplado_ra@2')).toBe(true)
    expect(migration071.toLowerCase()).toContain('on conflict (key, version) do update')
    expect(migration071.toLowerCase()).toMatch(/--\s*depends on:[\s\S]*054_capture_plan_gate\.sql/)
  })
})

describe('migration 053 seeds exactly the Soplado de RA plan', () => {
  it('seeds the plan and nothing else', () => {
    expect([...seededPlans(migration053).keys()]).toEqual(['soplado_ra@1'])
  })

  it('seeds a definition identical to the compiled plan', () => {
    expect(CATALOG.get(`soplado_ra@${SOPLADO_RA_PLAN.version}`)).toEqual(
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

// The gate cannot be executed from vitest — there is no Postgres here. What the
// suite can guarantee is that it still IS the plan gate: that it reads the plan,
// that the pre-plan rules survive only as the fallback, and that its evaluation
// primitives are the ones the engine documents.
describe('migration 054 makes the certification gate read the plan', () => {
  const sql = migration054.toLowerCase()
  const gateStart = sql.indexOf(
    'create or replace function public.assert_work_order_rueckmeldung_complete(',
  )
  const gate = sql.slice(gateStart)

  it('declares every migration it builds on', () => {
    for (const dependency of [
      '016_mvp_business_logic_hardening.sql',
      '052_capture_plans.sql',
      '053_capture_plan_soplado_ra.sql',
    ]) {
      expect(sql).toMatch(new RegExp(`--[\\s\\S]*depends on:[\\s\\S]*${dependency.replace('.', '\\.')}`))
    }
  })

  it('replaces the gate and keeps the 016 rules as an explicit fallback', () => {
    expect(gateStart).toBeGreaterThan(-1)
    expect(sql).toContain(
      'create or replace function public.assert_work_order_rueckmeldung_complete_legacy(',
    )
    expect(gate).toContain('assert_work_order_rueckmeldung_complete_legacy(p_work_order_id)')
  })

  it('resolves the plan through the helpers 052 added', () => {
    expect(gate).toContain('public.work_order_capture_plan_key(p_work_order_id)')
    expect(gate).toContain('public.current_capture_plan(v_plan_key)')
    expect(gate).toContain('public.capture_plan_missing_nodes(')
  })

  it('no longer demands the three photo buckets outside the fallback', () => {
    expect(gate).not.toContain("array['before', 'during', 'after']")
    // …which is exactly where the old rule now lives, and nowhere else.
    expect(sql.match(/array\['before', 'during', 'after'\]/g)).toHaveLength(1)
  })

  it('evaluates the pinned plan version, not whatever is current', () => {
    expect(gate).toMatch(/where key = v_report\.plan_key and version = v_report\.plan_version/)
  })

  it('treats an unknown plan key as an error, never as a pass', () => {
    expect(gate).toMatch(/erfassungsplan[\s\S]*raise exception|raise exception[\s\S]*erfassungsplan/)
    expect(sql).toContain("using errcode = 'check_violation'")
  })

  it('ports the engine’s field rules, including the ones easy to get wrong', () => {
    const filled = sql.slice(sql.indexOf('create or replace function public.capture_field_filled'))
    // number: > 0 unless the field declares its own min (0 is a real answer there)
    expect(filled).toContain('return v_num >= v_min')
    expect(filled).toContain('return v_num > 0')
    // checkbox must be checked, yesno only has to be answered
    expect(filled).toContain("return p_value = 'true'::jsonb")
    expect(filled).toContain("return jsonb_typeof(p_value) = 'boolean'")
    // geopoint needs both coordinates
    expect(filled).toMatch(/jsonb_typeof\(p_value->'lat'\) = 'number'/)
    expect(filled).toMatch(/jsonb_typeof\(p_value->'lng'\) = 'number'/)
  })

  it('keeps counting photos that predate the plans', () => {
    const missing = sql.slice(sql.indexOf('create or replace function public.capture_plan_missing_nodes'))
    expect(missing).toContain('v_legacy_target')
    expect(missing).toContain('section_key is null or slot_key is null')
  })

  it('reports the same node paths the client does', () => {
    const missing = sql.slice(sql.indexOf('create or replace function public.capture_plan_missing_nodes'))
    expect(missing).toContain("'fotos %s.%s (%s)'")
    expect(missing).toContain("'angabe %s.%s'")
    expect(missing).toContain("'einträge %s (%s)'")
  })
})
