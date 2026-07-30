import { describe, expect, it } from 'vitest'
import {
  farthestFromCentre,
  firstRepeaterSection,
  geoFieldKey,
  metresBetween,
  pinConfirmFieldKey,
  pinResetKeys,
  setTrenchLocation,
  trenchesForReview,
} from '@/lib/trenchReview'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CaptureAnswers } from '@/types/capture-plan'

const PLAN = SOPLADO_RA_PLAN
const WHEN = '2026-07-27T15:00:00.000Z'

/** Roßdorf, el centro del proyecto QFF (migración 060). */
const ROSSDORF = { lat: 49.8601, lng: 8.7536 }

const ANSWERS: CaptureAnswers = {
  catas: [
    {
      id: 'cata-1',
      values: {
        depth_cm: 40,
        left_open: true,
        location: { lat: 49.8601, lng: 8.7536, accuracy_m: null },
        pin_confirmed: WHEN,
      },
    },
    { id: 'cata-2', values: { depth_cm: 20 } },
  ],
}

const PHOTOS = [
  { id: 'f1', section_key: 'catas', item_id: 'cata-1' },
  { id: 'f2', section_key: 'catas', item_id: 'cata-1' },
  { id: 'f3', section_key: 'catas', item_id: 'cata-2' },
  { id: 'f4', section_key: 'mandatory', item_id: null },
]

describe('firstRepeaterSection / geoFieldKey', () => {
  it('encuentra las catas del plan de soplado de RA', () => {
    expect(firstRepeaterSection(PLAN)?.key).toBe('catas')
    expect(geoFieldKey(firstRepeaterSection(PLAN))).toBe('location')
    expect(pinConfirmFieldKey(firstRepeaterSection(PLAN))).toBe('pin_confirmed')
  })

  it('no inventa nada cuando no hay plan', () => {
    expect(firstRepeaterSection(null)).toBeNull()
    expect(geoFieldKey(null)).toBeNull()
    expect(pinConfirmFieldKey(null)).toBeNull()
  })
})

describe('trenchesForReview', () => {
  it('reparte cada foto en su cata y deja fuera las que no son de catas', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    expect(trenches.map((trench) => trench.photoIds)).toEqual([['f1', 'f2'], ['f3']])
  })

  it('numera las catas como las ve el técnico en el formulario', () => {
    expect(trenchesForReview(PLAN, ANSWERS, PHOTOS).map((trench) => trench.index)).toEqual([1, 2])
  })

  it('distingue la cata con pin de la que aún no lo tiene', () => {
    const [conPin, sinPin] = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    expect(conPin.location).toEqual({ lat: 49.8601, lng: 8.7536, accuracy_m: null })
    expect(sinPin.location).toBeNull()
  })

  it('lleva la profundidad al mapa', () => {
    expect(trenchesForReview(PLAN, ANSWERS, PHOTOS)[0].depthCm).toBe(40)
  })

  it('no propone nada cuando el plan no tiene catas', () => {
    expect(trenchesForReview(null, ANSWERS, PHOTOS)).toEqual([])
  })
})

describe('setTrenchLocation', () => {
  it('mueve el pin sin tocar lo demás que tenga escrito', () => {
    const next = setTrenchLocation(PLAN, ANSWERS, 'cata-1', { lat: 49.86, lng: 8.75, accuracy_m: null })
    const [primera] = next.catas as Array<{ values: Record<string, unknown> }>
    expect(primera.values.location).toEqual({ lat: 49.86, lng: 8.75, accuracy_m: null })
    expect(primera.values.depth_cm).toBe(40)
    expect(primera.values.left_open).toBe(true)
  })

  it('retira el visto bueno de la cata que se mueve, sin tocar el original', () => {
    const next = setTrenchLocation(PLAN, ANSWERS, 'cata-1', { lat: 49.86, lng: 8.75, accuracy_m: null })

    expect(trenchesForReview(PLAN, next, PHOTOS)[0].confirmedAt).toBeNull()
    // Un visto bueno vale para el punto que se confirmó, no para el campo.
    expect(trenchesForReview(PLAN, ANSWERS, PHOTOS)[0].confirmedAt).toBe(WHEN)
  })

  it('no toca las demás catas', () => {
    const next = setTrenchLocation(PLAN, ANSWERS, 'cata-1', { lat: 49.86, lng: 8.75, accuracy_m: null })
    const segunda = (next.catas as Array<{ values: Record<string, unknown> }>)[1]
    expect(segunda.values.location).toBeUndefined()
    expect(segunda.values.depth_cm).toBe(20)
  })

  it('devuelve las respuestas intactas si el plan no tiene campo de posición', () => {
    expect(setTrenchLocation(null, ANSWERS, 'cata-1', { lat: 1, lng: 2, accuracy_m: null })).toBe(ANSWERS)
  })
})

describe('confirmación del pin, cata por cata', () => {
  it('lleva al mapa cuál está confirmada y cuál no', () => {
    const [confirmada, sinConfirmar] = trenchesForReview(PLAN, ANSWERS, PHOTOS)

    expect(confirmada.confirmedAt).toBe(WHEN)
    expect(sinConfirmar.confirmedAt).toBeNull()
  })

  it('no da por confirmada una marca vacía', () => {
    const answers: CaptureAnswers = {
      catas: [{ id: 'cata-1', values: { location: { lat: 49.86, lng: 8.75 }, pin_confirmed: '  ' } }],
    }
    expect(trenchesForReview(PLAN, answers, PHOTOS)[0].confirmedAt).toBeNull()
  })

  it('solo la posición tumba el visto bueno; lo demás de la cata no', () => {
    expect(pinResetKeys(PLAN, 'catas', 'location')).toEqual(['pin_confirmed'])
    expect(pinResetKeys(PLAN, 'catas', 'depth_cm')).toEqual([])
    expect(pinResetKeys(PLAN, 'catas', 'left_open')).toEqual([])
  })

  it('no opina sobre secciones que no existen ni sin plan', () => {
    expect(pinResetKeys(PLAN, 'checklist', 'duct_as_planned')).toEqual([])
    expect(pinResetKeys(PLAN, 'no_existe', 'location')).toEqual([])
    expect(pinResetKeys(null, 'catas', 'location')).toEqual([])
  })
})

describe('farthestFromCentre', () => {
  it('mide un grado de latitud en unos 110 km', () => {
    expect(metresBetween({ lat: 49, lng: 8 }, { lat: 50, lng: 8 })).toBeCloseTo(110_540, -3)
  })

  it('no se queja de una cata dentro del pueblo', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    expect(farthestFromCentre(trenches, ROSSDORF)).toBeLessThan(100)
  })

  it('delata un pin puesto en otro sitio', () => {
    const lejos = setTrenchLocation(PLAN, ANSWERS, 'cata-1', { lat: 49.86, lng: 8.95, accuracy_m: null })
    const trenches = trenchesForReview(PLAN, lejos, PHOTOS)
    expect(farthestFromCentre(trenches, ROSSDORF)).toBeGreaterThan(10_000)
  })

  it('no opina cuando el proyecto no tiene centro', () => {
    expect(farthestFromCentre(trenchesForReview(PLAN, ANSWERS, PHOTOS), null)).toBeNull()
  })
})
