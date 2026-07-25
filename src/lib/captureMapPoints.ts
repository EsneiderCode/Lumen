// Turns a capture report into the points a map can draw. Pure, so it is tested
// in src/__tests__/ without rendering anything — MapLibre never enters the test
// suite (convention of this repo: logic in services/lib, not in components).
//
// Two independent sources of coordinates, in this order of trust:
//   1. the plan's geopoint FIELDS (the trench position: captured automatically
//      with the first photo of the trench and correctable by hand on the map),
//   2. the coordinates stamped on each PHOTO (lat/lng/accuracy_m, migration
//      052), for everything that has no geopoint field of its own.
//
// A point is never invented: a trench with no fix and no located photo simply
// does not appear, and the caller says so instead of drawing it somewhere wrong.

import { repeaterItems, sectionValues } from '@/services/capturePlanEngine'
import type {
  CaptureAnswers,
  CaptureGeoPoint,
  CapturePlan,
  CaptureSection,
} from '@/types/capture-plan'

export type CaptureMapPointKind = 'trench' | 'incident' | 'slot'

export interface CaptureMapPhotoRef {
  id: string
  storage_path: string
  lat?: number | null
  lng?: number | null
}

export interface CaptureMapPoint {
  /** Stable across renders: `<sectionKey>[:<itemId>]`. */
  id: string
  kind: CaptureMapPointKind
  lat: number
  lng: number
  accuracy_m: number | null
  /** 1-based, in capture order — what the pin shows. Only for trenches. */
  index: number | null
  sectionKey: string
  itemId: string | null
  /** i18n key of the section/slot this point stands for. */
  labelKey: string
  /** Depth in cm and any other numeric the card shows. */
  depthCm: number | null
  photos: CaptureMapPhotoRef[]
}

export interface CaptureMapData {
  points: CaptureMapPoint[]
  /** Trenches in capture order — the dashed line of the route walked. */
  route: Array<[number, number]>
  /** Trenches the technician recorded without any position at all. */
  unlocatedTrenches: number
  bounds: [[number, number], [number, number]] | null
}

function isPoint(value: unknown): value is CaptureGeoPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as CaptureGeoPoint
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
}

function locatedPhotos(photos: CaptureMapPhotoRef[]): CaptureMapPhotoRef[] {
  return photos.filter((photo) => Number.isFinite(photo.lat) && Number.isFinite(photo.lng))
}

/** Average of the located photos — steadier than any single fix. */
function photoCentroid(photos: CaptureMapPhotoRef[]): CaptureGeoPoint | null {
  const located = locatedPhotos(photos)
  if (located.length === 0) return null
  const sum = located.reduce(
    (total, photo) => ({ lat: total.lat + (photo.lat as number), lng: total.lng + (photo.lng as number) }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / located.length, lng: sum.lng / located.length, accuracy_m: null }
}

function geoFieldOf(section: CaptureSection): string | null {
  if (!('fields' in section)) return null
  return section.fields.find((field) => field.type === 'geopoint')?.key ?? null
}

function numberFieldValue(values: Record<string, unknown>, key: string): number | null {
  const value = values[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

export function buildCaptureMapData(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
  photos: CaptureMapPhotoRef[],
): CaptureMapData {
  const points: CaptureMapPoint[] = []
  const route: Array<[number, number]> = []
  let unlocatedTrenches = 0

  if (!plan) return { points, route, unlocatedTrenches, bounds: null }

  const photosOf = (sectionKey: string, itemId: string | null) =>
    photos.filter(
      (photo) =>
        (photo as { section_key?: string | null }).section_key === sectionKey &&
        ((photo as { item_id?: string | null }).item_id ?? null) === itemId,
    )

  for (const section of plan.sections) {
    if (section.kind === 'repeater') {
      const geoField = geoFieldOf(section)
      repeaterItems(answers, section.key).forEach((item, index) => {
        const itemPhotos = photosOf(section.key, item.id)
        const declared = geoField ? item.values[geoField] : undefined
        // The hand-corrected pin wins over the photo coordinates: the technician
        // standing there beats a GPS that drifts 15–20 m between buildings.
        const position = isPoint(declared) ? declared : photoCentroid(itemPhotos)

        if (!position) {
          unlocatedTrenches += 1
          return
        }

        points.push({
          id: `${section.key}:${item.id}`,
          kind: 'trench',
          lat: position.lat,
          lng: position.lng,
          accuracy_m: position.accuracy_m ?? null,
          index: index + 1,
          sectionKey: section.key,
          itemId: item.id,
          labelKey: section.itemLabelKey,
          depthCm: numberFieldValue(item.values as Record<string, unknown>, 'depth_cm'),
          photos: itemPhotos,
        })
        route.push([position.lng, position.lat])
      })
      continue
    }

    // Everything else is located by its photos alone. A gallery of incidents is
    // the one worth its own colour on the map; the rest are ordinary evidence.
    const sectionPhotos = photosOf(section.key, null)
    const position = photoCentroid(sectionPhotos)
    if (!position) continue

    points.push({
      id: section.key,
      kind: section.kind === 'gallery' ? 'incident' : 'slot',
      lat: position.lat,
      lng: position.lng,
      accuracy_m: null,
      index: null,
      sectionKey: section.key,
      itemId: null,
      labelKey: section.titleKey,
      depthCm: numberFieldValue(
        sectionValues(answers, section.key) as Record<string, unknown>,
        'depth_cm',
      ),
      photos: locatedPhotos(sectionPhotos),
    })
  }

  return { points, route, unlocatedTrenches, bounds: boundsOf(points) }
}

/** Bounding box of the points, or null when there is nothing to frame. */
export function boundsOf(
  points: Array<{ lat: number; lng: number }>,
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}
