import { describe, expect, it } from 'vitest'
import { parsePhotoMetadata } from '@/lib/exif'

/**
 * Builds a minimal JPEG carrying an EXIF block. Only the head matters — the
 * parser never reaches the image data — so the file is APP1 followed by a
 * start-of-scan marker.
 */
function jpegWithExif(options: {
  little?: boolean
  gps?: { latRef: string; lat: [number, number, number]; lngRef: string; lng: [number, number, number]; error?: number }
  dateTimeOriginal?: string
  offsetTimeOriginal?: string
}): ArrayBuffer {
  const little = options.little ?? true
  const body = new Uint8Array(1024)
  const view = new DataView(body.buffer)

  const ascii = (text: string) => {
    const bytes = new Uint8Array(text.length + 1)
    for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i)
    return bytes
  }

  // Data area grows from the end of the three IFDs.
  const IFD0 = 8
  const EXIF_IFD = 38
  const GPS_IFD = 68
  let cursor = 140
  const put = (bytes: Uint8Array): number => {
    const at = cursor
    body.set(bytes, at)
    cursor += bytes.length
    return at
  }
  const putRationals = (values: number[]): number => {
    const at = cursor
    for (const value of values) {
      view.setUint32(cursor, Math.round(value * 1000), little)
      view.setUint32(cursor + 4, 1000, little)
      cursor += 8
    }
    return at
  }

  // TIFF header
  view.setUint16(0, little ? 0x4949 : 0x4d4d)
  view.setUint16(2, 0x002a, little)
  view.setUint32(4, IFD0, little)

  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(at, tag, little)
    view.setUint16(at + 2, type, little)
    view.setUint32(at + 4, count, little)
    view.setUint32(at + 8, value, little)
  }
  /** ASCII short enough to live inline in the entry's four value bytes. */
  const inlineAscii = (at: number, tag: number, text: string) => {
    view.setUint16(at, tag, little)
    view.setUint16(at + 2, 2, little)
    view.setUint32(at + 4, text.length + 1, little)
    body.set(ascii(text), at + 8)
  }

  // Values first, so the IFD entries can point at them.
  const dateAt = options.dateTimeOriginal ? put(ascii(options.dateTimeOriginal)) : 0
  const offsetAt = options.offsetTimeOriginal ? put(ascii(options.offsetTimeOriginal)) : 0
  const latAt = options.gps ? putRationals(options.gps.lat) : 0
  const lngAt = options.gps ? putRationals(options.gps.lng) : 0
  const errorAt = options.gps?.error !== undefined ? putRationals([options.gps.error]) : 0

  // IFD0 → pointers to the two sub-IFDs.
  view.setUint16(IFD0, 2, little)
  entry(IFD0 + 2, 0x8769, 4, 1, EXIF_IFD)
  entry(IFD0 + 14, 0x8825, 4, 1, GPS_IFD)
  view.setUint32(IFD0 + 26, 0, little)

  // Exif sub-IFD
  view.setUint16(EXIF_IFD, 2, little)
  entry(EXIF_IFD + 2, 0x9003, 2, options.dateTimeOriginal ? options.dateTimeOriginal.length + 1 : 0, dateAt)
  entry(EXIF_IFD + 14, 0x9011, 2, options.offsetTimeOriginal ? options.offsetTimeOriginal.length + 1 : 0, offsetAt)
  view.setUint32(EXIF_IFD + 26, 0, little)

  // GPS sub-IFD. The error tag is written only when asked for: a camera that
  // has no accuracy figure omits the tag entirely rather than writing a zero.
  const gpsEntries = options.gps ? (options.gps.error !== undefined ? 5 : 4) : 0
  view.setUint16(GPS_IFD, gpsEntries, little)
  if (options.gps) {
    inlineAscii(GPS_IFD + 2, 0x0001, options.gps.latRef)
    entry(GPS_IFD + 14, 0x0002, 5, 3, latAt)
    inlineAscii(GPS_IFD + 26, 0x0003, options.gps.lngRef)
    entry(GPS_IFD + 38, 0x0004, 5, 3, lngAt)
    if (options.gps.error !== undefined) entry(GPS_IFD + 50, 0x001f, 5, 1, errorAt)
  }
  view.setUint32(GPS_IFD + 2 + gpsEntries * 12, 0, little)

  const tiff = body.slice(0, cursor)
  const app1Length = 2 + 6 + tiff.length
  const file = new Uint8Array(2 + 2 + app1Length + 2)
  const fileView = new DataView(file.buffer)
  fileView.setUint16(0, 0xffd8) // SOI
  fileView.setUint16(2, 0xffe1) // APP1
  fileView.setUint16(4, app1Length)
  file.set(ascii('Exif').slice(0, 4), 6)
  file[10] = 0x00
  file[11] = 0x00
  file.set(tiff, 12)
  fileView.setUint16(file.length - 2, 0xffda) // SOS
  return file.buffer
}

describe('EXIF metadata of a picked photo', () => {
  it('reads the GPS position the camera wrote', () => {
    const buffer = jpegWithExif({
      gps: { latRef: 'N', lat: [51, 13, 39.7], lngRef: 'E', lng: [6, 46, 24.6], error: 8 },
    })

    const { point } = parsePhotoMetadata(buffer)
    expect(point?.lat).toBeCloseTo(51.2277, 3)
    expect(point?.lng).toBeCloseTo(6.7735, 3)
    expect(point?.accuracy_m).toBeCloseTo(8, 3)
  })

  it('honours the hemisphere refs', () => {
    const buffer = jpegWithExif({
      gps: { latRef: 'S', lat: [33, 26, 0], lngRef: 'W', lng: [70, 39, 0] },
    })

    const { point } = parsePhotoMetadata(buffer)
    expect(point?.lat).toBeCloseTo(-33.4333, 3)
    expect(point?.lng).toBeCloseTo(-70.65, 3)
    // No GPSHPositioningError tag: nothing is invented.
    expect(point?.accuracy_m).toBeNull()
  })

  it('reads big-endian files too', () => {
    const buffer = jpegWithExif({
      little: false,
      gps: { latRef: 'N', lat: [51, 13, 39.7], lngRef: 'E', lng: [6, 46, 24.6] },
    })

    expect(parsePhotoMetadata(buffer).point?.lat).toBeCloseTo(51.2277, 3)
  })

  it('takes the timestamp from the camera, with its UTC offset when present', () => {
    const buffer = jpegWithExif({
      dateTimeOriginal: '2026:07:25 14:03:11',
      offsetTimeOriginal: '+02:00',
    })

    expect(parsePhotoMetadata(buffer).takenAt).toBe('2026-07-25T12:03:11.000Z')
  })

  it('treats a timestamp without offset as local time', () => {
    const buffer = jpegWithExif({ dateTimeOriginal: '2026:07:25 14:03:11' })
    const expected = new Date(2026, 6, 25, 14, 3, 11).toISOString()

    expect(parsePhotoMetadata(buffer).takenAt).toBe(expected)
  })

  it('returns nothing rather than throwing on a file with no EXIF', () => {
    // A bare JPEG: SOI straight into the scan.
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])
    expect(parsePhotoMetadata(bare.buffer)).toEqual({ point: null, takenAt: null })
    expect(parsePhotoMetadata(new Uint8Array([1, 2, 3]).buffer)).toEqual({
      point: null,
      takenAt: null,
    })
  })

  it('rejects the null island, which is a camera writing tags without a fix', () => {
    const buffer = jpegWithExif({
      gps: { latRef: 'N', lat: [0, 0, 0], lngRef: 'E', lng: [0, 0, 0] },
    })

    expect(parsePhotoMetadata(buffer).point).toBeNull()
  })
})
