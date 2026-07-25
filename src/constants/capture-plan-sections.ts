// Shared builders for the parts of a capture plan that mirror the legacy
// `wo_detail_*` tables.
//
// Both the default plans (`capture-plans.ts`) and the hand-written ones
// (`capture-plans-soplado-ra.ts`) need the very same detail section: the SQL
// certification gate of migration 016 and `REQUIRED_DETAIL_FIELDS` in
// workOrderService.ts still read those columns, whatever plan the order was
// captured under. Building it in one place is what keeps a new plan from
// silently dropping a field the gate demands.
//
// This module dies with the detail tables in phase 7.

import { DETAIL_FIELDS, type DetailField } from '@/constants/detail-fields'
import type {
  CaptureField,
  CaptureFieldsSection,
  CapturePhotoSlot,
  LegacyPhotoType,
} from '@/types/capture-plan'
import type { WorkType } from '@/types/enums'

/**
 * Fields the order must carry to be certifiable today. It is the union of the
 * two gates that are both enforced right now — the SQL one in
 * `assert_work_order_rueckmeldung_complete` (016) and the client-side
 * `REQUIRED_DETAIL_FIELDS` in `workOrderService.ts` — because an order has to
 * pass both. They differ: SQL also demands soplado's tube_diameter/result, the
 * client also demands the fusion cabinet_code.
 *
 * 'pop' is absent on purpose: POP orders have no certification gate today.
 */
export const REQUIRED_BY_WORK_TYPE: Partial<Record<WorkType, readonly string[]>> = {
  soplado: ['meters', 'section', 'tube_diameter', 'result'],
  fusion_ap: ['cabinet_code', 'splice_count', 'fiber_type', 'has_measurement_cert'],
  fusion_dp: ['cabinet_code', 'splice_count', 'fiber_type', 'has_measurement_cert'],
  alta: ['access_type', 'equipment_installed', 'client_signature'],
  nt_installation: ['nt_type', 'serial_number', 'location'],
  patchkabel: ['connected_section', 'cable_length', 'connector_type', 'test_result'],
}

/** Numeric fields where 0 is a legitimate value, so the default "> 0" must not apply. */
const ZERO_IS_VALID = new Set(['card_count', 'fusion_losses', 'tray_count'])

export const LEGACY_DETAIL_TABLE: Record<WorkType, string> = {
  soplado: 'wo_detail_soplado',
  fusion_ap: 'wo_detail_fusion_ap',
  fusion_dp: 'wo_detail_fusion_dp',
  alta: 'wo_detail_alta',
  nt_installation: 'wo_detail_nt',
  patchkabel: 'wo_detail_patchkabel',
  pop: 'wo_detail_pop',
}

export function toCaptureField(field: DetailField, required: boolean): CaptureField {
  const captured: CaptureField = {
    key: field.key,
    type: field.type,
    labelKey: `detailField.${field.key}`,
    legacyColumn: field.key,
  }
  if (field.placeholder) captured.placeholderKey = `detailPlaceholder.${field.key}`
  if (field.options) captured.options = [...field.options]
  if (required) captured.required = true
  if (field.type === 'number' && ZERO_IS_VALID.has(field.key)) captured.min = 0
  return captured
}

export function legacyPhotoSlot(type: LegacyPhotoType): CapturePhotoSlot {
  return {
    key: type,
    min: 1,
    labelKey: `photo.${type}`,
    legacyType: type,
  }
}

/**
 * The `details` section of a plan: every column of the work type's detail table,
 * with the ones both current gates demand marked required.
 */
export function legacyDetailsSection(workType: WorkType): CaptureFieldsSection {
  const required = new Set(REQUIRED_BY_WORK_TYPE[workType] ?? [])
  return {
    key: 'details',
    kind: 'fields',
    // Not `rueckmeldung.details.title`: that one interpolates {{workType}},
    // which a plan-driven section header has no way to supply.
    titleKey: 'capture.section.details',
    descriptionKey: 'rueckmeldung.details.subtitle',
    legacyTable: LEGACY_DETAIL_TABLE[workType],
    fields: DETAIL_FIELDS[workType].map((field) => toCaptureField(field, required.has(field.key))),
  }
}
