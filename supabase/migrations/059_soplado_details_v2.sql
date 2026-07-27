-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 059 — Datos técnicos de soplado: versión 2 de los dos planes
-- Depends on: 052_capture_plans.sql, 053_capture_plan_soplado_ra.sql,
--             056_retire_legacy_rueckmeldung_gate.sql
-- Purpose:
--   Primera revisión pedida desde el campo tras usar el flujo de captura:
--     - «Datos técnicos» pasa a ser la PRIMERA sección, en el plan `soplado` y
--       en `soplado_ra`. Es lo que la oficina espera y lo más rápido de
--       rellenar en la furgoneta; las fotos van después.
--     - Desaparece el campo `section` (Abschnitt / «Tramo»). El tramo ya viaja
--       en la propia orden, así que el técnico lo estaba retecleando. La
--       columna `wo_detail_soplado.section` se queda donde está, simplemente
--       sin alimentar: nada la borra y los datos históricos siguen ahí.
--     - `result` encabeza la sección y cambia de valores: OK / NOK / Ausstehend
--       pasan a Abgeschlossen / Storniert / Ausstehend (Finalizado / Cancelado
--       / Pendiente en la interfaz).
--
--   VERSIÓN NUEVA, NUNCA EDICIÓN EN SITIO: `soplado@1` y `soplado_ra@1` se
--   quedan en el catálogo tal cual. Una Rückmeldung ya enviada se juzga contra
--   la versión con la que se capturó (054 §resolución de versión), así que
--   ninguna orden en vuelo se vuelve incertificable por esto — a una capturada
--   bajo v1 se le sigue exigiendo su `section`, que ya rellenó.
--
--   OJO CON `result`: los planes v1 siguen ofreciendo OK/NOK y las órdenes
--   capturadas bajo ellos conservan ese valor. No se migran, a propósito: son
--   la respuesta que dio el técnico bajo el plan que tenía delante, y
--   reescribirla sería inventar un dato. La única orden de soplado que existía
--   al escribir esto es de prueba.
--
--   Generado desde src/constants/capture-plans.ts y capture-plans-soplado-ra.ts
--   — no editar a mano; la prueba de paridad de src/__tests__/capturePlans.test.ts
--   falla si el JSON de aquí se separa del compilado.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('soplado', 2, $plan$
{
  "key": "soplado",
  "version": 2,
  "sections": [
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_soplado",
      "fields": [
        {
          "key": "result",
          "type": "select",
          "labelKey": "detailField.result",
          "legacyColumn": "result",
          "options": [
            "Abgeschlossen",
            "Storniert",
            "Ausstehend"
          ],
          "required": true
        },
        {
          "key": "meters",
          "type": "number",
          "labelKey": "detailField.meters",
          "legacyColumn": "meters",
          "placeholderKey": "detailPlaceholder.meters",
          "required": true
        },
        {
          "key": "tube_diameter",
          "type": "text",
          "labelKey": "detailField.tube_diameter",
          "legacyColumn": "tube_diameter",
          "placeholderKey": "detailPlaceholder.tube_diameter",
          "required": true
        }
      ]
    },
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    }
  ]
}$plan$::jsonb),
  ('soplado_ra', 2, $plan$
{
  "key": "soplado_ra",
  "version": 2,
  "workType": "soplado",
  "titleKey": "capturePlan.sopladoRa.title",
  "sections": [
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_soplado",
      "fields": [
        {
          "key": "result",
          "type": "select",
          "labelKey": "detailField.result",
          "legacyColumn": "result",
          "options": [
            "Abgeschlossen",
            "Storniert",
            "Ausstehend"
          ],
          "required": true
        },
        {
          "key": "meters",
          "type": "number",
          "labelKey": "detailField.meters",
          "legacyColumn": "meters",
          "placeholderKey": "detailPlaceholder.meters",
          "required": true
        },
        {
          "key": "tube_diameter",
          "type": "text",
          "labelKey": "detailField.tube_diameter",
          "legacyColumn": "tube_diameter",
          "placeholderKey": "detailPlaceholder.tube_diameter",
          "required": true
        }
      ]
    },
    {
      "key": "mandatory",
      "kind": "photos",
      "titleKey": "capturePlan.sopladoRa.mandatory.title",
      "descriptionKey": "capturePlan.sopladoRa.mandatory.description",
      "slots": [
        {
          "key": "fiber_dp",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDp.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDp.hint",
          "example": "soplado_ra/fiber_dp.jpg",
          "legacyType": "before"
        },
        {
          "key": "fiber_dp_gasblock",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.hint",
          "example": "soplado_ra/fiber_dp_gasblock.jpg",
          "legacyType": "during"
        },
        {
          "key": "fiber_pop_label",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberPopLabel.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberPopLabel.hint",
          "example": "soplado_ra/fiber_pop_label.jpg",
          "legacyType": "after"
        },
        {
          "key": "balloon_pop",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.balloonPop.label",
          "hintKey": "capturePlan.sopladoRa.slot.balloonPop.hint",
          "example": "soplado_ra/balloon_pop.jpg",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "catas",
      "kind": "repeater",
      "titleKey": "capturePlan.sopladoRa.catas.title",
      "descriptionKey": "capturePlan.sopladoRa.catas.description",
      "itemLabelKey": "capturePlan.sopladoRa.catas.item",
      "min": 0,
      "slots": [
        {
          "key": "before_open",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.beforeOpen.label",
          "hintKey": "capturePlan.sopladoRa.slot.beforeOpen.hint",
          "example": "soplado_ra/cata_before_open.jpg",
          "legacyType": "before"
        },
        {
          "key": "during_open",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.duringOpen.label",
          "hintKey": "capturePlan.sopladoRa.slot.duringOpen.hint",
          "example": "soplado_ra/cata_during_open.jpg",
          "legacyType": "during"
        },
        {
          "key": "closed",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.closed.label",
          "hintKey": "capturePlan.sopladoRa.slot.closed.hint",
          "example": "soplado_ra/cata_closed.jpg",
          "legacyType": "after"
        },
        {
          "key": "safety_signage",
          "min": 0,
          "labelKey": "capturePlan.sopladoRa.slot.safetySignage.label",
          "hintKey": "capturePlan.sopladoRa.slot.safetySignage.hint",
          "example": "soplado_ra/cata_safety_signage.jpg",
          "legacyType": "during",
          "condition": {
            "path": "item.left_open",
            "equals": true
          }
        }
      ],
      "fields": [
        {
          "key": "left_open",
          "type": "yesno",
          "labelKey": "capturePlan.sopladoRa.field.leftOpen",
          "required": true
        },
        {
          "key": "depth_cm",
          "type": "number",
          "labelKey": "capturePlan.sopladoRa.field.depthCm",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.depthCm",
          "required": true
        },
        {
          "key": "location",
          "type": "geopoint",
          "labelKey": "capturePlan.sopladoRa.field.location"
        }
      ]
    },
    {
      "key": "incidents",
      "kind": "gallery",
      "titleKey": "capturePlan.sopladoRa.incidents.title",
      "descriptionKey": "capturePlan.sopladoRa.incidents.description",
      "slots": [
        {
          "key": "photo",
          "min": 0,
          "labelKey": "capturePlan.sopladoRa.slot.incident.label",
          "hintKey": "capturePlan.sopladoRa.slot.incident.hint",
          "legacyType": "during"
        }
      ],
      "fields": [
        {
          "key": "description",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.incidentDescription",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.incidentDescription"
        }
      ]
    },
    {
      "key": "checklist",
      "kind": "checklist",
      "titleKey": "capturePlan.sopladoRa.checklist.title",
      "descriptionKey": "capturePlan.sopladoRa.checklist.description",
      "fields": [
        {
          "key": "duct_as_planned",
          "type": "yesno",
          "labelKey": "capturePlan.sopladoRa.field.ductAsPlanned",
          "required": true
        },
        {
          "key": "trunk_used",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.trunkUsed",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.trunkUsed",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
        },
        {
          "key": "duct_used",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.ductUsed",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.ductUsed",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
        },
        {
          "key": "change_reason",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.changeReason",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.changeReason",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
        }
      ]
    }
  ]
}$plan$::jsonb)
ON CONFLICT (key, version) DO UPDATE
  SET definition = EXCLUDED.definition,
      updated_at = now();
