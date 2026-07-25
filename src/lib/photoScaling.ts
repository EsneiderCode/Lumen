// Client-side downscaling before uploading a Rückmeldung photo.
//
// A phone camera file is ~4 MB. Thirty of them over rural 4G is not a slow
// upload, it is a failed one. Downscaling the long edge to 1920 px and
// re-encoding as JPEG lands each photo around 300–500 kB while staying far above
// what the certification dossier and the PDF need.
//
// Every failure path returns the original file: a photo that uploads big beats a
// photo that does not upload.

export const MAX_LONG_EDGE = 1920
export const JPEG_QUALITY = 0.75

/** Below this the re-encode is not worth the CPU on an old phone. */
const SKIP_BELOW_BYTES = 400_000

export interface ScaledPhoto {
  file: File
  /** False when the original was returned untouched. */
  scaled: boolean
}

function canScale(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof HTMLCanvasElement !== 'undefined'
  )
}

export async function scalePhotoForUpload(file: File): Promise<ScaledPhoto> {
  if (!file.type.startsWith('image/') || file.size <= SKIP_BELOW_BYTES || !canScale()) {
    return { file, scaled: false }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const ratio = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1
    const width = Math.round(bitmap.width * ratio)
    const height = Math.round(bitmap.height * ratio)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close?.()
      return { file, scaled: false }
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    // Re-encoding an already small or already-JPEG photo can come out bigger.
    if (!blob || blob.size >= file.size) return { file, scaled: false }

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return {
      file: new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified }),
      scaled: true,
    }
  } catch {
    return { file, scaled: false }
  }
}
