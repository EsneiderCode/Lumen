// Bridge between capture-plan answers and the legacy `wo_detail_*` tables.
//
// Phase 2 writes BOTH: the answers blob (the future) and the detail row (what
// the SQL certification gate, the PDF and the admin certification screen still
// read today). These two pure functions are the whole mapping, so the double
// write cannot drift between the save path and the prefill path.
//
// They disappear in phase 7, together with the detail tables.

import type {
  CaptureAnswers,
  CaptureField,
  CaptureFieldValues,
  CapturePlan,
  CaptureSection,
} from '@/types/capture-plan'

interface LegacySectionMapping {
  section: CaptureSection
  fields: CaptureField[]
}

/** Sections that mirror a `wo_detail_*` row — plain field sections with a legacy table. */
function legacyMappings(plan: CapturePlan): LegacySectionMapping[] {
  const mappings: LegacySectionMapping[] = []
  for (const section of plan.sections) {
    if (section.kind !== 'fields' || !section.legacyTable) continue
    const fields = section.fields.filter((field) => Boolean(field.legacyColumn))
    if (fields.length > 0) mappings.push({ section, fields })
  }
  return mappings
}

/** The `wo_detail_*` table a plan writes to, or null for plans with no legacy home. */
export function legacyDetailTable(plan: CapturePlan): string | null {
  const [first] = legacyMappings(plan)
  return first ? (first.section as { legacyTable?: string }).legacyTable ?? null : null
}

/**
 * Flattens the answers into the column/value shape of the legacy detail row.
 * Only columns the plan actually declares are touched, so a detail row keeps
 * any column the plan does not know about (`reported_service_items`).
 */
export function legacyDetailFromAnswers(
  plan: CapturePlan,
  answers: CaptureAnswers,
): Record<string, unknown> {
  const detail: Record<string, unknown> = {}

  for (const { section, fields } of legacyMappings(plan)) {
    const values = (answers[section.key] ?? {}) as CaptureFieldValues
    for (const field of fields) {
      const value = values[field.key]
      if (value === undefined) continue
      detail[field.legacyColumn as string] =
        field.type === 'number' && typeof value === 'string'
          ? value.trim() === ''
            ? null
            : Number(value)
          : value
    }
  }

  return detail
}

/**
 * Seeds the answers from an existing legacy detail row, so an order captured
 * before the plans — or edited from the admin form — opens with its values in
 * place instead of an empty screen.
 */
export function answersFromLegacyDetail(
  plan: CapturePlan,
  detail: Record<string, unknown> | null | undefined,
): CaptureAnswers {
  if (!detail) return {}
  const answers: CaptureAnswers = {}

  for (const { section, fields } of legacyMappings(plan)) {
    const values: CaptureFieldValues = {}
    for (const field of fields) {
      const value = detail[field.legacyColumn as string]
      if (value === undefined || value === null) continue
      if (field.type === 'checkbox' || field.type === 'yesno') {
        values[field.key] = value === true
      } else if (field.type === 'number') {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (Number.isFinite(numeric)) values[field.key] = numeric
      } else {
        values[field.key] = String(value)
      }
    }
    if (Object.keys(values).length > 0) answers[section.key] = values
  }

  return answers
}

/**
 * Merges a legacy detail row UNDER the stored answers: the answers blob wins
 * wherever it has a value, the detail row fills the gaps. That is what makes an
 * order captured before phase 2 open with its data, without a later legacy edit
 * silently overwriting what the technician typed into the plan.
 */
export function mergeAnswers(base: CaptureAnswers, override: CaptureAnswers): CaptureAnswers {
  const merged: CaptureAnswers = { ...base }

  for (const [sectionKey, value] of Object.entries(override)) {
    if (value === undefined) continue
    const existing = merged[sectionKey]
    if (Array.isArray(value) || Array.isArray(existing) || existing === undefined) {
      merged[sectionKey] = value
      continue
    }
    merged[sectionKey] = { ...existing, ...value }
  }

  return merged
}
