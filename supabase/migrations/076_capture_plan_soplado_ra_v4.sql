-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 076 — Soplado de RA v4: las fotos obligatorias, por sitio
-- Depends on: 071_capture_plan_soplado_ra_v3.sql
-- Purpose:
--   Las cuatro fotos obligatorias estaban en un único bloque `mandatory` y
--   repartidas a la fuerza entre los cubos antes/durante/después. Por eso una
--   foto del DP con la fibra YA soplada dentro salía clasificada como «Antes»,
--   cuando es un estado terminado: no hay nada «antes» en ella.
--
--   Ese reparto existía por una razón que ya no se sostiene: la puerta vieja
--   exigía una foto de cada cubo y las catas, que son las que naturalmente los
--   aportarían, son opcionales. Desde la 054 la puerta lee el PLAN
--   (`capture_plan_missing_nodes`) y solo recurre a los cubos para las fotos
--   sin `section_key`, es decir las anteriores a la 052.
--
--   v4 parte `mandatory` en dos secciones por DÓNDE se toma la foto — `dp` y
--   `pop` — y marca las cuatro como `after`, que es lo que son. Así la oficina
--   lee la evidencia sitio por sitio: todo lo del DP junto, todo lo del POP
--   junto, y una caja por cata.
--
-- Notes:
--   Las versiones 1-3 siguen en el catálogo: una Rückmeldung ya enviada se juzga
--   contra la versión con la que se capturó, así que ninguna orden en vuelo se
--   vuelve incertificable por esto.
--
--   La sección 2 es OBLIGATORIA y no cosmética. Hay órdenes vivas (`executed` y
--   `returned`) con fotos guardadas bajo `section_key = 'mandatory'`; sin el
--   backfill, la puerta buscaría fotos en `dp`/`pop`, no encontraría ninguna y
--   el técnico vería desaparecer un trabajo que ya había subido.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ambas cosas en una transacción: sembrar el plan sin remapear las fotos deja
-- justamente el agujero que describe la nota de arriba.
BEGIN;

-- 1) El plan v4 ───────────────────────────────────────────────────────────────

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('soplado_ra', 4, $plan$
{
  "key": "soplado_ra",
  "version": 4,
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
      "key": "dp",
      "kind": "photos",
      "titleKey": "capturePlan.sopladoRa.dp.title",
      "descriptionKey": "capturePlan.sopladoRa.dp.description",
      "slots": [
        {
          "key": "fiber_dp",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDp.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDp.hint",
          "example": "soplado_ra/fiber_dp.jpg",
          "legacyType": "after"
        },
        {
          "key": "fiber_dp_gasblock",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.hint",
          "example": "soplado_ra/fiber_dp_gasblock.jpg",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "pop",
      "kind": "photos",
      "titleKey": "capturePlan.sopladoRa.pop.title",
      "descriptionKey": "capturePlan.sopladoRa.pop.description",
      "slots": [
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
          "key": "location",
          "type": "geopoint",
          "labelKey": "capturePlan.sopladoRa.field.location",
          "hintKey": "capturePlan.sopladoRa.hint.location",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.location",
          "required": true,
          "lead": true
        },
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
          "key": "pin_confirmed",
          "type": "geoconfirm",
          "labelKey": "capturePlan.sopladoRa.field.pinConfirmed",
          "hintKey": "capturePlan.sopladoRa.hint.pinConfirmed",
          "required": true
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
}
$plan$::jsonb)
ON CONFLICT (key, version) DO UPDATE SET definition = EXCLUDED.definition;

-- 2) Las fotos ya subidas, a su sitio nuevo ───────────────────────────────────
-- El `slot_key` no cambia entre v3 y v4, así que es él quien dice a qué sección
-- pertenece cada foto. Solo se tocan las de este plan.

UPDATE public.work_order_photos p
SET section_key = CASE p.slot_key
      WHEN 'fiber_dp'          THEN 'dp'
      WHEN 'fiber_dp_gasblock' THEN 'dp'
      WHEN 'fiber_pop_label'   THEN 'pop'
      WHEN 'balloon_pop'       THEN 'pop'
    END
FROM public.work_orders w
WHERE w.id = p.work_order_id
  AND w.capture_plan_key = 'soplado_ra'
  AND p.section_key = 'mandatory'
  AND p.slot_key IN ('fiber_dp', 'fiber_dp_gasblock', 'fiber_pop_label', 'balloon_pop');

-- Y su clasificación heredada, que es lo que ve el PDF del certificado: las
-- cuatro documentan un estado terminado.
UPDATE public.work_order_photos p
SET photo_type = 'after'
FROM public.work_orders w
WHERE w.id = p.work_order_id
  AND w.capture_plan_key = 'soplado_ra'
  AND p.section_key IN ('dp', 'pop')
  AND p.photo_type <> 'after';

COMMIT;
