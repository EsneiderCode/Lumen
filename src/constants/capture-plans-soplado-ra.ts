// "Soplado de RA" — the first hand-written capture plan (phase 3).
//
// It is a VARIANT of the `soplado` work type, not a new work type: the work_type
// enum is embedded in seven detail tables and every export, so an order picks
// this plan through `work_orders.capture_plan_key = 'soplado_ra'` and keeps
// writing `wo_detail_soplado` through the `details` section below.
//
// Migration 053 seeds this very definition into `public.capture_plans`;
// `capturePlans.test.ts` compares the seeded JSON with what this module exports,
// so the DB copy the phase-5 SQL gate will read cannot drift from the one the
// technician's screen evaluates.
//
// Shape decisions that are settled and should not be re-litigated:
//   - trenches ("catas") are `min: 0` — they never block submission, because a
//     blowing job may not require opening the ground at all;
//   - answering "yes" to "does the trench stay open?" REVEALS the safety-signage
//     slot but does not demand it (`min: 0`);
//   - a trench that DOES exist is documented in this order, and the order is the
//     point (v3): first its `location`, typed off the watermark the camera burnt
//     into one of its photos; then the photos; then, once there is a point to
//     look at, `pin_confirmed` — the technician sees the pin on the map and
//     vouches for it or drags it. Both are required: a trench whose position
//     nobody vouched for is what the office cannot use.
//     The v1/v2 reasoning for leaving the position optional (EXIF is stripped by
//     the gallery, so demanding it would strand technicians) no longer applies:
//     the watermark is legible on the photo itself and does not depend on EXIF;
//   - incidents are never mandatory by design.

import { legacyDetailsSection } from '@/constants/capture-plan-sections'
import type {
  CaptureCondition,
  CapturePhotoSlot,
  CapturePlan,
  CaptureSection,
} from '@/types/capture-plan'

export const SOPLADO_RA_PLAN_KEY = 'soplado_ra'
/**
 * v4 (migration 076): the four mandatory photos are no longer one undifferentiated
 * block. They are split by WHERE they are taken — the DP and the POP — because
 * that is how the work is done and how the office reads the evidence back. See
 * MANDATORY_SLOTS below for why they were lumped together until now.
 *
 * v3 (migration 071): each trench now states where it was before its photos and
 * confirms its own pin after them. v1 and v2 stay in the catalog — a Rückmeldung
 * already sent under one of them is judged against the version it was captured
 * under, so no order in flight becomes uncertifiable because of this.
 */
export const SOPLADO_RA_PLAN_VERSION = 4

const T = 'capturePlan.sopladoRa'

/** Example thumbnails live in the `capture-examples` bucket (migration 053). */
const EXAMPLE_DIR = 'soplado_ra'

/**
 * All four mandatory photos record a FINISHED state — fibre already blown into
 * the DP, gasblock already sealed, label and balloon already in place. So all
 * four are `after`, and none of them is a "before".
 *
 * Until v4 they were deliberately spread across before/during/after instead,
 * which is why a photo of the DP with the cable already inside was filed under
 * "Antes". That spread existed for one reason: the old
 * `assert_work_order_rueckmeldung_complete` demanded one photo of each legacy
 * bucket, and the trenches that would otherwise supply them are optional.
 * The gate now reads the plan (`capture_plan_missing_nodes`) and only falls
 * back to the buckets for photos with no `section_key` — i.e. those uploaded
 * before migration 052. Nothing is holding the lie up any more, so it goes.
 */
const DP_SLOTS: CapturePhotoSlot[] = [
  {
    key: 'fiber_dp',
    min: 1,
    labelKey: `${T}.slot.fiberDp.label`,
    hintKey: `${T}.slot.fiberDp.hint`,
    example: `${EXAMPLE_DIR}/fiber_dp.jpg`,
    legacyType: 'after',
  },
  {
    key: 'fiber_dp_gasblock',
    min: 1,
    labelKey: `${T}.slot.fiberDpGasblock.label`,
    hintKey: `${T}.slot.fiberDpGasblock.hint`,
    example: `${EXAMPLE_DIR}/fiber_dp_gasblock.jpg`,
    legacyType: 'after',
  },
]

const POP_SLOTS: CapturePhotoSlot[] = [
  {
    key: 'fiber_pop_label',
    min: 1,
    labelKey: `${T}.slot.fiberPopLabel.label`,
    hintKey: `${T}.slot.fiberPopLabel.hint`,
    example: `${EXAMPLE_DIR}/fiber_pop_label.jpg`,
    legacyType: 'after',
  },
  {
    key: 'balloon_pop',
    min: 1,
    labelKey: `${T}.slot.balloonPop.label`,
    hintKey: `${T}.slot.balloonPop.hint`,
    example: `${EXAMPLE_DIR}/balloon_pop.jpg`,
    legacyType: 'after',
  },
]

/** Revealed by the trench being left open — the one conditional primitive. */
const TRENCH_LEFT_OPEN: CaptureCondition = { path: 'item.left_open', equals: true }

/** The follow-up questions of a duct change, revealed by answering "no". */
const DUCT_CHANGED: CaptureCondition = { path: 'checklist.duct_as_planned', equals: false }

const SECTIONS: CaptureSection[] = [
  // Opens the plan since v2: the result and the metres are what the office is
  // waiting for, and they are the fastest thing to fill in the van.
  legacyDetailsSection('soplado'),
  // Split in two since v4, by WHERE the photo is taken. The office reads the
  // evidence back place by place — everything about the DP together, everything
  // about the POP together — not phase by phase, which for these four is a
  // distinction without a difference: all of them are finished states.
  {
    key: 'dp',
    kind: 'photos',
    titleKey: `${T}.dp.title`,
    descriptionKey: `${T}.dp.description`,
    slots: DP_SLOTS,
  },
  {
    key: 'pop',
    kind: 'photos',
    titleKey: `${T}.pop.title`,
    descriptionKey: `${T}.pop.description`,
    slots: POP_SLOTS,
  },
  {
    key: 'catas',
    kind: 'repeater',
    titleKey: `${T}.catas.title`,
    descriptionKey: `${T}.catas.description`,
    itemLabelKey: `${T}.catas.item`,
    min: 0,
    slots: [
      {
        key: 'before_open',
        min: 1,
        labelKey: `${T}.slot.beforeOpen.label`,
        hintKey: `${T}.slot.beforeOpen.hint`,
        example: `${EXAMPLE_DIR}/cata_before_open.jpg`,
        legacyType: 'before',
      },
      {
        key: 'during_open',
        min: 1,
        labelKey: `${T}.slot.duringOpen.label`,
        hintKey: `${T}.slot.duringOpen.hint`,
        example: `${EXAMPLE_DIR}/cata_during_open.jpg`,
        legacyType: 'during',
      },
      {
        key: 'closed',
        min: 1,
        labelKey: `${T}.slot.closed.label`,
        hintKey: `${T}.slot.closed.hint`,
        example: `${EXAMPLE_DIR}/cata_closed.jpg`,
        legacyType: 'after',
      },
      {
        key: 'safety_signage',
        min: 0,
        labelKey: `${T}.slot.safetySignage.label`,
        hintKey: `${T}.slot.safetySignage.hint`,
        example: `${EXAMPLE_DIR}/cata_safety_signage.jpg`,
        legacyType: 'during',
        condition: TRENCH_LEFT_OPEN,
      },
    ],
    fields: [
      // `lead`: se pide ANTES que las fotos. El técnico las tiene delante en la
      // galería y la marca de agua de cualquiera de ellas lleva escrita la
      // posición de esta cata.
      {
        key: 'location',
        type: 'geopoint',
        labelKey: `${T}.field.location`,
        hintKey: `${T}.hint.location`,
        placeholderKey: `${T}.placeholder.location`,
        required: true,
        lead: true,
      },
      {
        key: 'left_open',
        type: 'yesno',
        labelKey: `${T}.field.leftOpen`,
        required: true,
      },
      {
        key: 'depth_cm',
        type: 'number',
        labelKey: `${T}.field.depthCm`,
        placeholderKey: `${T}.placeholder.depthCm`,
        required: true,
      },
      // Cierra la cata: con el punto ya escrito y las fotos subidas, se le
      // enseña el pin sobre el mapa y él responde por él.
      {
        key: 'pin_confirmed',
        type: 'geoconfirm',
        labelKey: `${T}.field.pinConfirmed`,
        hintKey: `${T}.hint.pinConfirmed`,
        required: true,
      },
    ],
  },
  {
    key: 'incidents',
    kind: 'gallery',
    titleKey: `${T}.incidents.title`,
    descriptionKey: `${T}.incidents.description`,
    slots: [
      {
        key: 'photo',
        min: 0,
        labelKey: `${T}.slot.incident.label`,
        hintKey: `${T}.slot.incident.hint`,
        legacyType: 'during',
      },
    ],
    fields: [
      {
        key: 'description',
        type: 'text',
        labelKey: `${T}.field.incidentDescription`,
        placeholderKey: `${T}.placeholder.incidentDescription`,
      },
    ],
  },
  {
    key: 'checklist',
    kind: 'checklist',
    titleKey: `${T}.checklist.title`,
    descriptionKey: `${T}.checklist.description`,
    fields: [
      {
        key: 'duct_as_planned',
        type: 'yesno',
        labelKey: `${T}.field.ductAsPlanned`,
        required: true,
      },
      {
        key: 'trunk_used',
        type: 'text',
        labelKey: `${T}.field.trunkUsed`,
        placeholderKey: `${T}.placeholder.trunkUsed`,
        required: true,
        condition: DUCT_CHANGED,
      },
      {
        key: 'duct_used',
        type: 'text',
        labelKey: `${T}.field.ductUsed`,
        placeholderKey: `${T}.placeholder.ductUsed`,
        required: true,
        condition: DUCT_CHANGED,
      },
      {
        key: 'change_reason',
        type: 'text',
        labelKey: `${T}.field.changeReason`,
        placeholderKey: `${T}.placeholder.changeReason`,
        required: true,
        condition: DUCT_CHANGED,
      },
    ],
  },
]

export const SOPLADO_RA_PLAN: CapturePlan = {
  key: SOPLADO_RA_PLAN_KEY,
  version: SOPLADO_RA_PLAN_VERSION,
  workType: 'soplado',
  titleKey: `${T}.title`,
  sections: SECTIONS,
}
