// Pure evaluator for capture plans (see `src/types/capture-plan.ts`).
//
// Given a plan, the photos already uploaded and the answers filled in so far, it
// returns the state of every node of the plan and the ordered list of what is
// still missing. It is used by:
//   - the technician's Rückmeldung screen (what to show, what to demand, where
//     to scroll when the submit button is pressed while incomplete),
//   - the admin certification view (why an order cannot be certified),
//   - the vitest suite — which is why it takes plain data and returns plain data.
//
// The SQL twin lives in the certification gate (`assert_work_order_rueckmeldung_
// complete`, phase 5). Keep both in sync: the SQL side is authoritative for
// enforcement, this one for the UI.

import type {
  CaptureAnswers,
  CaptureCondition,
  CaptureDetailEntry,
  CaptureField,
  CaptureFieldState,
  CaptureFieldValues,
  CaptureGeoPoint,
  CaptureItemState,
  CaptureMissingNode,
  CapturePhotoSlot,
  CapturePlan,
  CapturePlanEvaluation,
  CaptureRepeaterItem,
  CaptureSection,
  CaptureSectionState,
  CaptureSlotState,
  CapturedPhotoRef,
} from '@/types/capture-plan'

// ── Answer access ────────────────────────────────────────────────────────────

export function sectionValues(answers: CaptureAnswers, sectionKey: string): CaptureFieldValues {
  const value = answers[sectionKey]
  if (!value || Array.isArray(value)) return {}
  return value
}

export function repeaterItems(answers: CaptureAnswers, sectionKey: string): CaptureRepeaterItem[] {
  const value = answers[sectionKey]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CaptureRepeaterItem => Boolean(item) && typeof item.id === 'string')
}

// ── Conditions ───────────────────────────────────────────────────────────────

/**
 * Resolves `item.<field>` against the repeater item being evaluated, and
 * `<section>.<field>` against the whole answer set.
 */
function resolveConditionValue(
  condition: CaptureCondition,
  answers: CaptureAnswers,
  item: CaptureRepeaterItem | null,
): unknown {
  const separator = condition.path.indexOf('.')
  if (separator <= 0) return undefined

  const head = condition.path.slice(0, separator)
  const fieldKey = condition.path.slice(separator + 1)

  if (head === 'item') return item?.values[fieldKey]
  return sectionValues(answers, head)[fieldKey]
}

export function conditionMet(
  condition: CaptureCondition | undefined,
  answers: CaptureAnswers,
  item: CaptureRepeaterItem | null = null,
): boolean {
  if (!condition) return true
  const actual = resolveConditionValue(condition, answers, item)
  // Unanswered and "expected null" are the same thing for a condition.
  if (actual === undefined) return condition.equals === null
  return actual === condition.equals
}

// ── Field completeness ───────────────────────────────────────────────────────

function isGeoPoint(value: unknown): value is CaptureGeoPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as CaptureGeoPoint
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
}

/**
 * "Filled" is per type, and reproduces what the legacy gate demanded:
 *   - text/select : non-blank string
 *   - number      : finite, and > 0 unless the field declares its own `min`
 *   - checkbox    : must be checked (`has_measurement_cert`, `client_signature`)
 *   - yesno       : answered — "no" is a valid answer
 *   - geopoint    : finite lat/lng
 *   - geoconfirm  : the instant the technician vouched for the pin, as ISO text
 */
export function isFieldFilled(field: CaptureField, value: unknown): boolean {
  if (value === null || value === undefined) return false

  switch (field.type) {
    case 'text':
    case 'select':
      return typeof value === 'string' && value.trim().length > 0
    case 'number': {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) return false
      if (field.min !== undefined) return numeric >= field.min
      return numeric > 0
    }
    case 'checkbox':
      return value === true
    case 'yesno':
      return value === true || value === false
    case 'geopoint':
      return isGeoPoint(value)
    case 'geoconfirm':
      return typeof value === 'string' && value.trim().length > 0
    default:
      return false
  }
}

// ── Photo ↔ slot assignment ──────────────────────────────────────────────────

interface SlotAddress {
  sectionKey: string
  slotKey: string
  itemId: string | null
  legacyType: string
}

/**
 * Each photo is counted for at most one slot. Photos stamped with section/slot
 * go to that slot; photos without them — everything uploaded before the plans
 * existed — fall back to the first visible slot with a matching `legacyType`, so
 * old work orders do not suddenly read as incomplete.
 */
function countPhotosPerSlot(
  photos: CapturedPhotoRef[],
  slotAddresses: SlotAddress[],
): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (address: SlotAddress) => {
    const id = slotNodeId(address.sectionKey, address.slotKey, address.itemId)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const unassigned: CapturedPhotoRef[] = []
  for (const photo of photos) {
    const sectionKey = photo.section_key ?? null
    const slotKey = photo.slot_key ?? null
    if (!sectionKey || !slotKey) {
      unassigned.push(photo)
      continue
    }
    const itemId = photo.item_id ?? null
    const match = slotAddresses.find(
      (address) =>
        address.sectionKey === sectionKey &&
        address.slotKey === slotKey &&
        address.itemId === itemId,
    )
    // A photo pointing at a slot the current plan version no longer has is kept
    // in storage but counts for nothing.
    if (match) bump(match)
  }

  for (const photo of unassigned) {
    if (!photo.photo_type) continue
    const match = slotAddresses.find(
      (address) => address.itemId === null && address.legacyType === photo.photo_type,
    )
    if (match) bump(match)
  }

  return counts
}

// ── Plan queries ─────────────────────────────────────────────────────────────

/** Object paths of every example thumbnail the plan references, deduplicated. */
export function captureExamplePaths(plan: CapturePlan): string[] {
  const paths = new Set<string>()
  for (const section of plan.sections) {
    for (const slot of sectionSlots(section)) {
      if (slot.example) paths.add(slot.example)
    }
  }
  return [...paths]
}

/**
 * The order's technical data as a flat, readable list — what the admin detail
 * page, the technician's read-only view and the certificate PDF used to read
 * out of the `wo_detail_*` row.
 *
 * Only sections that hold ONE set of values are included: `fields`, `checklist`
 * and `gallery`. Repeaters (the trenches) are per-item and have their own
 * presentation — the map and the item's photos — so flattening them here would
 * only produce `depth_cm` three times with no way to tell them apart.
 *
 * Unanswered fields are left out entirely rather than rendered blank, so the
 * list says what was captured and nothing else. The first section to declare a
 * key wins, which matters only if a plan ever repeats one.
 */
export function captureDetailEntries(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
): CaptureDetailEntry[] {
  if (!plan) return []
  const entries: CaptureDetailEntry[] = []
  const seen = new Set<string>()

  for (const section of plan.sections) {
    if (section.kind === 'repeater') continue
    const values = sectionValues(answers, section.key)
    for (const field of sectionFields(section)) {
      if (seen.has(field.key)) continue
      const value = values[field.key]
      if (value === undefined || value === null || value === '') continue
      seen.add(field.key)
      entries.push({ key: field.key, labelKey: field.labelKey, value })
    }
  }

  return entries
}

/** The same data as a plain record, for the places that compare it key by key. */
export function captureDetailRecord(
  plan: CapturePlan | null,
  answers: CaptureAnswers,
): Record<string, unknown> {
  return Object.fromEntries(captureDetailEntries(plan, answers).map((e) => [e.key, e.value]))
}

// ── Node ids ─────────────────────────────────────────────────────────────────

export function slotNodeId(sectionKey: string, slotKey: string, itemId: string | null): string {
  return itemId ? `${sectionKey}:${itemId}:${slotKey}` : `${sectionKey}:${slotKey}`
}

export function fieldNodeId(sectionKey: string, fieldKey: string, itemId: string | null): string {
  return itemId ? `${sectionKey}:${itemId}:${fieldKey}` : `${sectionKey}:${fieldKey}`
}

// ── Evaluation ───────────────────────────────────────────────────────────────

function sectionSlots(section: CaptureSection): CapturePhotoSlot[] {
  return 'slots' in section ? section.slots : []
}

function sectionFields(section: CaptureSection): CaptureField[] {
  return 'fields' in section ? section.fields : []
}

function collectSlotAddresses(plan: CapturePlan, answers: CaptureAnswers): SlotAddress[] {
  const addresses: SlotAddress[] = []
  for (const section of plan.sections) {
    if (section.kind === 'repeater') {
      for (const item of repeaterItems(answers, section.key)) {
        for (const slot of section.slots) {
          addresses.push({
            sectionKey: section.key,
            slotKey: slot.key,
            itemId: item.id,
            legacyType: slot.legacyType,
          })
        }
      }
      continue
    }
    for (const slot of sectionSlots(section)) {
      addresses.push({
        sectionKey: section.key,
        slotKey: slot.key,
        itemId: null,
        legacyType: slot.legacyType,
      })
    }
  }
  return addresses
}

function evaluateSlot(
  section: CaptureSection,
  slot: CapturePhotoSlot,
  itemId: string | null,
  sectionVisible: boolean,
  answers: CaptureAnswers,
  item: CaptureRepeaterItem | null,
  counts: Map<string, number>,
): CaptureSlotState {
  const nodeId = slotNodeId(section.key, slot.key, itemId)
  const visible = sectionVisible && conditionMet(slot.condition, answers, item)
  const count = counts.get(nodeId) ?? 0
  const max = slot.max ?? null
  const missing = visible ? Math.max(0, slot.min - count) : 0

  return {
    nodeId,
    sectionKey: section.key,
    slotKey: slot.key,
    itemId,
    min: slot.min,
    max,
    count,
    visible,
    missing,
    satisfied: missing === 0,
    overflow: max !== null && count > max,
  }
}

function evaluateField(
  section: CaptureSection,
  field: CaptureField,
  itemId: string | null,
  sectionVisible: boolean,
  answers: CaptureAnswers,
  values: CaptureFieldValues,
  item: CaptureRepeaterItem | null,
): CaptureFieldState {
  const visible = sectionVisible && conditionMet(field.condition, answers, item)
  const filled = isFieldFilled(field, values[field.key])
  const required = field.required === true

  return {
    nodeId: fieldNodeId(section.key, field.key, itemId),
    sectionKey: section.key,
    fieldKey: field.key,
    itemId,
    required,
    visible,
    filled,
    satisfied: !visible || !required || filled,
  }
}

/**
 * What the Rückmeldung still owes its plan, in plan order, one line per node:
 * `Fotos catas[2].closed (1)`, `Angabe details.meters`, `Einträge catas (1)`.
 *
 * These are the exact tokens `capture_plan_missing_nodes()` builds in migration
 * 054, so the admin reads the same sentence whether the client-side check or the
 * certification gate rejected the order.
 */
export function describeMissingNodes(evaluation: CapturePlanEvaluation): string[] {
  const itemIndex = new Map<string, number>()
  for (const section of evaluation.sections) {
    for (const item of section.items) {
      itemIndex.set(`${section.key}:${item.itemId}`, item.index + 1)
    }
  }

  return evaluation.missing.map((node) => {
    const index = node.itemId ? itemIndex.get(`${node.sectionKey}:${node.itemId}`) : undefined
    const path = index === undefined ? node.sectionKey : `${node.sectionKey}[${index}]`
    if (node.kind === 'photos') return `Fotos ${path}.${node.slotKey} (${node.count})`
    if (node.kind === 'field') return `Angabe ${path}.${node.fieldKey}`
    return `Einträge ${node.sectionKey} (${node.count})`
  })
}

export function evaluateCapturePlan(
  plan: CapturePlan,
  photos: CapturedPhotoRef[],
  answers: CaptureAnswers,
): CapturePlanEvaluation {
  const counts = countPhotosPerSlot(photos, collectSlotAddresses(plan, answers))
  const sections: CaptureSectionState[] = []
  const missing: CaptureMissingNode[] = []

  for (const section of plan.sections) {
    const visible = conditionMet(section.condition, answers)
    const slots: CaptureSlotState[] = []
    const fields: CaptureFieldState[] = []
    const items: CaptureItemState[] = []
    let itemCount = 0
    let missingItems = 0

    if (section.kind === 'repeater') {
      const sectionItems = repeaterItems(answers, section.key)
      itemCount = sectionItems.length
      missingItems = visible ? Math.max(0, section.min - itemCount) : 0

      if (missingItems > 0) {
        missing.push({
          nodeId: section.key,
          kind: 'items',
          sectionKey: section.key,
          itemId: null,
          count: missingItems,
        })
      }

      sectionItems.forEach((item, index) => {
        const itemSlots = section.slots.map((slot) =>
          evaluateSlot(section, slot, item.id, visible, answers, item, counts),
        )
        const itemFields = section.fields.map((field) =>
          evaluateField(section, field, item.id, visible, answers, item.values, item),
        )

        for (const slot of itemSlots) {
          if (slot.missing > 0) {
            missing.push({
              nodeId: slot.nodeId,
              kind: 'photos',
              sectionKey: section.key,
              itemId: item.id,
              slotKey: slot.slotKey,
              count: slot.missing,
            })
          }
        }
        for (const field of itemFields) {
          if (!field.satisfied) {
            missing.push({
              nodeId: field.nodeId,
              kind: 'field',
              sectionKey: section.key,
              itemId: item.id,
              fieldKey: field.fieldKey,
              count: 1,
            })
          }
        }

        items.push({
          itemId: item.id,
          index,
          slots: itemSlots,
          fields: itemFields,
          satisfied:
            itemSlots.every((slot) => slot.satisfied) && itemFields.every((field) => field.satisfied),
        })
        slots.push(...itemSlots)
        fields.push(...itemFields)
      })
    } else {
      const values = sectionValues(answers, section.key)

      for (const slot of sectionSlots(section)) {
        const state = evaluateSlot(section, slot, null, visible, answers, null, counts)
        slots.push(state)
        if (state.missing > 0) {
          missing.push({
            nodeId: state.nodeId,
            kind: 'photos',
            sectionKey: section.key,
            itemId: null,
            slotKey: state.slotKey,
            count: state.missing,
          })
        }
      }

      for (const field of sectionFields(section)) {
        const state = evaluateField(section, field, null, visible, answers, values, null)
        fields.push(state)
        if (!state.satisfied) {
          missing.push({
            nodeId: state.nodeId,
            kind: 'field',
            sectionKey: section.key,
            itemId: null,
            fieldKey: state.fieldKey,
            count: 1,
          })
        }
      }
    }

    sections.push({
      key: section.key,
      kind: section.kind,
      visible,
      satisfied:
        missingItems === 0 &&
        slots.every((slot) => slot.satisfied) &&
        fields.every((field) => field.satisfied),
      slots,
      fields,
      items,
      itemCount,
      missingItems,
    })
  }

  const missingPhotoCount = missing
    .filter((node) => node.kind === 'photos')
    .reduce((total, node) => total + node.count, 0)
  const missingFieldCount = missing.filter((node) => node.kind === 'field').length

  return {
    planKey: plan.key,
    planVersion: plan.version,
    sections,
    missing,
    missingPhotoCount,
    missingFieldCount,
    canSubmit: missing.length === 0,
  }
}
