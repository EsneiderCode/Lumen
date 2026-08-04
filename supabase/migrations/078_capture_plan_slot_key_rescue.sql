-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 078 — una foto la identifica su slot, no la sección que la enseña
-- Depends on: 054_capture_plan_gate.sql, 076_capture_plan_soplado_ra_v4.sql
-- Purpose:
--   La 076 movió las cuatro fotos obligatorias de `soplado_ra` de la sección
--   `mandatory` a `dp`/`pop`. Pero la puerta juzga cada Rückmeldung contra la
--   VERSIÓN DEL PLAN con la que se capturó (`plan_version` del informe), y una
--   orden anclada a la v1/v2/v3 tiene un plan cuya sección se sigue llamando
--   `mandatory`. Como el emparejamiento foto↔hueco se hacía por
--   `sección:slot`, esas fotos dejaron de contar para nadie:
--
--     Rückmeldung unvollständig (soplado_ra): Fotos mandatory.fiber_dp (1);
--     Fotos mandatory.fiber_dp_gasblock (1); Fotos mandatory.fiber_pop_label (1);
--     Fotos mandatory.balloon_pop (1)
--
--   …con las cuatro fotos subidas y visibles. Bloqueó las órdenes
--   LUM-20260727-1016, -1017 y -1018 (las tres ancladas a la v2).
--
--   El fallo no es de la 076 sino de la premisa: la SECCIÓN es dónde se enseña
--   la foto, una decisión de presentación que se reordena cuando conviene. Lo
--   que identifica la foto es su SLOT — `fiber_dp` es la fibra en el DP tanto en
--   la v2 como en la v4. Reagrupar secciones no puede invalidar evidencia ya
--   capturada, y hasta hoy sí podía.
--
--   Esta migración añade un segundo intento al emparejamiento: si la dirección
--   con la que se selló la foto no existe en la versión que se está evaluando,
--   se busca su `slot_key` (con el mismo `item_id`) en el plan. Solo cuenta si
--   hay UN único hueco con ese nombre: dos candidatos son una ambigüedad real y
--   la foto no cuenta, como hasta ahora.
--
-- Notes:
--   No se toca ningún dato. Las cuatro fotos se quedan en `dp`/`pop`, que es
--   donde la v4 las enseña; lo que cambia es cómo las encuentra la v2.
--
--   El rescate NO puede aflojar la puerta: solo se activa cuando la dirección
--   exacta no existe en el plan, y nunca reparte una foto entre dos huecos. Una
--   orden a la que le falte una foto de verdad sigue sin certificar.
--
--   `capturePlanEngine.ts` lleva el mismo rescate — la puerta del cliente y ésta
--   tienen que dar la misma respuesta, palabra por palabra.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_plan_missing_nodes(
  p_work_order_id uuid,
  p_plan          jsonb,
  p_answers       jsonb
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing       text[] := '{}';
  -- nodeId → photo count, for photos stamped with their slot.
  v_assigned      jsonb  := '{}'::jsonb;
  -- nodeId → photo count, for photos predating the plans (matched by photo_type).
  v_legacy        jsonb  := '{}'::jsonb;
  -- legacyType → nodeId of the first top-level slot that claims it.
  v_legacy_target jsonb  := '{}'::jsonb;
  -- Every photo address this plan version has: {node, section, slot, item}.
  v_addresses     jsonb  := '[]'::jsonb;
  v_section       jsonb;
  v_slot          jsonb;
  v_field         jsonb;
  v_item          jsonb;
  v_cond_item     jsonb;
  v_items         jsonb;
  v_values        jsonb;
  v_section_key   text;
  v_is_repeater   boolean;
  v_visible       boolean;
  v_item_id       text;
  v_index         integer;
  v_node          text;
  v_path          text;
  v_count         integer;
  v_min           integer;
BEGIN
  IF p_plan IS NULL OR jsonb_typeof(p_plan->'sections') <> 'array' THEN
    RETURN v_missing;
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    p_answers := '{}'::jsonb;
  END IF;

  -- 4a) Which top-level slot inherits each legacy photo bucket. First one wins,
  --     in plan order, exactly like the engine's slotAddresses.find().
  FOR v_section IN SELECT * FROM jsonb_array_elements(p_plan->'sections') LOOP
    CONTINUE WHEN coalesce(v_section->>'kind', '') = 'repeater';
    FOR v_slot IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'slots', '[]'::jsonb)) LOOP
      CONTINUE WHEN v_slot->>'legacyType' IS NULL;
      CONTINUE WHEN jsonb_exists(v_legacy_target, v_slot->>'legacyType');
      v_legacy_target := v_legacy_target || jsonb_build_object(
        v_slot->>'legacyType',
        (v_section->>'key') || ':' || (v_slot->>'key')
      );
    END LOOP;
  END LOOP;

  -- 4a-bis) Every address this version has, collected like the engine's
  --         collectSlotAddresses(): conditions are ignored on purpose — a hidden
  --         slot still owns the photos that were taken for it.
  FOR v_section IN SELECT * FROM jsonb_array_elements(p_plan->'sections') LOOP
    v_section_key := v_section->>'key';

    IF coalesce(v_section->>'kind', '') = 'repeater' THEN
      FOR v_item IN
        SELECT * FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p_answers->v_section_key) = 'array'
               THEN p_answers->v_section_key
               ELSE '[]'::jsonb END
        )
      LOOP
        CONTINUE WHEN jsonb_typeof(v_item->'id') <> 'string';
        FOR v_slot IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'slots', '[]'::jsonb)) LOOP
          v_addresses := v_addresses || jsonb_build_object(
            'node',    v_section_key || ':' || (v_item->>'id') || ':' || (v_slot->>'key'),
            'section', v_section_key,
            'slot',    v_slot->>'key',
            'item',    v_item->>'id'
          );
        END LOOP;
      END LOOP;
    ELSE
      FOR v_slot IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'slots', '[]'::jsonb)) LOOP
        v_addresses := v_addresses || jsonb_build_object(
          'node',    v_section_key || ':' || (v_slot->>'key'),
          'section', v_section_key,
          'slot',    v_slot->>'key',
          'item',    NULL
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 4b) Photo counts. A photo counts for at most one slot: the address it was
  --     sealed with, and failing that — the section was regrouped between the
  --     version that captured it and the one being evaluated — the only slot of
  --     that name in this version. Two slots of that name is a real ambiguity
  --     and the photo counts for nothing, as does one whose slot is gone.
  SELECT coalesce(jsonb_object_agg(node_id, photo_count), '{}'::jsonb)
    INTO v_assigned
  FROM (
    SELECT resolved.node_id, count(*)::integer AS photo_count
    FROM (
      SELECT coalesce(
               (SELECT a.node
                  FROM jsonb_to_recordset(v_addresses)
                    AS a(node text, section text, slot text, item text)
                 WHERE a.section = p.section_key
                   AND a.slot    = p.slot_key
                   AND a.item IS NOT DISTINCT FROM p.item_id
                 LIMIT 1),
               (SELECT max(a.node)
                  FROM jsonb_to_recordset(v_addresses)
                    AS a(node text, section text, slot text, item text)
                 WHERE a.slot = p.slot_key
                   AND a.item IS NOT DISTINCT FROM p.item_id
                HAVING count(*) = 1)
             ) AS node_id
      FROM public.work_order_photos p
      WHERE p.work_order_id = p_work_order_id
        AND p.section_key IS NOT NULL
        AND p.slot_key IS NOT NULL
    ) resolved
    WHERE resolved.node_id IS NOT NULL
    GROUP BY resolved.node_id
  ) assigned;

  SELECT coalesce(jsonb_object_agg(node_id, photo_count), '{}'::jsonb)
    INTO v_legacy
  FROM (
    SELECT v_legacy_target->>photo_type AS node_id,
           count(*)::integer AS photo_count
    FROM public.work_order_photos
    WHERE work_order_id = p_work_order_id
      AND (section_key IS NULL OR slot_key IS NULL)
      AND photo_type IS NOT NULL
      AND jsonb_exists(v_legacy_target, photo_type)
    GROUP BY 1
  ) legacy;

  -- 4c) Walk the plan. Non-repeater sections are evaluated as a single unnamed
  --     item so both shapes share one loop; `v_cond_item` stays NULL there, so
  --     an `item.<field>` condition resolves to "unanswered" as it does in the
  --     engine.
  FOR v_section IN SELECT * FROM jsonb_array_elements(p_plan->'sections') LOOP
    v_section_key := v_section->>'key';
    v_is_repeater := coalesce(v_section->>'kind', '') = 'repeater';
    v_visible     := public.capture_condition_met(v_section->'condition', p_answers, NULL);

    IF v_is_repeater THEN
      -- Items without a string id are ignored, as in repeaterItems().
      SELECT coalesce(jsonb_agg(element), '[]'::jsonb)
        INTO v_items
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_answers->v_section_key) = 'array'
             THEN p_answers->v_section_key
             ELSE '[]'::jsonb END
      ) AS element
      WHERE jsonb_typeof(element->'id') = 'string';

      v_min := coalesce((v_section->>'min')::integer, 0);
      IF v_visible AND jsonb_array_length(v_items) < v_min THEN
        v_missing := v_missing || format(
          'Einträge %s (%s)', v_section_key, v_min - jsonb_array_length(v_items)
        );
      END IF;
    ELSE
      v_values := CASE WHEN jsonb_typeof(p_answers->v_section_key) = 'object'
                       THEN p_answers->v_section_key
                       ELSE '{}'::jsonb END;
      v_items  := jsonb_build_array(jsonb_build_object('values', v_values));
    END IF;

    v_index := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
      v_index     := v_index + 1;
      v_item_id   := v_item->>'id';
      v_values    := CASE WHEN jsonb_typeof(v_item->'values') = 'object'
                          THEN v_item->'values'
                          ELSE '{}'::jsonb END;
      v_cond_item := CASE WHEN v_is_repeater THEN v_item ELSE NULL END;
      v_path      := CASE WHEN v_is_repeater
                          THEN format('%s[%s]', v_section_key, v_index)
                          ELSE v_section_key END;

      FOR v_slot IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'slots', '[]'::jsonb)) LOOP
        CONTINUE WHEN NOT v_visible;
        CONTINUE WHEN NOT public.capture_condition_met(v_slot->'condition', p_answers, v_cond_item);

        v_node := CASE
                    WHEN v_item_id IS NULL THEN v_section_key || ':' || (v_slot->>'key')
                    ELSE v_section_key || ':' || v_item_id || ':' || (v_slot->>'key')
                  END;
        v_count := coalesce((v_assigned->>v_node)::integer, 0)
                 + coalesce((v_legacy->>v_node)::integer, 0);
        v_min   := coalesce((v_slot->>'min')::integer, 0);

        IF v_count < v_min THEN
          v_missing := v_missing || format(
            'Fotos %s.%s (%s)', v_path, v_slot->>'key', v_min - v_count
          );
        END IF;
      END LOOP;

      FOR v_field IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'fields', '[]'::jsonb)) LOOP
        CONTINUE WHEN NOT v_visible;
        CONTINUE WHEN v_field->'required' IS DISTINCT FROM 'true'::jsonb;
        CONTINUE WHEN NOT public.capture_condition_met(v_field->'condition', p_answers, v_cond_item);
        CONTINUE WHEN public.capture_field_filled(v_field, v_values->(v_field->>'key'));

        v_missing := v_missing || format('Angabe %s.%s', v_path, v_field->>'key');
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_missing;
END;
$$;

COMMENT ON FUNCTION public.capture_plan_missing_nodes(uuid, jsonb, jsonb) IS
  'Everything a work order still owes its capture plan. SQL twin of evaluateCapturePlan(). '
  'A photo is identified by its slot: when the pinned version files that slot under '
  'another section (076 regrouped mandatory → dp/pop), it still counts.';
