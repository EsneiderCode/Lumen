import { describe, expect, it } from 'vitest'
import { boundsOf, buildCaptureMapData, type CaptureMapPhotoRef } from '@/lib/captureMapPoints'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import { DEFAULT_CAPTURE_PLANS } from '@/constants/capture-plans'
import type { CaptureAnswers } from '@/types/capture-plan'

type DemoPhoto = CaptureMapPhotoRef & {
  section_key?: string | null
  slot_key?: string | null
  item_id?: string | null
}

const photo = (overrides: Partial<DemoPhoto> & { id: string }): DemoPhoto => ({
  storage_path: `demo/${overrides.id}.jpg`,
  section_key: null,
  slot_key: null,
  item_id: null,
  lat: null,
  lng: null,
  ...overrides,
})

const trenchAnswers = (): CaptureAnswers => ({
  catas: [
    {
      id: 'c1',
      values: { depth_cm: 62, location: { lat: 51.7768, lng: 9.3804, accuracy_m: 8 } },
    },
    {
      id: 'c2',
      values: { depth_cm: 48, location: { lat: 51.7773, lng: 9.3821, accuracy_m: 11 } },
    },
  ],
})

describe('capture map points', () => {
  it('numbers the trenches in capture order and carries their depth', () => {
    const { points, route } = buildCaptureMapData(SOPLADO_RA_PLAN, trenchAnswers(), [])

    expect(points.map((point) => [point.kind, point.index, point.depthCm])).toEqual([
      ['trench', 1, 62],
      ['trench', 2, 48],
    ])
    expect(points[0].labelKey).toBe('capturePlan.sopladoRa.catas.item')
    expect(route).toEqual([
      [9.3804, 51.7768],
      [9.3821, 51.7773],
    ])
  })

  // The technician standing on the trench beats a GPS that drifts 15–20 m
  // between buildings, so a corrected pin must never be overruled by photos.
  it('prefers the corrected pin over the photo coordinates', () => {
    const photos: DemoPhoto[] = [
      photo({ id: 'p1', section_key: 'catas', item_id: 'c1', lat: 51.9, lng: 9.9 }),
    ]
    const { points } = buildCaptureMapData(SOPLADO_RA_PLAN, trenchAnswers(), photos)

    expect(points[0].lat).toBe(51.7768)
    expect(points[0].photos.map((item) => item.id)).toEqual(['p1'])
  })

  it('falls back to the average of the trench photos when there is no pin', () => {
    const answers: CaptureAnswers = { catas: [{ id: 'c1', values: { depth_cm: 40 } }] }
    const photos: DemoPhoto[] = [
      photo({ id: 'p1', section_key: 'catas', item_id: 'c1', lat: 51.0, lng: 9.0 }),
      photo({ id: 'p2', section_key: 'catas', item_id: 'c1', lat: 51.2, lng: 9.4 }),
    ]

    const { points } = buildCaptureMapData(SOPLADO_RA_PLAN, answers, photos)

    expect(points).toHaveLength(1)
    expect(points[0].lat).toBeCloseTo(51.1)
    expect(points[0].lng).toBeCloseTo(9.2)
    expect(points[0].accuracy_m).toBeNull()
  })

  // A point is never invented: an unlocated trench is reported as a count so the
  // admin sees the gap instead of a pin in the wrong street.
  it('counts trenches with no position instead of placing them', () => {
    const answers: CaptureAnswers = {
      catas: [{ id: 'c1', values: { depth_cm: 40 } }, { id: 'c2', values: {} }],
    }
    const { points, unlocatedTrenches, bounds } = buildCaptureMapData(SOPLADO_RA_PLAN, answers, [])

    expect(points).toEqual([])
    expect(unlocatedTrenches).toBe(2)
    expect(bounds).toBeNull()
  })

  it('marks the incident gallery apart from the ordinary evidence', () => {
    const photos: DemoPhoto[] = [
      photo({ id: 'i1', section_key: 'incidents', slot_key: 'photo', lat: 51.777, lng: 9.381 }),
      photo({ id: 'm1', section_key: 'dp', slot_key: 'fiber_dp', lat: 51.776, lng: 9.379 }),
    ]
    const { points } = buildCaptureMapData(SOPLADO_RA_PLAN, {}, photos)

    const byKind = Object.fromEntries(points.map((point) => [point.kind, point.sectionKey]))
    expect(byKind).toEqual({ incident: 'incidents', slot: 'dp' })
  })

  it('ignores photos with no coordinates at all', () => {
    const photos: DemoPhoto[] = [photo({ id: 'm1', section_key: 'dp', slot_key: 'fiber_dp' })]
    expect(buildCaptureMapData(SOPLADO_RA_PLAN, {}, photos).points).toEqual([])
  })

  it('draws nothing for a plan without geolocated capture', () => {
    const photos: DemoPhoto[] = [
      photo({ id: 'p1', section_key: 'photos', slot_key: 'before', lat: 51.0, lng: 9.0 }),
    ]
    const { points, route } = buildCaptureMapData(DEFAULT_CAPTURE_PLANS.alta, {}, photos)

    // The default plans have no repeater and no geopoint field, but a located
    // photo still places its section — that is evidence too.
    expect(points.map((point) => point.kind)).toEqual(['slot'])
    expect(route).toEqual([])
  })

  it('has nothing to frame without a plan', () => {
    expect(buildCaptureMapData(null, trenchAnswers(), [])).toEqual({
      points: [],
      route: [],
      unlocatedTrenches: 0,
      bounds: null,
    })
  })

  it('frames every point', () => {
    expect(
      boundsOf([
        { lat: 51.0, lng: 9.5 },
        { lat: 52.0, lng: 9.1 },
      ]),
    ).toEqual([
      [9.1, 51.0],
      [9.5, 52.0],
    ])
    expect(boundsOf([])).toBeNull()
  })
})
