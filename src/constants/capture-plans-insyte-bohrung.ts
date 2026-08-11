// "Bohrung + Aktivierung" (Insyte) — the evidence contract for the INSYTE
// "HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung" catalogue position (plan 011).
//
// It is a VARIANT of the `alta` work type, not a new work type. Unlike
// `soplado_ra`, an order normally picks it through the catalogue position:
// migration 079 stamps `service_items.capture_plan_key` on the INSYTE rows and
// extends the resolution precedence to order override → service item → work
// type, in `work_order_capture_plan_key()` and `capturePlanKeyForOrder()` alike.
//
// Migration 079 seeds this very definition into `public.capture_plans`;
// `capturePlans.test.ts` compares the seeded JSON with what this module exports,
// so the copy the SQL certification gate reads cannot drift from the one the
// technician's screen evaluates.
//
// Shape decisions that are settled and should not be re-litigated:
//   - the execution-type selector and its photos live in separate sections
//     because a `photos` section carries only slots and a slot condition
//     addresses a field as `<section>.<field>` — splitting is the idiomatic way
//     to branch a photo set (see the plan doc, plans/011);
//   - "balona" = Speedpipe, the microduct the fibre runs through. Labelled as
//     Speedpipe/Mikrorohr in the UI;
//   - `client_signature` ships as a yesno field for now. Its key must not
//     change when the signature canvas lands (plan 011 Gap C): the plan JSONB
//     is immutable per (key, version), only the widget behind the key swaps.

import type { CaptureCondition, CapturePhotoSlot, CapturePlan, CaptureSection } from '@/types/capture-plan'

export const INSYTE_BOHRUNG_PLAN_KEY = 'insyte_bohrung_aktivierung'
export const INSYTE_BOHRUNG_PLAN_VERSION = 1

const T = 'capturePlan.insyteBohrung'

/** The outside work was a real excavation. */
const METHOD_TIEFBAU: CaptureCondition = {
  path: 'external_method.execution_type',
  equals: 'tiefbau',
}
/** The outside work was done with the lance — no open trench. */
const METHOD_LANZE: CaptureCondition = {
  path: 'external_method.execution_type',
  equals: 'lanze',
}
/** The NT did not synchronize — the note explaining why becomes mandatory. */
const NT_NOT_SYNCED: CaptureCondition = { path: 'nt_ta.nt_synchronized', equals: false }
/** A TA was installed — its front view becomes mandatory. */
const TA_INSTALLED: CaptureCondition = { path: 'nt_ta.ta_installed', equals: true }
/** A service pack was performed — hours and evidence become mandatory. */
const SP_PERFORMED: CaptureCondition = { path: 'service_pack.sp_performed', equals: true }

/**
 * The Speedpipe photo is demanded on both branches; everything else in the
 * section belongs to exactly one execution type and only appears — and only
 * blocks — once the technician has answered how the outside work was done.
 */
const EXTERNAL_SLOTS: CapturePhotoSlot[] = [
  {
    key: 'speedpipe',
    min: 1,
    labelKey: `${T}.slot.speedpipe.label`,
    hintKey: `${T}.slot.speedpipe.hint`,
    legacyType: 'during',
  },
  {
    key: 'excavation_open',
    min: 1,
    labelKey: `${T}.slot.excavationOpen.label`,
    hintKey: `${T}.slot.excavationOpen.hint`,
    legacyType: 'during',
    condition: METHOD_TIEFBAU,
  },
  {
    key: 'muffe',
    min: 1,
    labelKey: `${T}.slot.muffe.label`,
    hintKey: `${T}.slot.muffe.hint`,
    legacyType: 'during',
    condition: METHOD_TIEFBAU,
  },
  {
    key: 'excavation_closed',
    min: 1,
    labelKey: `${T}.slot.excavationClosed.label`,
    hintKey: `${T}.slot.excavationClosed.hint`,
    legacyType: 'after',
    condition: METHOD_TIEFBAU,
  },
  {
    key: 'before_work',
    min: 1,
    labelKey: `${T}.slot.beforeWork.label`,
    hintKey: `${T}.slot.beforeWork.hint`,
    legacyType: 'before',
    condition: METHOD_LANZE,
  },
  {
    key: 'after_work',
    min: 1,
    labelKey: `${T}.slot.afterWork.label`,
    hintKey: `${T}.slot.afterWork.hint`,
    legacyType: 'after',
    condition: METHOD_LANZE,
  },
]

const SECTIONS: CaptureSection[] = [
  {
    key: 'external_method',
    kind: 'fields',
    titleKey: `${T}.externalMethod.title`,
    descriptionKey: `${T}.externalMethod.description`,
    fields: [
      {
        key: 'execution_type',
        type: 'select',
        labelKey: `${T}.field.executionType`,
        options: ['tiefbau', 'lanze'],
        required: true,
      },
    ],
  },
  {
    key: 'external_photos',
    kind: 'photos',
    titleKey: `${T}.externalPhotos.title`,
    descriptionKey: `${T}.externalPhotos.description`,
    slots: EXTERNAL_SLOTS,
  },
  {
    key: 'huep',
    kind: 'photos',
    titleKey: `${T}.huep.title`,
    descriptionKey: `${T}.huep.description`,
    slots: [
      {
        key: 'huep_open',
        min: 1,
        labelKey: `${T}.slot.huepOpen.label`,
        hintKey: `${T}.slot.huepOpen.hint`,
        legacyType: 'during',
      },
      {
        key: 'huep_closed',
        min: 1,
        labelKey: `${T}.slot.huepClosed.label`,
        hintKey: `${T}.slot.huepClosed.hint`,
        legacyType: 'after',
      },
      {
        key: 'huep_panorama',
        min: 1,
        labelKey: `${T}.slot.huepPanorama.label`,
        hintKey: `${T}.slot.huepPanorama.hint`,
        legacyType: 'after',
      },
      {
        key: 'faser_anmeldung',
        min: 1,
        labelKey: `${T}.slot.faserAnmeldung.label`,
        hintKey: `${T}.slot.faserAnmeldung.hint`,
        legacyType: 'after',
      },
    ],
  },
  {
    key: 'nt_ta',
    kind: 'checklist',
    titleKey: `${T}.ntTa.title`,
    descriptionKey: `${T}.ntTa.description`,
    fields: [
      {
        key: 'ta_installed',
        type: 'yesno',
        labelKey: `${T}.field.taInstalled`,
        required: true,
      },
      {
        key: 'nt_synchronized',
        type: 'yesno',
        labelKey: `${T}.field.ntSynchronized`,
        required: true,
      },
      {
        key: 'sync_issue_note',
        type: 'text',
        labelKey: `${T}.field.syncIssueNote`,
        placeholderKey: `${T}.placeholder.syncIssueNote`,
        required: true,
        condition: NT_NOT_SYNCED,
      },
    ],
  },
  {
    key: 'nt_ta_photos',
    kind: 'photos',
    titleKey: `${T}.ntTaPhotos.title`,
    descriptionKey: `${T}.ntTaPhotos.description`,
    slots: [
      {
        key: 'nt_connected',
        min: 1,
        labelKey: `${T}.slot.ntConnected.label`,
        hintKey: `${T}.slot.ntConnected.hint`,
        legacyType: 'after',
      },
      {
        key: 'nt_serial',
        min: 1,
        labelKey: `${T}.slot.ntSerial.label`,
        hintKey: `${T}.slot.ntSerial.hint`,
        legacyType: 'after',
      },
      {
        key: 'ta_front',
        min: 1,
        labelKey: `${T}.slot.taFront.label`,
        hintKey: `${T}.slot.taFront.hint`,
        legacyType: 'after',
        condition: TA_INSTALLED,
      },
      {
        key: 'nt_panorama',
        min: 1,
        labelKey: `${T}.slot.ntPanorama.label`,
        hintKey: `${T}.slot.ntPanorama.hint`,
        legacyType: 'after',
      },
    ],
  },
  {
    key: 'service_pack',
    kind: 'checklist',
    titleKey: `${T}.servicePack.title`,
    descriptionKey: `${T}.servicePack.description`,
    fields: [
      {
        key: 'sp_performed',
        type: 'yesno',
        labelKey: `${T}.field.spPerformed`,
        required: true,
      },
      // No explicit `min`, so the engine demands > 0: a performed service pack
      // of zero hours is a contradiction, not an answer.
      {
        key: 'sp_hours',
        type: 'number',
        labelKey: `${T}.field.spHours`,
        placeholderKey: `${T}.placeholder.spHours`,
        required: true,
        condition: SP_PERFORMED,
      },
    ],
  },
  {
    key: 'service_pack_photos',
    kind: 'photos',
    titleKey: `${T}.servicePackPhotos.title`,
    descriptionKey: `${T}.servicePackPhotos.description`,
    slots: [
      {
        key: 'sp_evidence',
        min: 1,
        labelKey: `${T}.slot.spEvidence.label`,
        hintKey: `${T}.slot.spEvidence.hint`,
        legacyType: 'during',
        condition: SP_PERFORMED,
      },
    ],
  },
  {
    key: 'closing',
    kind: 'photos',
    titleKey: `${T}.closing.title`,
    descriptionKey: `${T}.closing.description`,
    slots: [
      {
        key: 'activation',
        min: 1,
        labelKey: `${T}.slot.activation.label`,
        hintKey: `${T}.slot.activation.hint`,
        legacyType: 'after',
      },
      {
        key: 'measurements',
        min: 1,
        labelKey: `${T}.slot.measurements.label`,
        hintKey: `${T}.slot.measurements.hint`,
        legacyType: 'after',
      },
    ],
  },
  {
    key: 'closing_signature',
    kind: 'fields',
    titleKey: `${T}.closingSignature.title`,
    fields: [
      // Interim widget (plan 011 Gap C): a yesno until the signature canvas
      // lands. The key is load-bearing — the canvas will answer the same node.
      {
        key: 'client_signature',
        type: 'yesno',
        labelKey: `${T}.field.clientSignature`,
        required: true,
      },
    ],
  },
]

export const INSYTE_BOHRUNG_PLAN: CapturePlan = {
  key: INSYTE_BOHRUNG_PLAN_KEY,
  version: INSYTE_BOHRUNG_PLAN_VERSION,
  workType: 'alta',
  titleKey: `${T}.title`,
  sections: SECTIONS,
}
