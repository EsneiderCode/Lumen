// The NEXUS basemap style for MapLibre.
//
// TILES — self-hosted. A single PMTiles archive in our own Supabase Storage
// bucket, served straight to the browser over HTTP range requests. No API key,
// no quota, no third-party host that can take the map down.
//
// That last point is the whole reason this file changed. The map used to read
// from OpenFreeMap, which is free and unlimited but is run by one person on
// donations and states plainly that it offers no SLA. When it is unreachable —
// no signal, an ad blocker, a corporate DNS — every tile request fails and the
// map renders as a flat coloured rectangle with the pins floating on it. That
// happened, and nothing in the app said why (see NexusMap's error handling).
//
// Self-hosting sounded expensive and is not: `pmtiles extract` clips a bounding
// box out of the 128 GB remote planet build over range requests, without
// downloading it. The Roßdorf work area is 3.5 MB and takes 11 seconds. All the
// project towns together are tens of megabytes. See scripts/build-basemap.sh.
//
// SCHEMA — Protomaps basemaps v4, NOT OpenMapTiles. The layer names and fields
// are different (`roads` not `transportation`, `kind` not `class`), so this
// style only works against a Protomaps archive: pointing VITE_MAP_TILES_URL at
// an OpenMapTiles endpoint renders an empty map, which is exactly the failure
// this file exists to avoid. Full schema: https://docs.protomaps.com/basemaps/layers
//
// COLORS — read from the live CSS custom properties, never hardcoded. That is
// what keeps the basemap inside the design system and makes it follow the
// light/dark switch (`[data-theme="light"]` in index.css) for free. A raster
// basemap could not do this; only a vector style can be repainted, which is why
// MapLibre + vector tiles was the choice and not Leaflet + raster.

import type { StyleSpecification } from 'maplibre-gl'

/**
 * The basemap lives in the same Supabase project as everything else, so both
 * URLs derive from the one credential the app already has. Each environment
 * therefore gets its own bucket for free, and the explicit overrides remain the
 * single switch for moving to another provider — the reason they exist.
 */
const BUCKET = 'basemap'
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const bucketUrl = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}` : ''

/**
 * `pmtiles://` is resolved by the protocol NexusMap registers; MapLibre cannot
 * read a PMTiles archive on its own.
 */
export const TILE_URL =
  import.meta.env.VITE_MAP_TILES_URL || (bucketUrl ? `pmtiles://${bucketUrl}/de-zonas.pmtiles` : '')

export const GLYPHS_URL =
  import.meta.env.VITE_MAP_GLYPHS_URL ||
  (bucketUrl ? `${bucketUrl}/fonts/{fontstack}/{range}.pbf` : '')

/** ODbL requires it; Protomaps asks for its own line next to it. */
export const MAP_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

/** The only font stack we ship glyphs for. */
const LABEL_FONT = ['Noto Sans Regular']

/** Live value of a NEXUS token, with the dark-theme default as fallback. */
export function nexusToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Label text: German name first — this is a German field tool — then the default. */
const NAME_FIELD = ['coalesce', ['get', 'name:de'], ['get', 'name']] as unknown as string

export function buildNexusMapStyle(): StyleSpecification {
  const bg0 = nexusToken('--color-bg-0', '#07080A')
  const bg1 = nexusToken('--color-bg-1', '#0E1014')
  const bg2 = nexusToken('--color-bg-2', '#161920')
  const bg3 = nexusToken('--color-bg-3', '#1D2029')
  const bg4 = nexusToken('--color-bg-4', '#262A34')
  const fg2 = nexusToken('--color-fg-2', '#B9BAB4')
  const fg3 = nexusToken('--color-fg-3', '#7B7D7A')
  const fg4 = nexusToken('--color-fg-4', '#4A4C50')

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      protomaps: {
        type: 'vector',
        url: TILE_URL,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': bg0 } },
      // Land. Drawn explicitly so a half-loaded archive still reads as a map
      // rather than as the void the background layer would otherwise leave.
      {
        id: 'earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': bg0 },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'residential', 'commercial', 'industrial', 'park', 'cemetery'],
        paint: { 'fill-color': bg1 },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landcover',
        filter: ['in', 'kind', 'forest', 'grassland', 'farmland', 'scrub'],
        paint: { 'fill-color': bg1 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': bg2 },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 14,
        paint: { 'fill-color': bg2, 'fill-outline-color': bg3 },
      },
      // `minor_road` carries the residential streets a trench actually sits on,
      // so it is the one road layer that must survive to the highest zooms.
      {
        id: 'road-minor',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'minor_road', 'path'],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': bg4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 6],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'major_road'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': fg4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 18, 10],
        },
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'highway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': fg3,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 18, 12],
        },
      },
      {
        id: 'railway',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'rail'],
        minzoom: 11,
        paint: { 'line-color': bg4, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'boundaries',
        filter: ['in', 'kind', 'country', 'region'],
        paint: { 'line-color': fg4, 'line-width': 0.8, 'line-dasharray': [2, 2] },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 14,
        layout: {
          'text-field': NAME_FIELD,
          'text-font': LABEL_FONT,
          'text-size': 11,
          'symbol-placement': 'line',
        },
        paint: { 'text-color': fg3, 'text-halo-color': bg0, 'text-halo-width': 1.2 },
      },
      // Towns and neighbourhoods. In this schema a city, a town and a village
      // are all `locality`, told apart by `kind_detail` — which is why there is
      // no list of settlement sizes to filter on here.
      {
        id: 'place-label',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        filter: ['in', 'kind', 'locality', 'neighbourhood', 'macrohood'],
        layout: {
          'text-field': NAME_FIELD,
          'text-font': LABEL_FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
        },
        paint: { 'text-color': fg2, 'text-halo-color': bg0, 'text-halo-width': 1.5 },
      },
    ],
  } as StyleSpecification
}
