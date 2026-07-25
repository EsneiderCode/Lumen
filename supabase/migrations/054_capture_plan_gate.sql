-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 054 — The certification gate reads the capture plan
-- Depends on: 016_mvp_business_logic_hardening.sql, 052_capture_plans.sql,
--             053_capture_plan_soplado_ra.sql
-- Purpose:
--   Phase 5 of the Rückmeldung capture flow. Until now the plan was enforced
--   only by the browser: `assert_work_order_rueckmeldung_complete` (016) still
--   demanded one 'before' + one 'during' + one 'after' photo and the required
--   columns of the matching wo_detail_* table. Everything the plan adds — the
--   four mandatory photos of Soplado de RA, the trench data, the duct
--   checklist — was a UI rule, which is exactly what putting the plans in the
--   database (052) was meant to avoid.
--
--   From here the gate evaluates the plan itself: it is the SQL twin of
--   evaluateCapturePlan() in src/services/capturePlanEngine.ts, and the two must
--   stay in sync — this side is authoritative for enforcement, that one for the
--   UI and for the client-side check in workOrderService.ts.
--
--   Backwards compatibility (decided with Alejandro, 2026-07-25):
--     - An order with NO row in work_order_capture_reports — every order
--       captured before phase 2 — falls back to the 016 gate, preserved verbatim
--       as assert_work_order_rueckmeldung_complete_legacy(). Orders in flight
--       must not become uncertifiable.
--     - Photos with no section_key/slot_key are matched to the first top-level
--       slot carrying the same legacyType, exactly as countPhotosPerSlot() does
--       in TypeScript, so a half-migrated order still counts its photos.
--     - A plan key that exists in no plan of the catalog is an explicit error,
--       never a silent pass. This can only happen once a capture report exists,
--       so an unseeded catalog can never block an old order.
--
--   The report pins the (plan_key, plan_version) it was captured under and that
--   exact version is what gets evaluated, so publishing a stricter plan cannot
--   retroactively invalidate a Rückmeldung already sent. If the admin has since
--   changed work_orders.capture_plan_key, that new key wins — the change is a
--   deliberate "capture this differently".
--
--   NOT enforced here on purpose: that the legacy wo_detail_* row got written.
--   The plan's `details` section carries the same columns and the client writes
--   both in the same submit (phase 2 double write); the legacy tables disappear
--   in phase 7.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) The 016 gate, preserved ───────────────────────────────────────────────────
-- Verbatim body of assert_work_order_rueckmeldung_complete as shipped in 016.
-- Only reachable now for orders with no capture report.

CREATE OR REPLACE FUNCTION public.assert_work_order_rueckmeldung_complete_legacy(
  p_work_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  order_type public.work_type;
  missing_photo_types text[];
begin
  select work_type into order_type from public.work_orders where id = p_work_order_id;

  if order_type is null then
    raise exception 'work order not found' using errcode = 'check_violation';
  end if;

  if order_type = 'soplado' and not exists (
    select 1 from public.wo_detail_soplado
    where work_order_id = p_work_order_id
      and coalesce(meters, 0) > 0
      and length(trim(coalesce(section, ''))) > 0
      and length(trim(coalesce(tube_diameter, ''))) > 0
      and length(trim(coalesce(result, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for soplado' using errcode = 'check_violation';
  elsif order_type in ('fusion_ap', 'fusion_dp') and not exists (
    select 1 from public.wo_detail_fusion_ap
    where work_order_id = p_work_order_id
      and coalesce(splice_count, 0) > 0
      and length(trim(coalesce(fiber_type, ''))) > 0
      and has_measurement_cert is true
  ) and not exists (
    select 1 from public.wo_detail_fusion_dp
    where work_order_id = p_work_order_id
      and coalesce(splice_count, 0) > 0
      and length(trim(coalesce(fiber_type, ''))) > 0
      and has_measurement_cert is true
  ) then
    raise exception 'Rückmeldung unvollständig for fusion' using errcode = 'check_violation';
  elsif order_type = 'alta' and not exists (
    select 1 from public.wo_detail_alta
    where work_order_id = p_work_order_id
      and length(trim(coalesce(access_type, ''))) > 0
      and length(trim(coalesce(equipment_installed, ''))) > 0
      and client_signature is true
  ) then
    raise exception 'Rückmeldung unvollständig for alta' using errcode = 'check_violation';
  elsif order_type = 'nt_installation' and not exists (
    select 1 from public.wo_detail_nt
    where work_order_id = p_work_order_id
      and length(trim(coalesce(nt_type, ''))) > 0
      and length(trim(coalesce(serial_number, ''))) > 0
      and length(trim(coalesce(location, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for nt_installation' using errcode = 'check_violation';
  elsif order_type = 'patchkabel' and not exists (
    select 1 from public.wo_detail_patchkabel
    where work_order_id = p_work_order_id
      and length(trim(coalesce(connected_section, ''))) > 0
      and coalesce(cable_length, 0) > 0
      and length(trim(coalesce(connector_type, ''))) > 0
      and length(trim(coalesce(test_result, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for patchkabel' using errcode = 'check_violation';
  end if;

  select array_agg(required_photo)
    into missing_photo_types
  from unnest(array['before', 'during', 'after']) as required_photo
  where not exists (
    select 1 from public.work_order_photos
    where work_order_id = p_work_order_id
      and photo_type = required_photo
  );

  if coalesce(array_length(missing_photo_types, 1), 0) > 0 then
    raise exception 'Fehlende Fotos: %', array_to_string(missing_photo_types, ', ')
      using errcode = 'check_violation';
  end if;
end;
$$;

COMMENT ON FUNCTION public.assert_work_order_rueckmeldung_complete_legacy(uuid) IS
  'Pre-capture-plan completeness gate (016). Used for orders with no capture report.';

-- 2) The conditional primitive ────────────────────────────────────────────────
-- Twin of conditionMet() in capturePlanEngine.ts. `path` is either
-- `item.<field>` — resolved against the repeater item being evaluated — or
-- `<section>.<field>`, resolved against the whole answer set. An unanswered
-- field and "expected null" are the same thing, as in the engine.

CREATE OR REPLACE FUNCTION public.capture_condition_met(
  p_condition jsonb,
  p_answers   jsonb,
  p_item      jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_path    text;
  v_dot     integer;
  v_head    text;
  v_field   text;
  v_holder  jsonb;
  v_actual  jsonb;
BEGIN
  IF p_condition IS NULL OR jsonb_typeof(p_condition) <> 'object' THEN
    RETURN true;
  END IF;

  -- A condition without `equals` is malformed; nothing can satisfy it.
  IF NOT jsonb_exists(p_condition, 'equals') THEN
    RETURN false;
  END IF;

  v_path := coalesce(p_condition->>'path', '');
  v_dot  := position('.' in v_path);
  -- No dot (0) or leading dot (1): unresolvable, same as an unanswered field.
  IF v_dot > 1 THEN
    v_head  := left(v_path, v_dot - 1);
    v_field := substr(v_path, v_dot + 1);

    IF v_head = 'item' THEN
      v_holder := p_item->'values';
    ELSE
      v_holder := p_answers->v_head;
    END IF;

    IF v_holder IS NOT NULL AND jsonb_typeof(v_holder) = 'object' THEN
      v_actual := v_holder->v_field;
    END IF;
  END IF;

  IF v_actual IS NULL THEN
    RETURN jsonb_typeof(p_condition->'equals') = 'null';
  END IF;

  RETURN v_actual = p_condition->'equals';
END;
$$;

-- 3) Field completeness ───────────────────────────────────────────────────────
-- Twin of isFieldFilled(): number > 0 unless the field declares its own `min`,
-- checkbox must be checked, yesno only has to be answered ("no" is an answer),
-- geopoint needs finite coordinates.

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
  END IF;

  RETURN false;
END;
$$;

-- 4) Plan evaluation ──────────────────────────────────────────────────────────
-- Twin of evaluateCapturePlan(), reduced to what the gate needs: the ordered
-- list of what is still missing. Empty array = the Rückmeldung is complete.
--
-- Every node is reported as `<section>[<n>].<slot|field>`, the same path the
-- technician's screen scrolls to, so "Angabe catas[2].depth_cm" is actionable
-- without opening the plan.

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

  -- 4b) Photo counts. A photo counts for at most one slot; one pointing at a
  --     slot this plan version no longer has counts for nothing.
  SELECT coalesce(jsonb_object_agg(node_id, photo_count), '{}'::jsonb)
    INTO v_assigned
  FROM (
    SELECT CASE
             WHEN item_id IS NULL THEN section_key || ':' || slot_key
             ELSE section_key || ':' || item_id || ':' || slot_key
           END AS node_id,
           count(*)::integer AS photo_count
    FROM public.work_order_photos
    WHERE work_order_id = p_work_order_id
      AND section_key IS NOT NULL
      AND slot_key IS NOT NULL
    GROUP BY 1
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
  'Everything a work order still owes its capture plan. SQL twin of evaluateCapturePlan().';

-- 5) The gate ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assert_work_order_rueckmeldung_complete(
  p_work_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report   public.work_order_capture_reports%ROWTYPE;
  v_plan_key text;
  v_plan     jsonb;
  v_missing  text[];
  v_shown    text[];
  v_total    integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.work_orders WHERE id = p_work_order_id) THEN
    RAISE EXCEPTION 'work order not found' USING errcode = 'check_violation';
  END IF;

  SELECT * INTO v_report
  FROM public.work_order_capture_reports
  WHERE work_order_id = p_work_order_id;

  -- Captured before the plans existed: judge it by the rules it was captured
  -- under, or every order in flight becomes uncertifiable.
  IF NOT FOUND THEN
    PERFORM public.assert_work_order_rueckmeldung_complete_legacy(p_work_order_id);
    RETURN;
  END IF;

  v_plan_key := public.work_order_capture_plan_key(p_work_order_id);

  -- The pinned version, so a stricter plan published later cannot invalidate a
  -- Rückmeldung already sent. A plan key changed on the order since then wins.
  IF v_report.plan_key = v_plan_key THEN
    SELECT definition INTO v_plan
    FROM public.capture_plans
    WHERE key = v_report.plan_key AND version = v_report.plan_version;
  END IF;
  IF v_plan IS NULL THEN
    v_plan := public.current_capture_plan(v_plan_key);
  END IF;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Erfassungsplan "%" nicht gefunden — Rückmeldung nicht prüfbar', v_plan_key
      USING errcode = 'check_violation';
  END IF;

  v_missing := public.capture_plan_missing_nodes(
    p_work_order_id, v_plan, coalesce(v_report.answers, '{}'::jsonb)
  );

  v_total := coalesce(array_length(v_missing, 1), 0);
  IF v_total > 0 THEN
    -- The admin reads this while certifying; the first few say enough.
    v_shown := v_missing[1:6];
    IF v_total > 6 THEN
      v_shown := v_shown || format('… (+%s)', v_total - 6);
    END IF;
    RAISE EXCEPTION 'Rückmeldung unvollständig (%): %',
      v_plan_key, array_to_string(v_shown, '; ')
      USING errcode = 'check_violation';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_work_order_rueckmeldung_complete(uuid) IS
  'Certification gate: evaluates the order''s capture plan (054), or the 016 rules when it has no capture report.';
