import { describe, expect, it } from 'vitest'
import {
  answersFromLegacyDetail,
  legacyDetailFromAnswers,
  legacyDetailTable,
  mergeAnswers,
} from '@/services/capturePlanLegacy'
import { DEFAULT_CAPTURE_PLANS } from '@/constants/capture-plans'
import { evaluateCapturePlan } from '@/services/capturePlanEngine'
import type { CaptureAnswers, CapturePlan } from '@/types/capture-plan'

const soplado = DEFAULT_CAPTURE_PLANS.soplado
const fusion = DEFAULT_CAPTURE_PLANS.fusion_ap

describe('legacyDetailFromAnswers', () => {
  it('maps the plan fields onto their legacy columns', () => {
    const answers: CaptureAnswers = {
      details: { meters: 120, section: 'A1-B3', tube_diameter: '7/3.5', result: 'OK' },
    }

    expect(legacyDetailFromAnswers(soplado, answers)).toEqual({
      meters: 120,
      section: 'A1-B3',
      tube_diameter: '7/3.5',
      result: 'OK',
    })
  })

  it('writes only what has been answered, so an untouched column is not cleared', () => {
    expect(legacyDetailFromAnswers(soplado, { details: { meters: 40 } })).toEqual({ meters: 40 })
    expect(legacyDetailFromAnswers(soplado, {})).toEqual({})
  })

  it('keeps an explicit blank so the technician can clear a field', () => {
    expect(legacyDetailFromAnswers(soplado, { details: { section: '' } })).toEqual({ section: '' })
    expect(legacyDetailFromAnswers(soplado, { details: { meters: null } })).toEqual({ meters: null })
  })

  it('coerces number fields typed as strings', () => {
    expect(legacyDetailFromAnswers(soplado, { details: { meters: '85' } })).toEqual({ meters: 85 })
    expect(legacyDetailFromAnswers(soplado, { details: { meters: '' } })).toEqual({ meters: null })
  })

  it('ignores sections with no legacy home', () => {
    const planWithExtras: CapturePlan = {
      ...soplado,
      sections: [
        ...soplado.sections,
        { key: 'catas', kind: 'repeater', titleKey: 'x', itemLabelKey: 'x', min: 0, slots: [], fields: [] },
      ],
    }

    expect(legacyDetailFromAnswers(planWithExtras, { catas: [{ id: 'c1', values: {} }] })).toEqual({})
  })

  it('names the legacy table of the plan', () => {
    expect(legacyDetailTable(soplado)).toBe('wo_detail_soplado')
    expect(legacyDetailTable(fusion)).toBe('wo_detail_fusion_ap')
    expect(legacyDetailTable({ key: 'x', version: 1, sections: [] })).toBeNull()
  })
})

describe('answersFromLegacyDetail', () => {
  it('seeds the form from an order captured before the plans existed', () => {
    const detail = {
      id: 'row-1',
      work_order_id: 'wo-1',
      meters: 120,
      section: 'A1-B3',
      tube_diameter: '7/3.5',
      result: 'OK',
    }

    expect(answersFromLegacyDetail(soplado, detail)).toEqual({
      details: { meters: 120, section: 'A1-B3', tube_diameter: '7/3.5', result: 'OK' },
    })
  })

  it('normalises the types the detail row stores loosely', () => {
    const answers = answersFromLegacyDetail(fusion, {
      splice_count: '12',
      fiber_type: 'G.657.A2',
      has_measurement_cert: true,
      cabinet_code: 'NE3-S-001',
      card_count: null,
    })
    const values = answers.details as Record<string, unknown>

    expect(values.splice_count).toBe(12)
    expect(values.has_measurement_cert).toBe(true)
    expect(values).not.toHaveProperty('card_count')
  })

  it('returns nothing for a missing detail row', () => {
    expect(answersFromLegacyDetail(soplado, null)).toEqual({})
    expect(answersFromLegacyDetail(soplado, {})).toEqual({})
  })

  it('round-trips through the legacy row without losing a value', () => {
    const original: CaptureAnswers = {
      details: { meters: 120, section: 'A1-B3', tube_diameter: '7/3.5', result: 'OK' },
    }

    expect(answersFromLegacyDetail(soplado, legacyDetailFromAnswers(soplado, original))).toEqual(
      original,
    )
  })

  it('makes an order filled the old way evaluate as complete', () => {
    const answers = answersFromLegacyDetail(soplado, {
      meters: 120,
      section: 'A1-B3',
      tube_diameter: '7/3.5',
      result: 'OK',
    })
    const photos = [
      { id: 'p1', photo_type: 'before' },
      { id: 'p2', photo_type: 'during' },
      { id: 'p3', photo_type: 'after' },
    ]

    expect(evaluateCapturePlan(soplado, photos, answers).canSubmit).toBe(true)
  })
})

describe('mergeAnswers', () => {
  it('lets the stored answers win over the legacy seed, field by field', () => {
    const legacy: CaptureAnswers = { details: { meters: 100, section: 'A1-B3' } }
    const stored: CaptureAnswers = { details: { meters: 120 } }

    expect(mergeAnswers(legacy, stored)).toEqual({ details: { meters: 120, section: 'A1-B3' } })
  })

  it('replaces repeater sections wholesale instead of merging by key', () => {
    const base: CaptureAnswers = { catas: [{ id: 'c1', values: { depth_cm: 60 } }] }
    const override: CaptureAnswers = { catas: [{ id: 'c2', values: {} }] }

    expect(mergeAnswers(base, override).catas).toEqual([{ id: 'c2', values: {} }])
  })

  it('keeps sections the override does not mention', () => {
    const base: CaptureAnswers = { details: { meters: 10 }, checklist: { ok: true } }

    expect(mergeAnswers(base, {})).toEqual(base)
  })
})
