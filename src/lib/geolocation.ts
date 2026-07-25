// One-shot geolocation, shaped as the plans store it.
//
// Used twice: silently when the technician takes the first photo of a trench —
// which is the whole point of the trench map — and behind the manual button of
// the geopoint field, for when the automatic fix landed in the wrong place or
// was refused at the time.
//
// It never throws and never rejects: a refused permission, a device without GPS
// and a timeout are all "no position", because none of them may stop a
// Rückmeldung from being sent.

import type { CaptureGeoPoint } from '@/types/capture-plan'

export async function getCurrentPoint(timeoutMs = 8_000): Promise<CaptureGeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy ?? null,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        // A fix from the last minute is good enough for a trench and saves the
        // technician a wait on every one of the three photos.
        maximumAge: 60_000,
      },
    )
  })
}
