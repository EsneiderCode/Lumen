// Leer las coordenadas que el técnico copia de la marca de agua de una foto.
//
// Las cámaras de campo (GPS Map Camera y compañía) queman la posición sobre la
// imagen, y esa marca es hoy la única fuente honesta: la galería y WhatsApp
// borran el EXIF, y el GPS del móvil, cuando se rellena la Rückmeldung, apunta
// al sofá del técnico y no a la cata.
//
// Así que se admite lo que la gente escribe de verdad, no un formato:
//   51.77685, 9.38042        · el caso normal
//   51,77685  9,38042        · coma decimal alemana
//   Lat 51.77685° Long 9.38042°
//   51°46'36.7"N 9°22'49.5"E · grados/minutos/segundos
//   10/07/2026 14:32 51.77685, 9.38042  · con la fecha de la marca pegada
//
// La última es la razón de la heurística de abajo: si hay más de dos números,
// mandan los que llevan decimales — una coordenada de marca de agua siempre los
// lleva, y una fecha nunca.
//
// Puro: se prueba en src/__tests__/geoCoordinates.test.ts sin montar nada.

import type { CaptureGeoPoint } from '@/types/capture-plan'

/** Números sueltos con su parte decimal opcional; la coma cuenta como punto. */
const NUMBER = /-?\d+(?:[.,]\d+)?/g

/** 51°46'36.7" con el hemisferio pegado o no. Los segundos son opcionales. */
const DMS = /(\d+)\s*[°º]\s*(\d+)\s*['′`]\s*(?:(\d+(?:[.,]\d+)?)\s*["″'']?)?\s*([NSEWO])?/gi

/** N/S para la latitud, E/O/W para la longitud — «O» de Ost en las marcas alemanas. */
const NORTH_SOUTH = /(?:^|[^a-z])([NS])(?![a-z])/i
const EAST_WEST = /(?:^|[^a-z])([EWO])(?![a-z])/i

const toNumber = (raw: string): number => Number(raw.replace(',', '.'))

const inLatRange = (value: number) => Number.isFinite(value) && Math.abs(value) <= 90
const inLngRange = (value: number) => Number.isFinite(value) && Math.abs(value) <= 180

function signed(value: number, text: string, pattern: RegExp, negative: string): number {
  const letter = text.match(pattern)?.[1]?.toUpperCase()
  const magnitude = Math.abs(value)
  return letter === negative ? -magnitude : letter ? magnitude : value
}

/** Grados + minutos + segundos → grados decimales. */
function fromDms(text: string): [number, number] | null {
  const parts = [...text.matchAll(DMS)]
  if (parts.length < 2) return null

  const degrees = parts.slice(0, 2).map((part) => {
    const value = Number(part[1]) + Number(part[2]) / 60 + (part[3] ? toNumber(part[3]) / 3600 : 0)
    const hemisphere = part[4]?.toUpperCase()
    return hemisphere === 'S' || hemisphere === 'W' ? -value : value
  })

  return [degrees[0], degrees[1]]
}

/**
 * Lo que haya escrito, convertido en un punto — o null si no se entiende, que
 * es una respuesta legítima: la pantalla se lo dice y no escribe nada.
 *
 * Un punto tecleado a mano no lleva radio de error: `accuracy_m` se queda en
 * null a propósito, igual que en un pin puesto sobre el mapa. Inventarle una
 * precisión sería mentir sobre de dónde salió.
 */
export function parseCoordinates(input: string): CaptureGeoPoint | null {
  const text = input.trim()
  if (!text) return null

  let pair = fromDms(text)

  if (!pair) {
    const tokens = [...text.matchAll(NUMBER)].map((match) => match[0])
    // Con decimales primero: en «10/07/2026 14:32 51.77685, 9.38042» descarta
    // la fecha y la hora sin tener que entenderlas.
    const decimals = tokens.filter((token) => /[.,]/.test(token))
    const chosen = decimals.length === 2 ? decimals : tokens
    if (chosen.length < 2) return null
    pair = [toNumber(chosen[0]), toNumber(chosen[1])]
  }

  let [lat, lng] = pair
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // Escritas al revés (longitud primero): solo se puede afirmar cuando la
  // primera no cabe como latitud y la segunda sí.
  if (!inLatRange(lat) && inLatRange(lng) && inLngRange(lat)) {
    ;[lat, lng] = [lng, lat]
  }

  lat = signed(lat, text, NORTH_SOUTH, 'S')
  lng = signed(lng, text, EAST_WEST, 'W')

  if (!inLatRange(lat) || !inLngRange(lng)) return null
  if (lat === 0 && lng === 0) return null

  return { lat, lng, accuracy_m: null }
}

/** Como se le enseña de vuelta y como se copia al portapapeles. */
export function formatCoordinates(point: CaptureGeoPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
}
