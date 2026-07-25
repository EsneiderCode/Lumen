import { describe, expect, it } from 'vitest'
import { MAP_ATTRIBUTION, buildNexusMapStyle, nexusToken } from '@/lib/mapStyle'

describe('the NEXUS basemap style', () => {
  const style = buildNexusMapStyle()

  it('is a self-consistent MapLibre style', () => {
    expect(style.version).toBe(8)
    expect(style.glyphs).toContain('{fontstack}')

    const ids = style.layers.map((layer) => layer.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const layer of style.layers) {
      if (layer.type === 'background') continue
      expect(Object.keys(style.sources), layer.id).toContain((layer as { source: string }).source)
      // Everything but the background reads a vector layer of the tiles.
      expect((layer as { 'source-layer'?: string })['source-layer'], layer.id).toBeTruthy()
    }
  })

  // ODbL is not optional, and OpenFreeMap asks for its own line next to it.
  it('carries the OpenStreetMap attribution on the source', () => {
    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap')
    expect((style.sources.openmaptiles as { attribution?: string }).attribution).toBe(
      MAP_ATTRIBUTION,
    )
  })

  // The point of a vector basemap here: it is painted with the design tokens,
  // so it follows the light/dark switch instead of clashing with the UI.
  it('paints itself from the NEXUS tokens', () => {
    const background = style.layers.find((layer) => layer.id === 'background')
    expect((background as { paint: { 'background-color': string } }).paint['background-color']).toBe(
      nexusToken('--color-bg-0', '#07080A'),
    )
  })

  it('falls back to the dark palette when no token is defined', () => {
    expect(nexusToken('--color-does-not-exist', '#123456')).toBe('#123456')
  })
})
