// The NEXUS basemap style for MapLibre.
//
// TILES — free, no account, no key: OpenFreeMap (https://openfreemap.org),
// OpenStreetMap data in the OpenMapTiles schema, explicitly free for commercial
// use with attribution. It is the only provider evaluated that costs nothing
// recurring AND needs no signup: MapTiler's free tier caps loads and needs a
// key, CARTO's free tier is non-commercial (HMR Nexus is a company), and
// self-hosted Protomaps means uploading a ~1.5 GB extract before anything
// renders. Everything here is driven by one URL, so switching provider later is
// a single env var: VITE_MAP_TILES_URL (a TileJSON endpoint) — nothing else in
// the app knows where tiles come from.
//
// COLORS — read from the live CSS custom properties, never hardcoded. That is
// what keeps the basemap inside the design system and makes it follow the
// light/dark switch (`[data-theme="light"]` in index.css) for free. A raster
// basemap could not do this; only a vector style can be repainted, which is why
// MapLibre + vector tiles was the choice and not Leaflet + raster.

import type { StyleSpecification } from 'maplibre-gl'

const TILE_JSON_URL = import.meta.env.VITE_MAP_TILES_URL || 'https://tiles.openfreemap.org/planet'
const GLYPHS_URL =
  import.meta.env.VITE_MAP_GLYPHS_URL || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

/** ODbL requires it, and OpenFreeMap asks for its own line next to it. */
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

/** The only font stack OpenFreeMap serves glyphs for. */
const LABEL_FONT = ['Noto Sans Regular']

/** Live value of a NEXUS token, with the dark-theme default as fallback. */
export function nexusToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Label text: German name first — this is a German field tool — then latin. */
const NAME_FIELD = [
  'coalesce',
  ['get', 'name:de'],
  ['get', 'name:latin'],
  ['get', 'name'],
] as unknown as string

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
      openmaptiles: {
        type: 'vector',
        url: TILE_JSON_URL,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': bg0 } },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', 'class', 'residential', 'commercial', 'industrial'],
        paint: { 'fill-color': bg1 },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'grass', 'farmland'],
        paint: { 'fill-color': bg1 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': bg2 },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': bg2, 'fill-outline-color': bg3 },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track', 'path'],
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
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': fg4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 18, 10],
        },
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': fg3,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 18, 12],
        },
      },
      {
        id: 'railway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'],
        minzoom: 11,
        paint: { 'line-color': bg4, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', 'admin_level', 4],
        paint: { 'line-color': fg4, 'line-width': 0.8, 'line-dasharray': [2, 2] },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'text-field': NAME_FIELD,
          'text-font': LABEL_FONT,
          'text-size': 11,
          'symbol-placement': 'line',
        },
        paint: { 'text-color': fg3, 'text-halo-color': bg0, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village', 'suburb', 'neighbourhood'],
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
