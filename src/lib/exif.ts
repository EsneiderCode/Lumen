// Where and when a photo was taken, read from the file itself.
//
// The app is used AFTER the job, not during it: the technician picks the photos
// from the gallery in the evening. So the device's position at upload time is
// not where the work happened — asking `navigator.geolocation` here would stamp
// every trench with the technician's living room. The only honest source is the
// photo's own EXIF block, written by the camera at the moment of the shot.
//
// Two caveats that shape the callers:
//   - Phones strip EXIF often. iOS asks whether to include location when a photo
//     leaves the Photos app, and "no" is the default in several flows; Android's
//     picker does the same. A null result is therefore NORMAL, not an error, and
//     the technician places the pin by hand instead.
//   - `scalePhotoForUpload()` re-encodes through a canvas, which drops EXIF.
//     Metadata must be read from the ORIGINAL file, before scaling.
//
// Only the four tags that matter are parsed (GPS position, its error radius and
// the original timestamp). A malformed or absent block returns nulls; this never
// throws, because a photo that cannot be dated must still be uploadable.

import type { CaptureGeoPoint } from '@/types/capture-plan'

export interface PhotoMetadata {
  /** From the EXIF GPS block. Null when the photo carries no position. */
  point: CaptureGeoPoint | null
  /** ISO string from DateTimeOriginal, honouring OffsetTimeOriginal when present. */
  takenAt: string | null
}

const EMPTY: PhotoMetadata = { point: null, takenAt: null }

/** EXIF lives in the first APP1 segment; 256 KB is far past any header. */
const HEAD_BYTES = 256 * 1024

const TAG = {
  EXIF_IFD: 0x8769,
  GPS_IFD: 0x8825,
  DATE_TIME_ORIGINAL: 0x9003,
  OFFSET_TIME_ORIGINAL: 0x9011,
  GPS_LAT_REF: 0x0001,
  GPS_LAT: 0x0002,
  GPS_LNG_REF: 0x0003,
  GPS_LNG: 0x0004,
  GPS_H_ERROR: 0x001f,
} as const

interface Reader {
  view: DataView
  /** Start of the TIFF header — every offset in the block is relative to it. */
  tiff: number
  little: boolean
}

function u16(r: Reader, offset: number): number {
  return r.view.getUint16(offset, r.little)
}

function u32(r: Reader, offset: number): number {
  return r.view.getUint32(offset, r.little)
}

/** An EXIF rational: two uint32, numerator over denominator. */
function rational(r: Reader, offset: number): number {
  const numerator = u32(r, offset)
  const denominator = u32(r, offset + 4)
  return denominator === 0 ? 0 : numerator / denominator
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

interface Entry {
  type: number
  count: number
  /** Absolute offset of the value: inline when it fits in four bytes. */
  valueOffset: number
}

/** Every entry of one IFD, keyed by tag. Returns an empty map on anything odd. */
function readIfd(r: Reader, ifdOffset: number): Map<number, Entry> {
  const entries = new Map<number, Entry>()
  const base = r.tiff + ifdOffset
  if (base + 2 > r.view.byteLength) return entries

  const count = u16(r, base)
  for (let index = 0; index < count; index += 1) {
    const entry = base + 2 + index * 12
    if (entry + 12 > r.view.byteLength) break

    const tag = u16(r, entry)
    const type = u16(r, entry + 2)
    const valueCount = u32(r, entry + 4)
    const size = (TYPE_SIZE[type] ?? 0) * valueCount
    const valueOffset = size > 4 ? r.tiff + u32(r, entry + 8) : entry + 8
    entries.set(tag, { type, count: valueCount, valueOffset })
  }
  return entries
}

function asciiOf(r: Reader, entry: Entry | undefined): string | null {
  if (!entry || entry.type !== 2 || entry.count === 0) return null
  const end = entry.valueOffset + entry.count
  if (end > r.view.byteLength) return null

  let text = ''
  for (let offset = entry.valueOffset; offset < end; offset += 1) {
    const code = r.view.getUint8(offset)
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text.trim() || null
}

/** Degrees/minutes/seconds as three rationals → signed decimal degrees. */
function degreesOf(r: Reader, entry: Entry | undefined, ref: string | null): number | null {
  if (!entry || entry.count < 3) return null
  if (entry.valueOffset + 24 > r.view.byteLength) return null

  const degrees = rational(r, entry.valueOffset)
  const minutes = rational(r, entry.valueOffset + 8)
  const seconds = rational(r, entry.valueOffset + 16)
  const value = degrees + minutes / 60 + seconds / 3600
  if (!Number.isFinite(value)) return null

  const negative = ref === 'S' || ref === 'W'
  return negative ? -value : value
}

/**
 * "2026:07:27 14:03:11" (+ optional "+02:00") → ISO. Without an offset the
 * timestamp is read as local time, which is right in practice: the phone that
 * took the photo and the browser uploading it are in the same country.
 */
function isoOf(stamp: string | null, offset: string | null): string | null {
  if (!stamp) return null
  const match = stamp.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null

  const [, year, month, day, hour, minute, second] = match
  const zone = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null
  const date = zone
    ? new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`)
    : new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      )

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Offset of the TIFF header inside a JPEG, or -1 when there is no EXIF block. */
function findTiffHeader(view: DataView): number {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return -1

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return -1
    const marker = view.getUint8(offset + 1)
    // Start of scan: image data begins, no more metadata segments.
    if (marker === 0xda) return -1

    const length = view.getUint16(offset + 2)
    if (length < 2) return -1

    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      // "Exif\0\0" then the TIFF header.
      const isExif =
        view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0x0000
      if (isExif) return offset + 10
    }
    offset += 2 + length
  }
  return -1
}

export function parsePhotoMetadata(buffer: ArrayBuffer): PhotoMetadata {
  try {
    const view = new DataView(buffer)
    const tiff = findTiffHeader(view)
    if (tiff < 0 || tiff + 8 > view.byteLength) return EMPTY

    const byteOrder = view.getUint16(tiff)
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return EMPTY
    const r: Reader = { view, tiff, little: byteOrder === 0x4949 }
    if (u16(r, tiff + 2) !== 0x002a) return EMPTY

    const ifd0 = readIfd(r, u32(r, tiff + 4))

    let takenAt: string | null = null
    const exifPointer = ifd0.get(TAG.EXIF_IFD)
    if (exifPointer) {
      const exif = readIfd(r, u32(r, exifPointer.valueOffset))
      takenAt = isoOf(
        asciiOf(r, exif.get(TAG.DATE_TIME_ORIGINAL)),
        asciiOf(r, exif.get(TAG.OFFSET_TIME_ORIGINAL)),
      )
    }

    let point: CaptureGeoPoint | null = null
    const gpsPointer = ifd0.get(TAG.GPS_IFD)
    if (gpsPointer) {
      const gps = readIfd(r, u32(r, gpsPointer.valueOffset))
      const lat = degreesOf(r, gps.get(TAG.GPS_LAT), asciiOf(r, gps.get(TAG.GPS_LAT_REF)))
      const lng = degreesOf(r, gps.get(TAG.GPS_LNG), asciiOf(r, gps.get(TAG.GPS_LNG_REF)))
      if (
        lat !== null &&
        lng !== null &&
        // 0/0 is the null island: a camera that wrote the tags without a fix.
        !(lat === 0 && lng === 0) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        const errorEntry = gps.get(TAG.GPS_H_ERROR)
        const accuracy =
          errorEntry && errorEntry.type === 5 && errorEntry.valueOffset + 8 <= view.byteLength
            ? rational(r, errorEntry.valueOffset)
            : 0
        point = { lat, lng, accuracy_m: accuracy > 0 ? accuracy : null }
      }
    }

    return { point, takenAt }
  } catch {
    // A truncated or exotic file is not worth failing an upload over.
    return EMPTY
  }
}

/**
 * Metadata of a picked file. Falls back to the file's own modification time,
 * which the gallery preserves and which beats "whenever it was uploaded".
 */
export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  let parsed = EMPTY
  try {
    parsed = parsePhotoMetadata(await file.slice(0, HEAD_BYTES).arrayBuffer())
  } catch {
    parsed = EMPTY
  }

  if (parsed.takenAt) return parsed
  const modified = file.lastModified ? new Date(file.lastModified) : null
  return {
    point: parsed.point,
    takenAt: modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null,
  }
}
