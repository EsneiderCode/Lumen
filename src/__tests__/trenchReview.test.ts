import { describe, expect, it } from 'vitest'
import {
  clearReview,
  farthestFromCentre,
  firstRepeaterSection,
  geoFieldKey,
  markReviewed,
  metresBetween,
  reviewAcceptedAt,
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
    { id: 'cata-1', values: { depth_cm: 40, left_open: true, location: { lat: 49.8601, lng: 8.7536, accuracy_m: null } } },
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
  })

  it('no inventa nada cuando no hay plan', () => {
    expect(firstRepeaterSection(null)).toBeNull()
    expect(geoFieldKey(null)).toBeNull()
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

describe('aceptación de la revisión', () => {
  it('recuerda cuándo se aceptó', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    const marked = markReviewed(ANSWERS, trenches, WHEN)
    expect(reviewAcceptedAt(marked, trenches)).toBe(WHEN)
  })

  it('se cae sola al mover un pin', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    const marked = markReviewed(ANSWERS, trenches, WHEN)
    const moved = setTrenchLocation(PLAN, marked, 'cata-1', { lat: 49.87, lng: 8.76, accuracy_m: null })
    expect(reviewAcceptedAt(moved, trenchesForReview(PLAN, moved, PHOTOS))).toBeNull()
  })

  it('se cae sola al añadir una foto a una cata', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    const marked = markReviewed(ANSWERS, trenches, WHEN)
    const conMas = [...PHOTOS, { id: 'f5', section_key: 'catas', item_id: 'cata-1' }]
    expect(reviewAcceptedAt(marked, trenchesForReview(PLAN, marked, conMas))).toBeNull()
  })

  it('aguanta un temblor de pin de menos de un metro', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    const marked = markReviewed(ANSWERS, trenches, WHEN)
    const nudged = setTrenchLocation(PLAN, marked, 'cata-1', {
      lat: 49.860100001,
      lng: 8.753600001,
      accuracy_m: null,
    })
    expect(reviewAcceptedAt(nudged, trenchesForReview(PLAN, nudged, PHOTOS))).toBe(WHEN)
  })

  it('«corregir algo» retira el visto bueno', () => {
    const trenches = trenchesForReview(PLAN, ANSWERS, PHOTOS)
    const marked = markReviewed(ANSWERS, trenches, WHEN)
    expect(reviewAcceptedAt(clearReview(marked), trenches)).toBeNull()
  })

  it('sin aceptar no hay fecha', () => {
    expect(reviewAcceptedAt(ANSWERS, trenchesForReview(PLAN, ANSWERS, PHOTOS))).toBeNull()
  })

  it('no ensucia las respuestas que se envían', () => {
    const marked = markReviewed(ANSWERS, trenchesForReview(PLAN, ANSWERS, PHOTOS), WHEN)
    expect(marked.catas).toEqual(ANSWERS.catas)
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
