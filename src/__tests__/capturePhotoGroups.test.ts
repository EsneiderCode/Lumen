import { describe, expect, it } from 'vitest'
import { buildCapturePhotoGroups, type GroupablePhoto } from '@/lib/capturePhotoGroups'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CaptureAnswers } from '@/types/capture-plan'

const photo = (over: Partial<GroupablePhoto> & { id: string }): GroupablePhoto => ({
  photo_type: 'after',
  section_key: null,
  item_id: null,
  ...over,
})

const answers: CaptureAnswers = {
  catas: [
    { id: 'c1', values: {} },
    { id: 'c2', values: {} },
  ],
}

describe('grouping the photos of an order', () => {
  it('puts everything of a place together and never mixes two trenches', () => {
    const groups = buildCapturePhotoGroups(SOPLADO_RA_PLAN, answers, [
      photo({ id: 'a', section_key: 'dp' }),
      photo({ id: 'b', section_key: 'dp' }),
      photo({ id: 'c', section_key: 'pop' }),
      photo({ id: 'd', section_key: 'catas', item_id: 'c1' }),
      photo({ id: 'e', section_key: 'catas', item_id: 'c1' }),
      photo({ id: 'f', section_key: 'catas', item_id: 'c2' }),
    ])

    expect(groups.map((group) => group.id)).toEqual([
      'dp',
      'pop',
      'catas:c1',
      'catas:c2',
    ])
    expect(groups.map((group) => group.photos.map((p) => p.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d', 'e'],
      ['f'],
    ])
  })

  // The whole point of the change: no photo may appear under two headings. It
  // used to be on screen twice — once in the by-phase gallery and again under
  // its own pin on the map.
  it('shows every photo exactly once', () => {
    const photos = [
      photo({ id: 'a', section_key: 'dp' }),
      photo({ id: 'b', section_key: 'catas', item_id: 'c1' }),
      photo({ id: 'c', section_key: null, photo_type: 'before' }),
    ]
    const seen = buildCapturePhotoGroups(SOPLADO_RA_PLAN, answers, photos).flatMap((group) =>
      group.photos.map((p) => p.id),
    )

    expect(seen).toHaveLength(photos.length)
    expect(new Set(seen).size).toBe(photos.length)
  })

  // Photos from before migration 052 carry no section. Dropping them would hide
  // evidence, so they keep their legacy bucket as a heading — and come last.
  it('falls back to the legacy bucket for photos the plan cannot place', () => {
    const groups = buildCapturePhotoGroups(SOPLADO_RA_PLAN, answers, [
      photo({ id: 'old1', photo_type: 'before' }),
      photo({ id: 'old2', photo_type: 'during' }),
      photo({ id: 'new', section_key: 'dp' }),
      // A section the pinned plan version no longer has: still not lost.
      photo({ id: 'gone', section_key: 'mandatory', photo_type: 'after' }),
    ])

    expect(groups.map((group) => group.id)).toEqual([
      'dp',
      'legacy:before',
      'legacy:during',
      'legacy:after',
    ])
    expect(groups.at(-1)?.photos.map((p) => p.id)).toEqual(['gone'])
    expect(groups[1].labelKey).toBe('photo.before')
  })

  it('numbers the trenches from one, as the technician sees them', () => {
    const groups = buildCapturePhotoGroups(SOPLADO_RA_PLAN, answers, [
      photo({ id: 'x', section_key: 'catas', item_id: 'c2' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].index).toBe(2)
    expect(groups[0].labelKey).toBe('capturePlan.sopladoRa.catas.item')
  })

  it('returns nothing when there is no plan to group by', () => {
    expect(buildCapturePhotoGroups(null, {}, [])).toEqual([])
  })
})
