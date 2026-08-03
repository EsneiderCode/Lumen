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

  // A style written against one schema and pointed at another renders a blank
  // map — the exact silent failure this basemap was self-hosted to end. These
  // are the Protomaps basemaps v4 layer names; OpenMapTiles has none of them.
  it('only reads layers that exist in the Protomaps schema', () => {
    const known = new Set([
      'earth',
      'water',
      'landuse',
      'landcover',
      'roads',
      'buildings',
      'boundaries',
      'places',
      'transit',
      'pois',
    ])

    for (const layer of style.layers) {
      if (layer.type === 'background') continue
      expect([...known], layer.id).toContain((layer as { 'source-layer': string })['source-layer'])
    }
  })

  // Same trap, one level down: in this schema roads are told apart by `kind`,
  // not by OpenMapTiles' `class`, and every value below is a real `kind`.
  it('filters roads by the schema kinds, not by OpenMapTiles classes', () => {
    const roadKinds = style.layers
      .filter((layer) => (layer as { 'source-layer'?: string })['source-layer'] === 'roads')
      .map((layer) => (layer as { filter?: unknown[] }).filter)
      .filter(Boolean)
      .flatMap((filter) => (filter as unknown[]).slice(2) as string[])

    expect(roadKinds.length).toBeGreaterThan(0)
    for (const kind of roadKinds) {
      expect(['highway', 'major_road', 'minor_road', 'path', 'rail', 'ferry', 'pier']).toContain(
        kind,
      )
    }
  })

  // ODbL is not optional, and Protomaps asks for its own line next to it.
  it('carries the OpenStreetMap attribution on the source', () => {
    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap')
    expect(MAP_ATTRIBUTION).toContain('Protomaps')
    expect((style.sources.protomaps as { attribution?: string }).attribution).toBe(MAP_ATTRIBUTION)
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
