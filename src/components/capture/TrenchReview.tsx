// El plano de las catas: todas juntas y unidas por su recorrido.
//
// Aquí ya no se valida nada — cada cata confirma su propio pin en su bloque del
// formulario, nada más ponerle las coordenadas y las fotos, y esa confirmación
// es la que exige la puerta SQL. Lo que aporta este mapa es lo que no cabe en un
// bloque: ver las tres seguidas y juzgar si la línea que dibujan tiene sentido.
// La cata que quedó dos calles más allá salta a la vista aquí, no en la oficina
// tres días después.
//
// Se puede mover un pin desde aquí, y hacerlo retira la confirmación de esa
// cata: un visto bueno vale para el punto que se confirmó, no para siempre.

import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, MapPin } from 'lucide-react'
import { farthestFromCentre, type ReviewTrench } from '@/lib/trenchReview'
import type { CaptureGeoPoint } from '@/types/capture-plan'

const NexusMap = lazy(() => import('@/components/map/NexusMap'))

/** A partir de aquí el pin no está en otra calle: está en otro pueblo. */
const SUSPICIOUS_DISTANCE_M = 3_000

export interface TrenchReviewProps {
  trenches: ReviewTrench[]
  /** Ruta de Storage de cada foto, para pintar la miniatura. */
  photoPaths: Record<string, string>
  photoUrls: Record<string, string>
  /** Centro del proyecto (migración 060): delata un pin puesto en otro sitio. */
  projectCentre: CaptureGeoPoint | null
  onMovePin: (itemId: string, point: CaptureGeoPoint) => void
}

export function TrenchReview({
  trenches,
  photoPaths,
  photoUrls,
  projectCentre,
  onMovePin,
}: TrenchReviewProps) {
  const { t } = useTranslation()
  const located = trenches.filter((trench) => trench.location)
  const [selectedId, setSelectedId] = useState<string | null>(located[0]?.itemId ?? null)
  const [adjusting, setAdjusting] = useState(false)

  const selected = trenches.find((trench) => trench.itemId === selectedId) ?? null
  const missing = trenches.length - located.length
  const unconfirmed = trenches.filter((trench) => trench.location && !trench.confirmedAt).length
  const farthest = farthestFromCentre(trenches, projectCentre)
  const suspicious = farthest !== null && farthest > SUSPICIOUS_DISTANCE_M

  const mapPoints = located.map((trench) => ({
    id: trench.itemId,
    kind: 'trench' as const,
    lat: (trench.location as CaptureGeoPoint).lat,
    lng: (trench.location as CaptureGeoPoint).lng,
    accuracy_m: null,
    index: trench.index,
    sectionKey: 'catas',
    itemId: trench.itemId,
    labelKey: 'capture.review.trench',
    depthCm: trench.depthCm,
    photos: trench.photoIds.map((photoId) => ({ id: photoId, storage_path: photoPaths[photoId] ?? '' })),
  }))

  return (
    <div className="rounded-l border border-line bg-bg-1 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-fg-1">{t('capture.review.title')}</h3>
          <p className="mt-0.5 text-xs text-fg-2">
            {t('capture.review.subtitle', { count: trenches.length })}
          </p>
        </div>
        <p
          className={`shrink-0 rounded-s border px-2 py-1 font-mono text-[11px] ${
            missing === 0 && unconfirmed === 0
              ? 'border-ok/40 bg-ok/10 text-ok'
              : 'border-accent/40 bg-accent/10 text-accent'
          }`}
        >
          {t('capture.review.confirmedCount', {
            done: trenches.length - missing - unconfirmed,
            total: trenches.length,
          })}
        </p>
      </div>

      {missing > 0 && (
        <p className="mb-3 rounded-m border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {t('capture.review.missingPins', { count: missing })}
        </p>
      )}

      {suspicious && (
        <p className="mb-3 rounded-m border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {t('capture.review.farFromProject', { km: Math.round((farthest as number) / 100) / 10 })}
        </p>
      )}

      {located.length === 0 ? (
        <p className="rounded-m border border-dashed border-line bg-bg-0 p-4 text-center text-xs text-fg-3">
          {t('capture.review.noPins')}
        </p>
      ) : (
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center rounded-l border border-line bg-bg-0 font-mono text-[11px] text-fg-3">
              {t('map.loading')}
            </div>
          }
        >
          {adjusting && selected?.location ? (
            <NexusMap
              heightClass="h-72"
              draggable={{ lat: selected.location.lat, lng: selected.location.lng }}
              onDragEnd={(position) =>
                // Un pin puesto a mano es exacto por definición: el radio de
                // error que llevaría una lectura automática sería mentira.
                onMovePin(selected.itemId, { lat: position.lat, lng: position.lng, accuracy_m: null })
              }
            />
          ) : (
            <NexusMap
              points={mapPoints}
              route={mapPoints.map((point) => [point.lng, point.lat] as [number, number])}
              selectedId={selectedId}
              onSelectPoint={(pointId) => setSelectedId(pointId)}
            />
          )}
        </Suspense>
      )}

      {trenches.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {trenches.map((trench) => (
            <button
              key={trench.itemId}
              type="button"
              onClick={() => {
                setSelectedId(trench.itemId)
                setAdjusting(false)
              }}
              className={`inline-flex items-center gap-1.5 rounded-m border px-3 py-2 font-mono text-[11px] transition-colors duration-200 ${
                trench.itemId === selectedId
                  ? 'border-accent text-accent'
                  : 'border-line text-fg-2 hover:border-line-s'
              }`}
            >
              {trench.confirmedAt && <Check size={12} strokeWidth={1.5} className="text-ok" />}
              {t('capture.review.trench')} {trench.index}
              <span className="text-fg-3">
                {trench.location ? `(${trench.photoIds.length})` : t('capture.review.noPin')}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 rounded-l border border-line bg-bg-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-fg-3">
              {selected.location
                ? t('capture.geo.reading', {
                    lat: selected.location.lat.toFixed(5),
                    lng: selected.location.lng.toFixed(5),
                    accuracy: Math.round(selected.location.accuracy_m ?? 0),
                  })
                : t('capture.geo.empty')}
              {selected.depthCm !== null && (
                <span className="ml-2">{t('map.trenches.depth', { depth: selected.depthCm })}</span>
              )}
              {selected.location && !selected.confirmedAt && (
                <span className="ml-2 text-accent">{t('capture.review.unconfirmed')}</span>
              )}
            </p>
            {selected.location && (
              <button
                type="button"
                onClick={() => setAdjusting((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
              >
                <MapPin size={14} strokeWidth={1.5} />
                {adjusting ? t('capture.geo.close') : t('capture.review.adjustPin')}
              </button>
            )}
          </div>

          {selected.photoIds.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selected.photoIds.map((photoId) => {
                const path = photoPaths[photoId]
                return (
                  <a
                    key={photoId}
                    href={photoUrls[path] ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square overflow-hidden rounded-s bg-bg-1 ring-1 ring-line transition-all hover:ring-accent"
                  >
                    {photoUrls[path] && (
                      <img src={photoUrls[path]} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </a>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-fg-3">{t('capture.review.noPhotosInTrench')}</p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-fg-3">{t('capture.review.hint')}</p>
    </div>
  )
}

export default TrenchReview
