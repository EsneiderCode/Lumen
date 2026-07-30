-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 071 — Catas: coordenadas antes de las fotos y pin confirmado
-- Depends on: 052_capture_plans.sql, 053_capture_plan_soplado_ra.sql,
--             054_capture_plan_gate.sql, 059_soplado_details_v2.sql
-- Purpose:
--   Segunda revisión pedida desde el campo. Cada cata se documenta ahora en el
--   orden en que ocurre el trabajo:
--     1. sus COORDENADAS, copiadas de la marca de agua que la cámara quemó
--        sobre una de sus fotos — `location` pasa a ser obligatorio y se pide
--        ANTES que las fotos (`lead`);
--     2. las fotos de siempre;
--     3. `pin_confirmed`: ya con un punto que mirar, se le enseña el pin sobre
--        el mapa y el técnico responde por él o lo arrastra.
--
--   Por qué `location` deja de ser opcional: en v1 y v2 se dejó suelto porque
--   la posición salía del EXIF y la galería lo borra, así que exigirlo dejaba
--   al técnico sin poder enviar. La marca de agua no depende del EXIF — está
--   escrita sobre la imagen y él la lee y la teclea —, de modo que la razón que
--   lo mantenía opcional ya no existe. Una cata sin posición es justamente la
--   que la oficina no puede usar.
--
--   `geoconfirm` es un TIPO DE CAMPO NUEVO, no una marca dentro del geopoint,
--   porque esta puerta exige los campos obligatorios uno a uno: así «el pin
--   está confirmado» es una regla de negocio que valida el servidor y no una
--   cortesía de la pantalla. Guarda el instante ISO de la confirmación. Quien
--   mueve el punto la retira (lo hace el cliente): un visto bueno vale para el
--   punto que se confirmó, no para el campo.
--
--   VERSIÓN NUEVA, NUNCA EDICIÓN EN SITIO: `soplado_ra@1` y `@2` se quedan en
--   el catálogo. La puerta juzga cada informe contra la versión que tiene
--   fijada (054 §474: `WHERE key = plan_key AND version = plan_version`), así
--   que una Rückmeldung YA ENVIADA bajo v2 se sigue certificando con las
--   reglas de v2 y no se vuelve incertificable de la noche a la mañana. Un
--   borrador todavía abierto sí pasa a v3 en cuanto el técnico lo vuelva a
--   guardar — que es justo lo que se quiere: esa cata todavía se puede situar.
--
--   Generado desde src/constants/capture-plans-soplado-ra.ts — no editar a
--   mano; la prueba de paridad de src/__tests__/capturePlans.test.ts falla si
--   el JSON de aquí se separa del compilado.
--
--   NACIÓ COMO 065 y se renumeró a 071: el PR #23 ocupa 065–069 con la base
--   cliente-primero, y su migración de cutover (`NOT NULL` + drops) se reserva
--   el 070. No hay nada que deshacer por el cambio de número — las migraciones
--   `0NN` de este repo se aplican a mano y Postgres no las registra: el ledger
--   `supabase_migrations.schema_migrations` se detuvo en la 010.
--
--   AL APLICAR, COMPROBAR EL REF DEL PROYECTO: hay dos proyectos llamados
--   `lumen-prod` en el selector del dashboard. El bueno es
--   `zucmrnuwceugsibndxvc`; `htiozykwntgzbadggsve` es el viejo y sigue activo.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Todo en una transacción A PROPÓSITO: la sección 1 reemplaza la función que
-- valida los campos y la 2 siembra el plan que estrena el tipo `geoconfirm`.
-- Sueltas, un fallo entre ambas deja una puerta que entiende `geoconfirm` y
-- ningún plan que lo use — o peor, el plan sembrado contra una función que aún
-- no sabe validarlo, y toda cata confirmada contaría como incompleta.
BEGIN;

-- 1) La puerta aprende el tipo nuevo ──────────────────────────────────────────
-- Gemelo de isFieldFilled(): un `geoconfirm` está relleno cuando lleva el
-- instante de la confirmación. Sin esta rama, un campo de tipo desconocido cae
-- en el `RETURN false` final y una cata confirmada seguiría contando como
-- incompleta para siempre.

CREATE OR REPLACE FUNCTION public.capture_field_filled(
  p_field jsonb,
  p_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text := p_field->>'type';
  v_text text;
  v_num  numeric;
  v_min  numeric;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN false;
  END IF;

  IF v_type IN ('text', 'select') THEN
    RETURN jsonb_typeof(p_value) = 'string' AND btrim(p_value #>> '{}') <> '';

  ELSIF v_type = 'number' THEN
    IF jsonb_typeof(p_value) = 'number' THEN
      v_num := (p_value #>> '{}')::numeric;
    ELSIF jsonb_typeof(p_value) = 'string' THEN
      -- Mirrors Number(value): blank counts as 0, anything unparseable fails.
      v_text := btrim(p_value #>> '{}');
      IF v_text = '' THEN
        v_num := 0;
      ELSIF v_text ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' THEN
        v_num := v_text::numeric;
      ELSE
        RETURN false;
      END IF;
    ELSE
      RETURN false;
    END IF;

    v_min := nullif(p_field->>'min', '')::numeric;
    IF v_min IS NOT NULL THEN
      RETURN v_num >= v_min;
    END IF;
    RETURN v_num > 0;

  ELSIF v_type = 'checkbox' THEN
    RETURN p_value = 'true'::jsonb;

  ELSIF v_type = 'yesno' THEN
    RETURN jsonb_typeof(p_value) = 'boolean';

  ELSIF v_type = 'geopoint' THEN
    RETURN jsonb_typeof(p_value) = 'object'
       AND jsonb_typeof(p_value->'lat') = 'number'
       AND jsonb_typeof(p_value->'lng') = 'number';

  ELSIF v_type = 'geoconfirm' THEN
    -- El instante en que el técnico dio el pin por bueno.
    RETURN jsonb_typeof(p_value) = 'string' AND btrim(p_value #>> '{}') <> '';
  END IF;

  RETURN false;
END;
$$;

-- 2) Plan «Soplado de RA» v3 ──────────────────────────────────────────────────

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('soplado_ra', 3, $plan$
{
  "key": "soplado_ra",
  "version": 3,
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
ON CONFLICT (key, version) DO UPDATE
  SET definition = EXCLUDED.definition,
      updated_at = now();

COMMIT;
