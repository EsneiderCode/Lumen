// Renders a capture plan as the technician's Rückmeldung form.
//
// Presentational on purpose: the page owns the answers, the photos and the
// uploads, so the double write to the legacy detail row and the send flow stay
// in one place. This component decides only what is shown and when.
//
// UX rules that are deliberate, not incidental:
//   - a scrollable list of self-collapsing sections, NOT a wizard: the
//     technician leaves and re-enters this screen several times a day and does
//     the trenches in the morning and the POP in the afternoon;
//   - one tap on the row opens the camera — the slot already knows what it is;
//   - yes/no are two big buttons, not a <select> (gloved fingers);
//   - what is missing is stated inline, never as a toast, and never as a
//     greyed-out control.

import { Suspense, lazy, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ChevronDown, ChevronRight, Crosshair, MapPin, Plus, Trash2 } from 'lucide-react'
import type {
  CaptureAnswers,
  CaptureField,
  CaptureFieldValues,
  CaptureGeoPoint,
  CapturePhotoSlot,
  CapturePlan,
  CapturePlanEvaluation,
  CaptureRepeaterItem,
  CaptureSection,
  CaptureSlotState,
} from '@/types/capture-plan'
import type { CapturePhotoRow } from '@/services/capturePlanService'
import { slotNodeId, fieldNodeId } from '@/services/capturePlanEngine'
import { getCurrentPoint } from '@/lib/geolocation'

// ~200 KB gzip of map library that a technician who never opens the pin editor
// must not download.
const NexusMap = lazy(() => import('@/components/map/NexusMap'))

export interface SlotTarget {
  sectionKey: string
  slotKey: string
  legacyType: CapturePhotoSlot['legacyType']
  itemId: string | null
}

/** A photo picked on this device, still on its way up. */
export interface PendingPhoto {
  id: string
  nodeId: string
  previewUrl: string
  failed: boolean
}

export interface CapturePlanFormProps {
  plan: CapturePlan
  answers: CaptureAnswers
  evaluation: CapturePlanEvaluation
  photos: CapturePhotoRow[]
  photoUrls: Record<string, string>
  /** Example thumbnails from the `capture-examples` bucket, keyed by the slot's `example` path. */
  exampleUrls?: Record<string, string>
  pending: PendingPhoto[]
  highlightedNodeId?: string | null
  deletingPhotoId?: string | null
  onFieldChange: (sectionKey: string, fieldKey: string, value: unknown, itemId?: string | null) => void
  onCapture: (target: SlotTarget, files: FileList | null) => void
  onRetry: (pendingId: string) => void
  onDeletePhoto: (photo: CapturePhotoRow) => void
  onAddItem: (sectionKey: string) => void
  onRemoveItem: (sectionKey: string, itemId: string) => void
}

// ── Field control ────────────────────────────────────────────────────────────

function YesNoField({
  value,
  onChange,
  yes,
  no,
}: {
  value: unknown
  onChange: (value: boolean) => void
  yes: string
  no: string
}) {
  const base =
    'flex-1 rounded-m border px-4 py-3 text-sm font-semibold transition-colors duration-200'
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className={`${base} ${value === true ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-bg-0 text-fg-2'}`}
      >
        {yes}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className={`${base} ${value === false ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-bg-0 text-fg-2'}`}
      >
        {no}
      </button>
    </div>
  )
}

function GeoPointField({
  value,
  onChange,
}: {
  value: unknown
  onChange: (value: CaptureGeoPoint | null) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const point = value && typeof value === 'object' ? (value as CaptureGeoPoint) : null

  // Manual correction of the fix taken with the first photo: between buildings a
  // phone GPS drifts 15–20 m, and the technician is the one standing there.
  async function locate() {
    setBusy(true)
    setFailed(false)
    const fix = await getCurrentPoint()
    if (fix) onChange(fix)
    else setFailed(true)
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-fg-2">
          {point
            ? t('capture.geo.reading', {
                lat: point.lat.toFixed(5),
                lng: point.lng.toFixed(5),
                accuracy: Math.round(point.accuracy_m ?? 0),
              })
            : failed
              ? t('capture.geo.unavailable')
              : t('capture.geo.empty')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Correcting the pin only makes sense once there is one to correct. */}
          {point && (
            <button
              type="button"
              onClick={() => setMapOpen((open) => !open)}
              aria-expanded={mapOpen}
              className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
            >
              <MapPin size={14} strokeWidth={1.5} />
              {mapOpen ? t('capture.geo.close') : t('capture.geo.adjust')}
            </button>
          )}
          <button
            type="button"
            onClick={locate}
            className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
          >
            <Crosshair size={14} strokeWidth={1.5} />
            {busy ? t('capture.geo.locating') : t('capture.geo.locate')}
          </button>
        </div>
      </div>

      {mapOpen && point && (
        <>
          <Suspense
            fallback={
              <div className="flex h-56 items-center justify-center rounded-l border border-line bg-bg-0 font-mono text-[11px] text-fg-3">
                {t('map.loading')}
              </div>
            }
          >
            <NexusMap
              heightClass="h-56"
              draggable={{ lat: point.lat, lng: point.lng }}
              onDragEnd={(position) =>
                // A hand-placed pin is exact by definition: the accuracy radius
                // of the GPS fix it replaces would be a lie.
                onChange({ lat: position.lat, lng: position.lng, accuracy_m: null })
              }
            />
          </Suspense>
          <p className="text-xs text-fg-3">{t('capture.geo.dragHint')}</p>
        </>
      )}
    </div>
  )
}

function CaptureFieldControl({
  field,
  value,
  required,
  missing,
  highlighted,
  nodeId,
  onChange,
}: {
  field: CaptureField
  value: unknown
  required: boolean
  missing: boolean
  highlighted: boolean
  nodeId: string
  onChange: (value: unknown) => void
}) {
  const { t } = useTranslation()
  const label = t(field.labelKey, { defaultValue: field.key.replace(/_/g, ' ') })
  const inputClass = `w-full rounded-m border bg-bg-0 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none ${
    missing ? 'border-accent/60' : 'border-line'
  }`

  return (
    <div id={nodeId} className={highlighted ? 'rounded-m border border-accent p-2' : ''}>
      {field.type === 'checkbox' ? (
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-fg-1">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="h-5 w-5 rounded-s border-line text-accent focus:ring-accent"
          />
          {label}
          {required && <span className="text-accent">*</span>}
        </label>
      ) : (
        <>
          <label className="mb-1.5 block text-xs font-medium text-fg-2">
            {label}
            {required && <span className="ml-1 text-accent">*</span>}
          </label>
          {field.type === 'yesno' ? (
            <YesNoField
              value={value}
              onChange={onChange}
              yes={t('capture.yes')}
              no={t('capture.no')}
            />
          ) : field.type === 'geopoint' ? (
            <GeoPointField value={value} onChange={onChange} />
          ) : field.type === 'select' ? (
            <select
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => onChange(event.target.value)}
              className={inputClass}
            >
              <option value="">{t('rueckmeldung.details.choose')}</option>
              {/* The stored value stays canonical (German); only the visible text is translated. */}
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {t(`detailOption.${option}`, { defaultValue: option })}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={value === null || value === undefined ? '' : String(value)}
              onChange={(event) =>
                onChange(
                  field.type === 'number'
                    ? event.target.value === ''
                      ? null
                      : Number(event.target.value)
                    : event.target.value,
                )
              }
              placeholder={
                field.placeholderKey ? t(field.placeholderKey, { defaultValue: '' }) : undefined
              }
              className={inputClass}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Photo slot ───────────────────────────────────────────────────────────────

function PhotoSlotRow({
  slot,
  state,
  photos,
  photoUrls,
  exampleUrl,
  pending,
  highlighted,
  deletingPhotoId,
  onCapture,
  onRetry,
  onDeletePhoto,
}: {
  slot: CapturePhotoSlot
  state: CaptureSlotState
  photos: CapturePhotoRow[]
  photoUrls: Record<string, string>
  exampleUrl?: string
  pending: PendingPhoto[]
  highlighted: boolean
  deletingPhotoId?: string | null
  onCapture: (files: FileList | null) => void
  onRetry: (pendingId: string) => void
  onDeletePhoto: (photo: CapturePhotoRow) => void
}) {
  const { t } = useTranslation()
  const inputId = `capture-input-${state.nodeId}`
  const canAddMore = state.max === null || state.count + pending.length < state.max

  return (
    <div
      id={state.nodeId}
      className={`rounded-m border p-3 transition-colors duration-200 ${
        highlighted ? 'border-accent' : state.missing > 0 ? 'border-accent/40' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-1">
            {t(slot.labelKey, { defaultValue: slot.key.replace(/_/g, ' ') })}
            {slot.min > 0 && <span className="ml-1 text-accent">*</span>}
          </p>
          {slot.hintKey && (
            <p className="mt-0.5 text-xs text-fg-3">{t(slot.hintKey, { defaultValue: '' })}</p>
          )}
          <p className="mt-1 font-mono text-[11px] text-fg-3">
            {state.missing > 0
              ? t('capture.slot.missing', { count: state.missing })
              : t('capture.slot.count', { count: state.count })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {exampleUrl && (
            <img
              src={exampleUrl}
              alt={t('capture.slot.example')}
              className="h-12 w-12 rounded-s object-cover opacity-70"
            />
          )}
          {canAddMore && (
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
            >
              <Camera size={14} strokeWidth={1.5} />
              {t('capture.slot.add')}
            </label>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={state.max === null || state.max > 1}
            className="hidden"
            onChange={(event) => {
              onCapture(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
      </div>

      {(photos.length > 0 || pending.length > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square overflow-hidden rounded-s bg-bg-0">
              <img
                src={photoUrls[photo.storage_path] ?? ''}
                alt={photo.caption ?? ''}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                disabled={deletingPhotoId === photo.id}
                onClick={() => onDeletePhoto(photo)}
                aria-label={t('capture.slot.delete')}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-s border border-line bg-bg-1 text-fg-2 transition-colors duration-200 hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {pending.map((item) => (
            <div key={item.id} className="relative aspect-square overflow-hidden rounded-s bg-bg-0">
              <img src={item.previewUrl} alt="" className="h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 flex items-center justify-center">
                {item.failed ? (
                  <button
                    type="button"
                    onClick={() => onRetry(item.id)}
                    className="rounded-s border border-accent bg-bg-1 px-2 py-1 font-mono text-[10px] text-accent"
                  >
                    {t('capture.slot.retry')}
                  </button>
                ) : (
                  <span className="font-mono text-[10px] text-fg-2">
                    {t('capture.slot.uploading')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

function sectionSlots(section: CaptureSection): CapturePhotoSlot[] {
  return 'slots' in section ? section.slots : []
}

function sectionFields(section: CaptureSection): CaptureField[] {
  return 'fields' in section ? section.fields : []
}

export function CapturePlanForm(props: CapturePlanFormProps) {
  const { plan, answers, evaluation, photos } = props
  const { t } = useTranslation()
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({})

  const slotStates = useMemo(() => {
    const map = new Map<string, CaptureSlotState>()
    for (const section of evaluation.sections) {
      for (const slot of section.slots) map.set(slot.nodeId, slot)
    }
    return map
  }, [evaluation])

  const photosBySlot = useMemo(() => {
    const map = new Map<string, CapturePhotoRow[]>()
    for (const photo of photos) {
      if (!photo.section_key || !photo.slot_key) continue
      const nodeId = slotNodeId(photo.section_key, photo.slot_key, photo.item_id ?? null)
      const bucket = map.get(nodeId)
      if (bucket) bucket.push(photo)
      else map.set(nodeId, [photo])
    }
    return map
  }, [photos])

  const sectionState = (key: string) => evaluation.sections.find((section) => section.key === key)

  function renderSlot(
    section: CaptureSection,
    slot: CapturePhotoSlot,
    itemId: string | null,
  ) {
    const nodeId = slotNodeId(section.key, slot.key, itemId)
    const state = slotStates.get(nodeId)
    if (!state || !state.visible) return null

    return (
      <PhotoSlotRow
        key={nodeId}
        slot={slot}
        state={state}
        photos={photosBySlot.get(nodeId) ?? []}
        photoUrls={props.photoUrls}
        exampleUrl={slot.example ? props.exampleUrls?.[slot.example] : undefined}
        pending={props.pending.filter((item) => item.nodeId === nodeId)}
        highlighted={props.highlightedNodeId === nodeId}
        deletingPhotoId={props.deletingPhotoId}
        onCapture={(files) =>
          props.onCapture(
            { sectionKey: section.key, slotKey: slot.key, legacyType: slot.legacyType, itemId },
            files,
          )
        }
        onRetry={props.onRetry}
        onDeletePhoto={props.onDeletePhoto}
      />
    )
  }

  function renderField(section: CaptureSection, field: CaptureField, item: CaptureRepeaterItem | null) {
    const itemId = item?.id ?? null
    const nodeId = fieldNodeId(section.key, field.key, itemId)
    const state = evaluation.sections
      .find((candidate) => candidate.key === section.key)
      ?.fields.find((candidate) => candidate.nodeId === nodeId)
    if (!state || !state.visible) return null

    const values: CaptureFieldValues = item
      ? item.values
      : ((answers[section.key] ?? {}) as CaptureFieldValues)

    return (
      <CaptureFieldControl
        key={nodeId}
        nodeId={nodeId}
        field={field}
        value={values[field.key]}
        required={state.required}
        missing={!state.satisfied}
        highlighted={props.highlightedNodeId === nodeId}
        onChange={(value) => props.onFieldChange(section.key, field.key, value, itemId)}
      />
    )
  }

  return (
    <div className="space-y-3">
      {plan.sections.map((section) => {
        const state = sectionState(section.key)
        if (!state?.visible) return null

        const open = manuallyToggled[section.key] ?? !state.satisfied
        const items = section.kind === 'repeater' ? state.items : []
        const answerItems = (answers[section.key] ?? []) as CaptureRepeaterItem[]

        return (
          <section key={section.key} className="rounded-l border border-line bg-bg-1">
            <button
              type="button"
              onClick={() =>
                setManuallyToggled((previous) => ({ ...previous, [section.key]: !open }))
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2">
                {open ? (
                  <ChevronDown size={16} strokeWidth={1.5} className="text-fg-3" />
                ) : (
                  <ChevronRight size={16} strokeWidth={1.5} className="text-fg-3" />
                )}
                <span className="font-display text-sm font-semibold text-fg-1">
                  {t(section.titleKey, { defaultValue: section.key })}
                </span>
              </span>
              <span
                className={`font-mono text-[11px] ${state.satisfied ? 'text-ok' : 'text-accent'}`}
              >
                {state.satisfied ? t('capture.section.done') : t('capture.section.pending')}
              </span>
            </button>

            {open && (
              <div className="space-y-3 border-t border-line px-4 py-4">
                {section.descriptionKey && (
                  <p className="text-xs text-fg-2">
                    {t(section.descriptionKey, { defaultValue: '' })}
                  </p>
                )}

                {section.kind === 'repeater' ? (
                  <>
                    {items.length === 0 && (
                      <p className="rounded-m border border-dashed border-line bg-bg-0 p-3 text-center text-xs text-fg-3">
                        {t('capture.repeater.empty')}
                      </p>
                    )}
                    {items.map((itemState, index) => {
                      const item = answerItems.find((candidate) => candidate.id === itemState.itemId)
                      if (!item) return null
                      return (
                        <div
                          key={item.id}
                          className="space-y-3 rounded-m border border-line bg-bg-0 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-[11px] uppercase tracking-wider text-fg-3">
                              {t(section.itemLabelKey, { defaultValue: section.key })} {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => props.onRemoveItem(section.key, item.id)}
                              aria-label={t('capture.repeater.remove')}
                              className="flex h-7 w-7 items-center justify-center rounded-s border border-line text-fg-3 transition-colors duration-200 hover:border-accent hover:text-accent"
                            >
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          </div>
                          {section.slots.map((slot) => renderSlot(section, slot, item.id))}
                          {section.fields.map((field) => renderField(section, field, item))}
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => props.onAddItem(section.key)}
                      className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      {t('capture.repeater.add')}
                    </button>
                  </>
                ) : (
                  <>
                    {sectionSlots(section).map((slot) => renderSlot(section, slot, null))}
                    {sectionFields(section).map((field) => renderField(section, field, null))}
                  </>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
