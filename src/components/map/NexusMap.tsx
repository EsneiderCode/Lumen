// The one place in the app that knows MapLibre exists.
//
// Everything else passes plain points and gets clicks back, so the map library
// stays swappable and — more importantly — stays OUT of the technician's
// bundle: it is ~200 KB gzip and is always mounted through React.lazy, only
// once someone actually opens a map.
//
// Two jobs, one component:
//   - READ: numbered trench pins + the dashed route between them (admin order
//     detail, where the map is worth having);
//   - EDIT: a single draggable pin, for correcting the automatic GPS fix of a
//     trench from the technician's form.
//
// Default export on purpose: that is what React.lazy() wants.

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSourceSpecification,
  type GeoJSONSource,
  type LngLatBoundsLike,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 resolves its worker from `import.meta.url` at runtime, which no
// bundler can see: the file is never emitted and the map renders an empty
// canvas with a silent 404 for maplibre-gl-worker.mjs. Handing Vite the worker
// explicitly makes it a real bundled chunk in dev and in the build alike.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { buildNexusMapStyle, nexusToken } from '@/lib/mapStyle'
import { boundsOf, type CaptureMapPoint } from '@/lib/captureMapPoints'

export interface NexusMapProps {
  points?: CaptureMapPoint[]
  /** Dashed line through the trenches, in capture order. */
  route?: Array<[number, number]>
  selectedId?: string | null
  onSelectPoint?: (pointId: string) => void
  /** Edit mode: the single pin the user drags. */
  draggable?: { lat: number; lng: number } | null
  onDragEnd?: (position: { lat: number; lng: number }) => void
  heightClass?: string
}

setWorkerUrl(maplibreWorkerUrl)

const ROUTE_SOURCE = 'capture-route'

/** Höxter — where the demo orders are; only used when there is nothing to frame. */
const FALLBACK_CENTER: [number, number] = [9.3811, 51.7773]

/**
 * The dashed line through the trenches, in capture order. Idempotent: it is
 * called on every style load, and a style load is what wipes it.
 */
function ensureRouteLayer(map: MapLibreMap, route: Array<[number, number]>) {
  const data: GeoJSONSourceSpecification['data'] = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: route },
  }

  const existing = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
  if (existing) {
    existing.setData(data)
    return
  }

  map.addSource(ROUTE_SOURCE, { type: 'geojson', data })
  map.addLayer({
    id: ROUTE_SOURCE,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': nexusToken('--color-accent', '#FF4D2E'),
      'line-width': 1.5,
      'line-dasharray': [2, 2],
      'line-opacity': 0.7,
    },
  })
}

function markerElement(point: CaptureMapPoint, selected: boolean): HTMLElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = [
    'flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] font-semibold',
    'transition-colors duration-200',
    point.kind === 'incident'
      ? 'border-warn bg-warn text-ink'
      : selected
        ? 'border-fg-1 bg-accent text-ink'
        : 'border-accent bg-bg-1 text-accent',
  ].join(' ')
  element.textContent = point.index !== null ? String(point.index) : point.kind === 'incident' ? '!' : '◎'
  return element
}

export default function NexusMap({
  points = [],
  route = [],
  selectedId = null,
  onSelectPoint,
  draggable = null,
  onDragEnd,
  heightClass = 'h-72',
}: NexusMapProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const pinRef = useRef<Marker | null>(null)
  // Read back when a style reload has to rebuild the route layer.
  const routeRef = useRef(route)
  // Read inside the marker's own drag callback, which is registered once and
  // must not close over a stale prop.
  const onDragEndRef = useRef(onDragEnd)
  useEffect(() => {
    onDragEndRef.current = onDragEnd
  }, [onDragEnd])

  // Create once. Recreating a GL map on every render is what makes map screens
  // feel broken, so nothing but unmount tears it down.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildNexusMapStyle(),
      center: FALLBACK_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
      // A map inside a scrolling form must not eat the page scroll.
      scrollZoom: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    // Fires on the first style and on every repaint after a theme switch, which
    // is when the route layer has to be put back: setStyle drops custom layers.
    map.on('styledata', () => ensureRouteLayer(map, routeRef.current))
    mapRef.current = map

    // The app switches between the NEXUS light and dark palettes at runtime
    // (data-theme on <html>). A vector basemap can follow — that is the whole
    // reason this is MapLibre and not a raster tile layer.
    const observer = new MutationObserver(() => map.setStyle(buildNexusMapStyle()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      // Both belong to the map that just died. Keeping them would make the next
      // mount (StrictMode does one immediately) reuse markers attached to a
      // destroyed map — which is a pin that never appears.
      markersRef.current = []
      pinRef.current = null
    }
  }, [])

  // Pins + route. Markers are plain DOM, so they inherit the NEXUS tokens
  // instead of needing a sprite sheet hosted somewhere.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = points.map((point) => {
      const element = markerElement(point, point.id === selectedId)
      element.addEventListener('click', () => onSelectPoint?.(point.id))
      element.title = t(point.labelKey, { defaultValue: point.sectionKey })
      return new Marker({ element }).setLngLat([point.lng, point.lat]).addTo(map)
    })

    routeRef.current = route
    if (map.isStyleLoaded()) ensureRouteLayer(map, route)
  }, [points, route, selectedId, onSelectPoint, t])

  // Frame whatever there is to see: every pin, or the single editable one.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (draggable) {
      map.easeTo({ center: [draggable.lng, draggable.lat], zoom: Math.max(map.getZoom(), 17) })
      return
    }

    const bounds = boundsOf(points)
    if (!bounds) return
    const [[west, south], [east, north]] = bounds
    if (west === east && south === north) {
      map.easeTo({ center: [west, south], zoom: 17 })
      return
    }
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 48, maxZoom: 18, duration: 300 })
  }, [points, draggable])

  // The correctable pin.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!draggable) {
      pinRef.current?.remove()
      pinRef.current = null
      return
    }

    if (!pinRef.current) {
      const element = document.createElement('div')
      element.className =
        'h-5 w-5 rounded-full border-2 border-accent bg-bg-1 ring-2 ring-accent/40'
      const marker = new Marker({ element, draggable: true })
        .setLngLat([draggable.lng, draggable.lat])
        .addTo(map)
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat()
        onDragEndRef.current?.({ lat, lng })
      })
      pinRef.current = marker
      return
    }

    pinRef.current.setLngLat([draggable.lng, draggable.lat])
  }, [draggable])

  return (
    <div
      ref={containerRef}
      className={`nx-map ${heightClass} w-full overflow-hidden rounded-l border border-line`}
      aria-label={t('map.label')}
    />
  )
}
