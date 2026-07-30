import { describe, expect, it } from 'vitest'
import { formatCoordinates, parseCoordinates } from '@/lib/geoCoordinates'

/** Höxter, donde ocurre el QFF de la demo. */
const POINT = { lat: 51.77685, lng: 9.38042 }

const near = (input: string) => {
  const parsed = parseCoordinates(input)
  expect(parsed, input).not.toBeNull()
  return parsed as { lat: number; lng: number; accuracy_m: number | null }
}

describe('parseCoordinates', () => {
  it('lee el par que escribe cualquiera', () => {
    for (const input of ['51.77685, 9.38042', '51.77685,9.38042', '51.77685 9.38042']) {
      expect(near(input)).toEqual({ ...POINT, accuracy_m: null })
    }
  })

  it('aguanta la coma decimal alemana', () => {
    expect(near('51,77685, 9,38042')).toEqual({ ...POINT, accuracy_m: null })
    expect(near('51,77685 9,38042')).toEqual({ ...POINT, accuracy_m: null })
  })

  it('ignora las etiquetas y los grados de la marca de agua', () => {
    expect(near('Lat 51.77685° Long 9.38042°')).toEqual({ ...POINT, accuracy_m: null })
    expect(near('51.77685° N, 9.38042° E')).toEqual({ ...POINT, accuracy_m: null })
  })

  it('descarta la fecha y la hora que la marca lleva pegadas', () => {
    // La heurística: entre más de dos números mandan los que llevan decimales,
    // y una coordenada de marca de agua siempre los lleva.
    expect(near('30/07/2026 14:32 51.77685, 9.38042')).toEqual({ ...POINT, accuracy_m: null })
  })

  it('entiende grados, minutos y segundos', () => {
    const parsed = near('51°46\'36.7"N 9°22\'49.5"E')
    expect(parsed.lat).toBeCloseTo(51.77686, 4)
    expect(parsed.lng).toBeCloseTo(9.38042, 4)
  })

  it('respeta el hemisferio', () => {
    expect(near('33.8688 S, 151.2093 E').lat).toBeLessThan(0)
    expect(near('40.7128 N, 74.0060 W').lng).toBeLessThan(0)
  })

  it('endereza el par escrito al revés cuando no cabe de otra forma', () => {
    // 120 no es una latitud posible; 48 sí es una longitud posible.
    expect(near('120.5, 48.2')).toEqual({ lat: 48.2, lng: 120.5, accuracy_m: null })
  })

  it('no inventa un punto con lo que no es un punto', () => {
    for (const input of ['', '   ', 'sin gps', '51.77685', '999.1, 8.2', '0, 0']) {
      expect(parseCoordinates(input), input).toBeNull()
    }
  })

  it('no le pone precisión a un punto tecleado a mano', () => {
    // Igual que un pin puesto sobre el mapa: inventarle un radio de error sería
    // mentir sobre de dónde salió.
    expect(near('51.77685, 9.38042').accuracy_m).toBeNull()
  })
})

describe('formatCoordinates', () => {
  it('vuelve a leerse igual que se escribió', () => {
    const text = formatCoordinates({ ...POINT, accuracy_m: null })

    expect(text).toBe('51.776850, 9.380420')
    expect(parseCoordinates(text)).toEqual({ ...POINT, accuracy_m: null })
  })
})
