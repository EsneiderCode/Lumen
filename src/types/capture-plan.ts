// Declarative capture plans ("Erfassungspläne") for the Rückmeldung.
//
// A capture plan describes WHAT the technician must document for a given kind of
// job: which photos, how many, which fields, and which parts only appear once an
// earlier answer reveals them. It replaces the three fixed photo buckets
// (before/during/after) and the hardcoded DETAIL_FIELDS map.
//
// The plans are DATA, not code: they live in `public.capture_plans` (migration
// 052) so the SQL certification gate can evaluate them too — the completeness
// rule is a business rule, not a UI rule. `src/constants/capture-plans.ts` holds
// the defaults that the migration seeds, and `capturePlanEngine.ts` evaluates a
// plan against uploaded photos + answers.
//
// A work order picks its plan through `work_orders.capture_plan_key`, falling
// back to its `work_type` when null.

export type LegacyPhotoType = 'before' | 'during' | 'after'

export type CaptureFieldType =
  | 'text'
  | 'number'
  | 'select'
  /** Opt-in flag; when required it must be checked (legacy `client_signature`). */
  | 'checkbox'
  /** Two big buttons, not a select — gloved fingers. Required = answered, not "yes". */
  | 'yesno'
  /** `{ lat, lng, accuracy_m }`, captured with the first photo of the item. */
  | 'geopoint'

/**
 * The single conditional primitive of the plan. It reveals photo slots (safety
 * signage only if the trench was left open) and demands fields (which duct was
 * really used, if not the planned one) with the same shape.
 *
 * `path` is either `item.<fieldKey>` — resolved inside the current repeater item —
 * or `<sectionKey>.<fieldKey>`, resolved anywhere in the answers.
 */
export interface CaptureCondition {
  path: string
  equals: string | number | boolean | null
}

export interface CaptureField {
  key: string
  type: CaptureFieldType
  labelKey: string
  placeholderKey?: string
  /** Canonical values as stored in the DB; the visible text is translated. */
  options?: string[]
  required?: boolean
  /**
   * Number fields only. Absent means "> 0" (what the legacy gate demanded of
   * meters, splice_count, cable_length); set it explicitly to allow 0.
   */
  min?: number
  max?: number
  /**
   * Column of the legacy `wo_detail_*` table this field mirrors, for the phase-2
   * double write. Absent = plan-only field, no legacy home.
   */
  legacyColumn?: string
  condition?: CaptureCondition
}

export interface CapturePhotoSlot {
  key: string
  /** 0 = never blocks submission. */
  min: number
  /** null/absent = unbounded. */
  max?: number | null
  labelKey: string
  /** One line describing what has to be visible in the frame. */
  hintKey?: string
  /** Object path in the `capture-examples` bucket — the thumbnail that makes the slot self-explanatory. */
  example?: string
  /**
   * Value written to `work_order_photos.photo_type`, which stays NOT NULL and
   * CHECK-constrained so the PDF, the admin detail view and the legacy gate keep
   * working while the plans roll out.
   */
  legacyType: LegacyPhotoType
  condition?: CaptureCondition
}

export type CaptureSectionKind = 'photos' | 'repeater' | 'gallery' | 'checklist' | 'fields'

interface CaptureSectionBase {
  key: string
  titleKey: string
  descriptionKey?: string
  condition?: CaptureCondition
}

/** Fixed set of one-off photo slots (the DP fiber, the POP label…). */
export interface CapturePhotosSection extends CaptureSectionBase {
  kind: 'photos'
  slots: CapturePhotoSlot[]
}

/** Repeatable unit with its own photos and fields — one per trench (Cata). */
export interface CaptureRepeaterSection extends CaptureSectionBase {
  kind: 'repeater'
  /** Minimum number of items; 0 means the section never blocks submission. */
  min: number
  max?: number | null
  itemLabelKey: string
  slots: CapturePhotoSlot[]
  fields: CaptureField[]
}

/** Free pile of photos plus fields — incidents. Never mandatory by design. */
export interface CaptureGallerySection extends CaptureSectionBase {
  kind: 'gallery'
  slots: CapturePhotoSlot[]
  fields: CaptureField[]
}

/** Yes/no questions that may demand follow-up fields through `condition`. */
export interface CaptureChecklistSection extends CaptureSectionBase {
  kind: 'checklist'
  fields: CaptureField[]
}

/** Plain data section — what DETAIL_FIELDS used to be. */
export interface CaptureFieldsSection extends CaptureSectionBase {
  kind: 'fields'
  fields: CaptureField[]
  /** Legacy `wo_detail_*` table the fields mirror during the double-write phase. */
  legacyTable?: string
}

export type CaptureSection =
  | CapturePhotosSection
  | CaptureRepeaterSection
  | CaptureGallerySection
  | CaptureChecklistSection
  | CaptureFieldsSection

export interface CapturePlan {
  key: string
  version: number
  titleKey?: string
  /**
   * The work type this plan captures, when the plan is a variant whose key is
   * not the work type itself ('soplado_ra' → 'soplado'). It is what lets the
   * admin form offer the plan on the right orders, and what ties the plan to the
   * `wo_detail_*` table its `details` section writes. Absent = the key is the
   * work type, which is the case for every default plan.
   */
  workType?: string
  sections: CaptureSection[]
}

// ── Answers ──────────────────────────────────────────────────────────────────

export interface CaptureGeoPoint {
  lat: number
  lng: number
  accuracy_m?: number | null
}

export type CaptureAnswerValue = string | number | boolean | CaptureGeoPoint | null

export type CaptureFieldValues = Record<string, CaptureAnswerValue | undefined>

export interface CaptureRepeaterItem {
  /** Stable client-generated id; also stamped on the item's photos. */
  id: string
  values: CaptureFieldValues
}

export type CaptureSectionAnswer = CaptureFieldValues | CaptureRepeaterItem[]

/** Shape of `work_order_capture_reports.answers`, keyed by section key. */
export type CaptureAnswers = Record<string, CaptureSectionAnswer | undefined>

/** The subset of `work_order_photos` the engine needs. */
export interface CapturedPhotoRef {
  id: string
  section_key?: string | null
  slot_key?: string | null
  item_id?: string | null
  /** Fallback for photos uploaded before the plans existed. */
  photo_type?: string | null
}

// ── Evaluation output ────────────────────────────────────────────────────────

export interface CaptureSlotState {
  /** Stable DOM/scroll target: `<section>[:<item>]:<slot>`. */
  nodeId: string
  sectionKey: string
  slotKey: string
  itemId: string | null
  min: number
  max: number | null
  count: number
  visible: boolean
  /** Photos still needed to satisfy `min` (0 when satisfied or hidden). */
  missing: number
  satisfied: boolean
  /** More photos than `max` — the UI blocks further capture, it is not a submit blocker. */
  overflow: boolean
}

export interface CaptureFieldState {
  nodeId: string
  sectionKey: string
  fieldKey: string
  itemId: string | null
  required: boolean
  visible: boolean
  filled: boolean
  satisfied: boolean
}

export interface CaptureItemState {
  itemId: string
  index: number
  slots: CaptureSlotState[]
  fields: CaptureFieldState[]
  satisfied: boolean
}

export interface CaptureSectionState {
  key: string
  kind: CaptureSectionKind
  visible: boolean
  satisfied: boolean
  slots: CaptureSlotState[]
  fields: CaptureFieldState[]
  items: CaptureItemState[]
  /** Repeater sections only. */
  itemCount: number
  missingItems: number
}

export type CaptureMissingKind = 'photos' | 'field' | 'items'

export interface CaptureMissingNode {
  nodeId: string
  kind: CaptureMissingKind
  sectionKey: string
  itemId: string | null
  slotKey?: string
  fieldKey?: string
  /** Photos or items still needed; always 1 for a field. */
  count: number
}

export interface CapturePlanEvaluation {
  planKey: string
  planVersion: number
  sections: CaptureSectionState[]
  /** In plan order — `missing[0]` is what the submit button scrolls to. */
  missing: CaptureMissingNode[]
  missingPhotoCount: number
  missingFieldCount: number
  canSubmit: boolean
}
