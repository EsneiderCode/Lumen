// Lo que hace falta para que el técnico revise sus catas en un mapa antes de
// enviar la Rückmeldung.
//
// La posición de cada cata la pone él a mano: las fotos llegan sin EXIF (la
// galería y WhatsApp lo borran), así que no hay nada que deducir. Lo que sí
// aporta la pantalla es enseñárselo junto y en un mapa: sobre el plano se ve de
// un vistazo la cata que quedó dos calles más allá, y eso escrito en una lista
// de coordenadas no lo ve nadie.
//
// La aceptación se guarda con una huella de lo aceptado. Si después mueve un
// pin, añade una cata o le cambia las fotos, la revisión deja de valer sola —
// un sello de «validado» que sobrevive a los cambios miente, y aquí lo que se
// está validando es justamente dónde estuvo la cuadrilla.
//
// Puro: se prueba en src/__tests__/ sin montar nada.

import { repeaterItems } from '@/services/capturePlanEngine'
import type {
  CaptureAnswers,
  CaptureGeoPoint,
  CapturePlan,
  CaptureRepeaterItem,
  CaptureRepeaterSection,
} from '@/types/capture-plan'

/** Clave reservada dentro de `answers`. No es una sección del plan: el motor de
 *  evaluación recorre las secciones y la ignora. */
export const REVIEW_KEY = '__review'

/** Tipo (no interfaz) a propósito: así encaja en el índice de `CaptureAnswers`. */
export type TrenchReviewMark = {
  accepted_at: string
  fingerprint: string
}

export interface ReviewTrench {
  itemId: string
  /** 1-based, en el orden en que el técnico las creó — el mismo que ve en el formulario. */
  index: number
  location: CaptureGeoPoint | null
  photoIds: string[]
  depthCm: number | null
}

/** La sección de catas del plan. Hoy solo `soplado_ra` tiene una. */
export function firstRepeaterSection(plan: CapturePlan | null): CaptureRepeaterSection | null {
  if (!plan) return null
  return (plan.sections.find((section) => section.kind === 'repeater') as CaptureRepeaterSection) ?? null
}

/** La clave del campo de posición dentro de la cata, si el plan lo declara. */
export function geoFieldKey(section: CaptureRepeaterSection | null): string | null {
  if (!section) return null
  return section.fields.find((field) => field.type === 'geopoint')?.key ?? null
}

function isPoint(value: unknown): value is CaptureGeoPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as CaptureGeoPoint
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

/** Las catas tal y como hay que enseñarlas: su pin, sus fotos y su profundidad. */
export function trenchesForReview(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
  photos: Array<{ id: string; section_key?: string | null; item_id?: string | null }>,
): ReviewTrench[] {
  const section = firstRepeaterSection(plan)
  if (!section) return []
  const geoKey = geoFieldKey(section)

  return repeaterItems(answers, section.key).map((item, index) => ({
    itemId: item.id,
    index: index + 1,
    location: geoKey && isPoint(item.values[geoKey]) ? (item.values[geoKey] as CaptureGeoPoint) : null,
    photoIds: photos
      .filter((photo) => photo.section_key === section.key && photo.item_id === item.id)
      .map((photo) => photo.id),
    depthCm: numberOrNull((item.values as Record<string, unknown>).depth_cm),
  }))
}

/** Mueve el pin de una cata sin tocar nada más de lo que tenga escrito. */
export function setTrenchLocation(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
  itemId: string,
  point: CaptureGeoPoint,
): CaptureAnswers {
  const section = firstRepeaterSection(plan)
  const geoKey = geoFieldKey(section)
  if (!section || !geoKey) return answers

  const items: CaptureRepeaterItem[] = repeaterItems(answers, section.key).map((item) =>
    item.id === itemId ? { ...item, values: { ...item.values, [geoKey]: point } } : item,
  )
  return { ...answers, [section.key]: items }
}

/** Distancia en metros. Equirrectangular: a escala de una calle el error es nulo. */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const dx = (b.lng - a.lng) * 111_320 * Math.cos(meanLat)
  const dy = (b.lat - a.lat) * 110_540
  return Math.hypot(dx, dy)
}

/**
 * Cuánto se aleja del centro del proyecto la cata más excéntrica. Un pin puesto
 * de un dedazo en el mapa equivocado se ve aquí antes que en la oficina.
 */
export function farthestFromCentre(
  trenches: ReviewTrench[],
  centre: { lat: number; lng: number } | null,
): number | null {
  const located = trenches.map((trench) => trench.location).filter((point): point is CaptureGeoPoint => !!point)
  if (!centre || located.length === 0) return null
  return Math.max(...located.map((point) => metresBetween(point, centre)))
}

/**
 * Huella de lo que se está aceptando: qué catas, dónde y con cuántas fotos. Se
 * redondea a cinco decimales (~1 m) para que arrastrar el pin un píxel no
 * invalide la revisión, pero moverlo de verdad sí.
 */
export function trenchFingerprint(trenches: ReviewTrench[]): string {
  return trenches
    .map((trench) => {
      const where = trench.location
        ? `${trench.location.lat.toFixed(5)},${trench.location.lng.toFixed(5)}`
        : 'sin-posicion'
      return `${trench.itemId}@${where}#${trench.photoIds.length}`
    })
    .join('|')
}

export function markReviewed(answers: CaptureAnswers, trenches: ReviewTrench[], when: string): CaptureAnswers {
  const mark: TrenchReviewMark = { accepted_at: when, fingerprint: trenchFingerprint(trenches) }
  return { ...answers, [REVIEW_KEY]: mark }
}

export function clearReview(answers: CaptureAnswers): CaptureAnswers {
  const next = { ...answers }
  delete (next as Record<string, unknown>)[REVIEW_KEY]
  return next
}

/**
 * Cuándo se aceptó este mapa, o null si no se ha aceptado o si cambió algo
 * desde entonces. Nunca devuelve una fecha que ya no describa lo que hay.
 */
export function reviewAcceptedAt(answers: CaptureAnswers, trenches: ReviewTrench[]): string | null {
  const mark = (answers as Record<string, unknown>)[REVIEW_KEY] as TrenchReviewMark | undefined
  if (!mark || typeof mark.accepted_at !== 'string') return null
  return mark.fingerprint === trenchFingerprint(trenches) ? mark.accepted_at : null
}
