// Lo que hace falta para que el técnico revise sus catas en un mapa antes de
// enviar la Rückmeldung.
//
// La posición de cada cata la escribe él: la copia de la marca de agua que la
// cámara quemó sobre una de las fotos de esa cata (la galería y WhatsApp borran
// el EXIF, así que no hay nada que deducir), y acto seguido la ve sobre el mapa
// y da el pin por bueno o lo arrastra. Ese visto bueno vive DENTRO de la cata
// —es el campo `geoconfirm` del plan—, así que la puerta SQL lo exige como
// cualquier otro campo obligatorio y ninguna cata se envía sin él.
//
// Moverlo lo retira: un visto bueno vale para el punto que se confirmó, no para
// el campo. De eso se encarga `pinResetKeys`, y por eso `setTrenchLocation` no
// se limita a escribir la posición.
//
// El mapa final ya no valida nada — con cada cata confirmada por separado sería
// firmar dos veces lo mismo. Lo que aporta es verlas juntas y unidas por su
// recorrido: la que quedó dos calles más allá salta a la vista ahí, y en una
// lista de coordenadas no la ve nadie.
//
// Puro: se prueba en src/__tests__/ sin montar nada.

import { repeaterItems } from '@/services/capturePlanEngine'
import type {
  CaptureAnswers,
  CaptureGeoPoint,
  CapturePlan,
  CaptureRepeaterItem,
  CaptureRepeaterSection,
  CaptureSection,
} from '@/types/capture-plan'

export interface ReviewTrench {
  itemId: string
  /** 1-based, en el orden en que el técnico las creó — el mismo que ve en el formulario. */
  index: number
  location: CaptureGeoPoint | null
  /** Cuándo dio el pin por bueno, o null si aún no lo ha hecho. */
  confirmedAt: string | null
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

/** La clave del visto bueno del pin dentro de la cata, si el plan lo declara. */
export function pinConfirmFieldKey(section: CaptureRepeaterSection | null): string | null {
  if (!section) return null
  return section.fields.find((field) => field.type === 'geoconfirm')?.key ?? null
}

/**
 * Los campos que dejan de significar nada porque se ha tocado `fieldKey`: mover
 * la posición de una cata retira el visto bueno de su pin. Devuelve una lista
 * vacía para todo lo demás, que es el caso normal.
 */
export function pinResetKeys(
  plan: CapturePlan | null,
  sectionKey: string,
  fieldKey: string,
): string[] {
  const section = plan?.sections.find((candidate: CaptureSection) => candidate.key === sectionKey)
  if (!section || !('fields' in section)) return []

  const changed = section.fields.find((field) => field.key === fieldKey)
  if (changed?.type !== 'geopoint') return []

  return section.fields.filter((field) => field.type === 'geoconfirm').map((field) => field.key)
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
  const confirmKey = pinConfirmFieldKey(section)

  return repeaterItems(answers, section.key).map((item, index) => {
    const confirmed = confirmKey ? item.values[confirmKey] : null
    return {
      itemId: item.id,
      index: index + 1,
      location: geoKey && isPoint(item.values[geoKey]) ? (item.values[geoKey] as CaptureGeoPoint) : null,
      confirmedAt: typeof confirmed === 'string' && confirmed.trim() !== '' ? confirmed : null,
      photoIds: photos
        .filter((photo) => photo.section_key === section.key && photo.item_id === item.id)
        .map((photo) => photo.id),
      depthCm: numberOrNull((item.values as Record<string, unknown>).depth_cm),
    }
  })
}

/**
 * Mueve el pin de una cata sin tocar nada más de lo que tenga escrito, y le
 * retira el visto bueno: lo que se confirmó era el punto anterior.
 */
export function setTrenchLocation(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
  itemId: string,
  point: CaptureGeoPoint,
): CaptureAnswers {
  const section = firstRepeaterSection(plan)
  const geoKey = geoFieldKey(section)
  if (!section || !geoKey) return answers

  const resets = pinResetKeys(plan, section.key, geoKey)
  const items: CaptureRepeaterItem[] = repeaterItems(answers, section.key).map((item) => {
    if (item.id !== itemId) return item
    const values = { ...item.values, [geoKey]: point }
    for (const key of resets) delete values[key]
    return { ...item, values }
  })
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
