import { describe, expect, it } from 'vitest'
import {
  conditionMet,
  evaluateCapturePlan,
  fieldNodeId,
  isFieldFilled,
  repeaterItems,
  slotNodeId,
} from '@/services/capturePlanEngine'
import type {
  CaptureAnswers,
  CaptureField,
  CapturePhotoSlot,
  CapturePlan,
  CaptureSection,
  CapturedPhotoRef,
} from '@/types/capture-plan'

let photoCounter = 0
const photo = (overrides: Partial<CapturedPhotoRef> = {}): CapturedPhotoRef => ({
  id: `photo-${++photoCounter}`,
  section_key: null,
  slot_key: null,
  item_id: null,
  photo_type: null,
  ...overrides,
})

const slot = (overrides: Partial<CapturePhotoSlot> & { key: string }): CapturePhotoSlot => ({
  min: 1,
  labelKey: `photo.${overrides.key}`,
  legacyType: 'during',
  ...overrides,
})

const plan = (sections: CaptureSection[], key = 'test'): CapturePlan => ({
  key,
  version: 1,
  sections,
})

const photosSection = (slots: CapturePhotoSlot[], key = 'photos'): CaptureSection => ({
  key,
  kind: 'photos',
  titleKey: 'x',
  slots,
})

const fieldsSection = (fields: CaptureField[], key = 'details'): CaptureSection => ({
  key,
  kind: 'fields',
  titleKey: 'x',
  fields,
})

describe('isFieldFilled', () => {
  const field = (overrides: Partial<CaptureField> & { type: CaptureField['type'] }): CaptureField => ({
    key: 'f',
    labelKey: 'l',
    ...overrides,
  })

  it('treats blank strings as empty', () => {
    expect(isFieldFilled(field({ type: 'text' }), 'A1-B3')).toBe(true)
    expect(isFieldFilled(field({ type: 'text' }), '   ')).toBe(false)
    expect(isFieldFilled(field({ type: 'select' }), '')).toBe(false)
  })

  it('demands a positive number unless the field declares its own min', () => {
    expect(isFieldFilled(field({ type: 'number' }), 120)).toBe(true)
    expect(isFieldFilled(field({ type: 'number' }), 0)).toBe(false)
    expect(isFieldFilled(field({ type: 'number', min: 0 }), 0)).toBe(true)
    expect(isFieldFilled(field({ type: 'number', min: 0 }), -1)).toBe(false)
    expect(isFieldFilled(field({ type: 'number' }), Number.NaN)).toBe(false)
  })

  it('accepts numeric strings coming from an <input type=number>', () => {
    expect(isFieldFilled(field({ type: 'number' }), '12.5')).toBe(true)
    expect(isFieldFilled(field({ type: 'number' }), 'abc')).toBe(false)
  })

  it('requires a checked checkbox but accepts a "no" on a yes/no question', () => {
    expect(isFieldFilled(field({ type: 'checkbox' }), true)).toBe(true)
    expect(isFieldFilled(field({ type: 'checkbox' }), false)).toBe(false)
    expect(isFieldFilled(field({ type: 'yesno' }), false)).toBe(true)
    expect(isFieldFilled(field({ type: 'yesno' }), null)).toBe(false)
  })

  it('validates geopoints', () => {
    expect(isFieldFilled(field({ type: 'geopoint' }), { lat: 51.2277, lng: 6.7735 })).toBe(true)
    expect(isFieldFilled(field({ type: 'geopoint' }), { lat: 51.2277 })).toBe(false)
    expect(isFieldFilled(field({ type: 'geopoint' }), 'here')).toBe(false)
  })
})

describe('conditionMet', () => {
  const answers: CaptureAnswers = {
    checklist: { duct_as_planned: false },
    details: { result: 'OK' },
  }

  it('resolves <section>.<field> paths', () => {
    expect(conditionMet({ path: 'checklist.duct_as_planned', equals: false }, answers)).toBe(true)
    expect(conditionMet({ path: 'details.result', equals: 'OK' }, answers)).toBe(true)
    expect(conditionMet({ path: 'details.result', equals: 'NOK' }, answers)).toBe(false)
  })

  it('resolves item.<field> against the repeater item being evaluated', () => {
    const item = { id: 'cata-1', values: { left_open: true } }
    expect(conditionMet({ path: 'item.left_open', equals: true }, answers, item)).toBe(true)
    expect(conditionMet({ path: 'item.left_open', equals: true }, answers, null)).toBe(false)
  })

  it('treats an unanswered field as null, and no condition as always met', () => {
    expect(conditionMet({ path: 'checklist.never_asked', equals: null }, answers)).toBe(true)
    expect(conditionMet({ path: 'checklist.never_asked', equals: true }, answers)).toBe(false)
    expect(conditionMet(undefined, answers)).toBe(true)
  })
})

describe('evaluateCapturePlan — photo slots', () => {
  const simplePlan = plan([
    photosSection([
      slot({ key: 'before', legacyType: 'before' }),
      slot({ key: 'during', legacyType: 'during' }),
      slot({ key: 'after', legacyType: 'after', min: 2 }),
    ]),
  ])

  it('reports every missing photo in plan order', () => {
    const result = evaluateCapturePlan(simplePlan, [], {})

    expect(result.canSubmit).toBe(false)
    expect(result.missingPhotoCount).toBe(4)
    expect(result.missing.map((node) => node.slotKey)).toEqual(['before', 'during', 'after'])
    expect(result.missing[2].count).toBe(2)
  })

  it('counts photos stamped with their slot', () => {
    const photos = [
      photo({ section_key: 'photos', slot_key: 'before', photo_type: 'before' }),
      photo({ section_key: 'photos', slot_key: 'during', photo_type: 'during' }),
      photo({ section_key: 'photos', slot_key: 'after', photo_type: 'after' }),
      photo({ section_key: 'photos', slot_key: 'after', photo_type: 'after' }),
    ]
    const result = evaluateCapturePlan(simplePlan, photos, {})

    expect(result.canSubmit).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.sections[0].satisfied).toBe(true)
  })

  it('falls back to photo_type for photos uploaded before capture plans existed', () => {
    const photos = [
      photo({ photo_type: 'before' }),
      photo({ photo_type: 'during' }),
      photo({ photo_type: 'after' }),
      photo({ photo_type: 'after' }),
    ]
    const result = evaluateCapturePlan(simplePlan, photos, {})

    expect(result.canSubmit).toBe(true)
  })

  it('ignores photos pointing at a slot the plan no longer has', () => {
    const photos = [photo({ section_key: 'photos', slot_key: 'gone', photo_type: 'before' })]
    const result = evaluateCapturePlan(simplePlan, photos, {})

    expect(result.missingPhotoCount).toBe(4)
  })

  it('flags overflow without blocking submission', () => {
    const capped = plan([photosSection([slot({ key: 'label', min: 1, max: 1 })])])
    const photos = [
      photo({ section_key: 'photos', slot_key: 'label' }),
      photo({ section_key: 'photos', slot_key: 'label' }),
    ]
    const result = evaluateCapturePlan(capped, photos, {})

    expect(result.sections[0].slots[0].overflow).toBe(true)
    expect(result.canSubmit).toBe(true)
  })

  it('never demands a slot with min 0', () => {
    const optional = plan([photosSection([slot({ key: 'incident', min: 0 })])])
    expect(evaluateCapturePlan(optional, [], {}).canSubmit).toBe(true)
  })

  it('hides — and stops demanding — conditional slots', () => {
    const conditional = plan([
      photosSection([
        slot({ key: 'signage', condition: { path: 'checklist.left_open', equals: true } }),
      ]),
    ])

    const hidden = evaluateCapturePlan(conditional, [], { checklist: { left_open: false } })
    expect(hidden.sections[0].slots[0].visible).toBe(false)
    expect(hidden.canSubmit).toBe(true)

    const revealed = evaluateCapturePlan(conditional, [], { checklist: { left_open: true } })
    expect(revealed.sections[0].slots[0].visible).toBe(true)
    expect(revealed.canSubmit).toBe(false)
  })
})

describe('evaluateCapturePlan — fields', () => {
  const detailPlan = plan([
    fieldsSection([
      { key: 'meters', type: 'number', labelKey: 'l', required: true },
      { key: 'result', type: 'select', labelKey: 'l', options: ['OK', 'NOK'], required: true },
      { key: 'notes', type: 'text', labelKey: 'l' },
    ]),
  ])

  it('blocks on empty required fields only', () => {
    const result = evaluateCapturePlan(detailPlan, [], { details: { meters: 120 } })

    expect(result.missingFieldCount).toBe(1)
    expect(result.missing[0]).toMatchObject({ kind: 'field', fieldKey: 'result', count: 1 })
  })

  it('passes once every required field is filled, optional ones untouched', () => {
    const result = evaluateCapturePlan(detailPlan, [], { details: { meters: 120, result: 'OK' } })

    expect(result.canSubmit).toBe(true)
    expect(result.sections[0].fields[2].filled).toBe(false)
    expect(result.sections[0].fields[2].satisfied).toBe(true)
  })

  it('does not demand a required field whose condition is unmet', () => {
    const conditional = plan([
      fieldsSection(
        [
          { key: 'duct_as_planned', type: 'yesno', labelKey: 'l', required: true },
          {
            key: 'change_reason',
            type: 'text',
            labelKey: 'l',
            required: true,
            condition: { path: 'checklist.duct_as_planned', equals: false },
          },
        ],
        'checklist',
      ),
    ])

    const asPlanned = evaluateCapturePlan(conditional, [], { checklist: { duct_as_planned: true } })
    expect(asPlanned.canSubmit).toBe(true)

    const deviated = evaluateCapturePlan(conditional, [], { checklist: { duct_as_planned: false } })
    expect(deviated.canSubmit).toBe(false)
    expect(deviated.missing[0].fieldKey).toBe('change_reason')
  })

  it('skips an entire section whose condition is unmet', () => {
    const gated = plan([
      fieldsSection([{ key: 'a', type: 'text', labelKey: 'l', required: true }], 'gated'),
    ])
    const gatedSection = gated.sections[0]
    gatedSection.condition = { path: 'other.enabled', equals: true }

    const result = evaluateCapturePlan(gated, [], {})
    expect(result.sections[0].visible).toBe(false)
    expect(result.canSubmit).toBe(true)
  })
})

describe('evaluateCapturePlan — repeaters', () => {
  const catasPlan = plan([
    {
      key: 'catas',
      kind: 'repeater',
      titleKey: 'x',
      itemLabelKey: 'x',
      min: 0,
      slots: [
        slot({ key: 'before_open', legacyType: 'before' }),
        slot({
          key: 'safety_signage',
          min: 0,
          legacyType: 'during',
          condition: { path: 'item.left_open', equals: true },
        }),
      ],
      fields: [
        { key: 'left_open', type: 'yesno', labelKey: 'l', required: true },
        { key: 'depth_cm', type: 'number', labelKey: 'l', min: 0 },
      ],
    },
  ])

  it('never blocks when there are no items and min is 0', () => {
    const result = evaluateCapturePlan(catasPlan, [], {})

    expect(result.canSubmit).toBe(true)
    expect(result.sections[0].itemCount).toBe(0)
  })

  it('demands photos and fields per item, matched by item_id', () => {
    const answers: CaptureAnswers = {
      catas: [
        { id: 'cata-1', values: { left_open: true } },
        { id: 'cata-2', values: {} },
      ],
    }
    const photos = [photo({ section_key: 'catas', slot_key: 'before_open', item_id: 'cata-1' })]
    const result = evaluateCapturePlan(catasPlan, photos, answers)

    expect(result.sections[0].items).toHaveLength(2)
    expect(result.sections[0].items[0].slots[0].count).toBe(1)
    expect(result.sections[0].items[1].slots[0].count).toBe(0)
    expect(result.missing.map((node) => [node.itemId, node.slotKey ?? node.fieldKey])).toEqual([
      ['cata-2', 'before_open'],
      ['cata-2', 'left_open'],
    ])
  })

  it('reveals the conditional slot per item without demanding it', () => {
    const answers: CaptureAnswers = {
      catas: [
        { id: 'cata-1', values: { left_open: true } },
        { id: 'cata-2', values: { left_open: false } },
      ],
    }
    const photos = [
      photo({ section_key: 'catas', slot_key: 'before_open', item_id: 'cata-1' }),
      photo({ section_key: 'catas', slot_key: 'before_open', item_id: 'cata-2' }),
    ]
    const result = evaluateCapturePlan(catasPlan, photos, answers)
    const [first, second] = result.sections[0].items

    expect(first.slots[1].visible).toBe(true)
    expect(second.slots[1].visible).toBe(false)
    expect(result.canSubmit).toBe(true)
  })

  it('reports missing items when the repeater has a minimum', () => {
    const mandatory = plan([{ ...catasPlan.sections[0], min: 1 } as CaptureSection])
    const result = evaluateCapturePlan(mandatory, [], {})

    expect(result.missing[0]).toMatchObject({ kind: 'items', sectionKey: 'catas', count: 1 })
    expect(result.canSubmit).toBe(false)
  })

  it('ignores malformed items in the answers blob', () => {
    const answers = { catas: [{ id: 'ok', values: {} }, { values: {} }] } as unknown as CaptureAnswers
    expect(repeaterItems(answers, 'catas')).toHaveLength(1)
  })
})

describe('evaluateCapturePlan — node ids', () => {
  it('addresses top-level and per-item nodes distinctly', () => {
    expect(slotNodeId('photos', 'before', null)).toBe('photos:before')
    expect(slotNodeId('catas', 'before_open', 'cata-1')).toBe('catas:cata-1:before_open')
    expect(fieldNodeId('details', 'meters', null)).toBe('details:meters')
  })

  it('carries the scroll target of the first unmet requirement', () => {
    const result = evaluateCapturePlan(
      plan([
        photosSection([slot({ key: 'before', legacyType: 'before' })]),
        fieldsSection([{ key: 'meters', type: 'number', labelKey: 'l', required: true }]),
      ]),
      [],
      {},
    )

    expect(result.missing[0].nodeId).toBe('photos:before')
    expect(result.missing[1].nodeId).toBe('details:meters')
  })
})
