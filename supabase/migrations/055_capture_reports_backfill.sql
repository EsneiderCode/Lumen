-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 055 — Backfill the capture reports from the legacy detail tables
-- Depends on: 052_capture_plans.sql, 053_capture_plan_soplado_ra.sql,
--             054_capture_plan_gate.sql
-- Purpose:
--   First step of phase 7 (retiring the legacy `wo_detail_*` path). Since phase
--   2 every submit writes TWICE — the `answers` blob and the detail row — and
--   the gate of 054 still falls back to the 016 rules for any order with no
--   capture report. Both of those exist only because the orders captured before
--   the plans have their data in `wo_detail_*` and nowhere else.
--
--   This migration moves that data across: it gives the capture report the one
--   column no plan models (alta's reported service items), and then, for every
--   work order that has a legacy detail row and no capture report, writes the
--   report the technician would have produced under its plan. It is the
--   SQL twin of answersFromLegacyDetail() in src/services/capturePlanLegacy.ts
--   — the same walk over the plan's `fields` sections, the same per-type
--   coercion — except that it is generic over the plan definition instead of
--   hardcoding the seven tables, so a plan added later needs no new SQL here.
--
--   INERT BY DESIGN, and safe to re-run:
--     - It only INSERTs. An order that already has a report is never touched,
--       so a technician's answers can never be overwritten by an older
--       admin-side edit of the detail row.
--     - An order with no legacy row (or a row whose declared columns are all
--       empty) gets NO report, so it keeps falling back to the 016 gate. That
--       is the safety net: this migration can only ever move an order from the
--       legacy gate to the plan gate when it actually has data to be judged on.
--     - Photos are untouched. Photos with no section_key/slot_key are already
--       matched by photo_type inside capture_plan_missing_nodes() (054).
--
--   WHY IT CANNOT MAKE AN ORDER IN FLIGHT UNCERTIFIABLE: the `required` flags of
--   the default plans are the UNION of the two gates an order has to pass today
--   — the SQL one in 016 and REQUIRED_DETAIL_FIELDS in workOrderService.ts. An
--   order that passes both today therefore passes the plan too. The gate only
--   gets *stricter* than 016 alone where the client was already refusing the
--   transition anyway (fusion's `cabinet_code`, which 016 never checked).
--
--   THE ONE CASE THAT DOES CHANGE VERDICT — verified against a local Postgres,
--   see below: an order whose `capture_plan_key` was moved to a plan asking for
--   more than it was captured with (today only 'soplado_ra', with its four
--   mandatory photos). Backfilled, it stops falling back to 016 and starts being
--   judged by that plan, which will reject it. That is the phase-5 rule working
--   as decided — a changed plan key is a deliberate "capture this differently" —
--   and it cannot bite retroactively, because no order in production carries a
--   `capture_plan_key` yet (the admin selector ships in the same batch as this).
--   The second verification query below lists them; check it comes back empty.
--
--   NEXT (do not do it before this migration is applied AND verified): drop
--   assert_work_order_rueckmeldung_complete_legacy() and its call site in 054.
--
--   AFTER APPLYING: regenerate src/types/database.types.ts — unlike 054, this
--   one adds a column (work_order_capture_reports.reported_service_items).
--
--   Verified before shipping against a throwaway Postgres 15 with the real plan
--   JSON of 052/053 and 13 orders covering every branch: complete/partial/empty
--   detail rows, a plan-key override, a key nobody seeded, an order that already
--   had a report (untouched), and a re-run (idempotent). Every order's verdict
--   was compared under assert_..._legacy() and assert_...() before and after.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) The one column the plan does not model ───────────────────────────────────
-- `wo_detail_alta.reported_service_items` (015) is the technician's report of
-- which catalogued services were actually performed, and it is what the admin
-- bills from. No capture plan declares it and none should: it is not a captured
-- field, it is a list of catalog references with quantities, with its own UI and
-- its own array constraint.
--
-- It gets a column of its own rather than a corner of the `answers` blob, so it
-- stays typed, stays constrained, and stays invisible to the plan evaluator —
-- capture_plan_missing_nodes() only ever walks the plan's own sections.

ALTER TABLE public.work_order_capture_reports
  ADD COLUMN IF NOT EXISTS reported_service_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.work_order_capture_reports
  DROP CONSTRAINT IF EXISTS work_order_capture_reports_reported_items_array;
ALTER TABLE public.work_order_capture_reports
  ADD CONSTRAINT work_order_capture_reports_reported_items_array
  CHECK (jsonb_typeof(reported_service_items) = 'array');

COMMENT ON COLUMN public.work_order_capture_reports.reported_service_items IS
  'Catalogued services actually performed, as reported by the technician. Moved here from wo_detail_alta (015).';

-- 2) Value coercion ───────────────────────────────────────────────────────────
-- Twin of the per-type branch of answersFromLegacyDetail(). Returns NULL for a
-- value the plan cannot represent, and the caller then leaves the key out
-- entirely — an absent answer, not an empty one.
--
-- Temporary: this function exists only for the backfill below and is dropped at
-- the end of the migration.

CREATE OR REPLACE FUNCTION public.capture_legacy_answer_value(
  p_field jsonb,
  p_raw   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text := p_field->>'type';
  v_text text;
BEGIN
  IF p_raw IS NULL OR jsonb_typeof(p_raw) = 'null' THEN
    RETURN NULL;
  END IF;

  IF v_type IN ('checkbox', 'yesno') THEN
    -- `value === true` in TypeScript: anything else is a plain false.
    RETURN to_jsonb(p_raw = 'true'::jsonb);

  ELSIF v_type = 'number' THEN
    IF jsonb_typeof(p_raw) = 'number' THEN
      RETURN p_raw;
    END IF;
    -- Number(value) on anything unparseable is NaN, which the bridge drops.
    v_text := btrim(p_raw #>> '{}');
    IF v_text ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' THEN
      RETURN to_jsonb(v_text::numeric);
    END IF;
    RETURN NULL;
  END IF;

  -- text / select / anything else: String(value).
  RETURN to_jsonb(p_raw #>> '{}');
END;
$$;

-- 3) The backfill ─────────────────────────────────────────────────────────────

DO $backfill$
DECLARE
  v_order      RECORD;
  v_plan       jsonb;
  v_section    jsonb;
  v_field      jsonb;
  v_table      text;
  v_row        jsonb;
  v_value      jsonb;
  v_values     jsonb;
  v_answers    jsonb;
  v_reported   jsonb;
  v_submitted  timestamptz;
  v_created    integer := 0;
  v_skipped    integer := 0;
BEGIN
  FOR v_order IN
    SELECT wo.id,
           public.work_order_capture_plan_key(wo.id) AS plan_key
    FROM public.work_orders wo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.work_order_capture_reports cr
      WHERE cr.work_order_id = wo.id
    )
  LOOP
    v_plan := public.current_capture_plan(v_order.plan_key);
    -- A key nobody seeded: leave the order on the legacy gate rather than
    -- pinning it to a plan that does not exist.
    CONTINUE WHEN v_plan IS NULL;

    v_answers  := '{}'::jsonb;
    v_reported := '[]'::jsonb;

    FOR v_section IN SELECT * FROM jsonb_array_elements(v_plan->'sections') LOOP
      CONTINUE WHEN coalesce(v_section->>'kind', '') <> 'fields';
      v_table := v_section->>'legacyTable';
      CONTINUE WHEN v_table IS NULL;
      CONTINUE WHEN to_regclass('public.' || quote_ident(v_table)) IS NULL;

      EXECUTE format(
        'SELECT to_jsonb(t) FROM public.%I t WHERE t.work_order_id = $1 LIMIT 1', v_table
      ) INTO v_row USING v_order.id;
      CONTINUE WHEN v_row IS NULL;

      -- Carried by column name, not by work type: only wo_detail_alta has it,
      -- and this stays true if another detail table ever grows the same column.
      IF jsonb_typeof(v_row->'reported_service_items') = 'array' THEN
        v_reported := v_row->'reported_service_items';
      END IF;

      v_values := '{}'::jsonb;
      FOR v_field IN SELECT * FROM jsonb_array_elements(coalesce(v_section->'fields', '[]'::jsonb)) LOOP
        CONTINUE WHEN v_field->>'legacyColumn' IS NULL;
        v_value := public.capture_legacy_answer_value(
          v_field, v_row -> (v_field->>'legacyColumn')
        );
        CONTINUE WHEN v_value IS NULL;
        v_values := v_values || jsonb_build_object(v_field->>'key', v_value);
      END LOOP;

      IF v_values <> '{}'::jsonb THEN
        v_answers := v_answers || jsonb_build_object(v_section->>'key', v_values);
      END IF;
    END LOOP;

    -- Nothing to carry over: no row, or a row holding none of the plan's
    -- columns and no reported services. The order stays on the 016 fallback,
    -- which is exactly what it is being judged by today.
    IF v_answers = '{}'::jsonb AND v_reported = '[]'::jsonb THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- When the Rückmeldung was actually sent, if it ever was. An order still
    -- being captured keeps a NULL, same as a report saved but not submitted.
    SELECT min(sh.created_at) INTO v_submitted
    FROM public.work_order_state_history sh
    WHERE sh.work_order_id = v_order.id
      AND sh.to_status = 'rueckmeldung_sent';

    INSERT INTO public.work_order_capture_reports (
      work_order_id, plan_key, plan_version, answers, reported_service_items, submitted_at
    ) VALUES (
      v_order.id,
      v_order.plan_key,
      (v_plan->>'version')::integer,
      v_answers,
      v_reported,
      v_submitted
    );

    v_created := v_created + 1;
  END LOOP;

  RAISE NOTICE 'Capture reports backfilled: % created, % orders left on the legacy gate',
    v_created, v_skipped;
END;
$backfill$;

DROP FUNCTION IF EXISTS public.capture_legacy_answer_value(jsonb, jsonb);

-- 4) Verification ─────────────────────────────────────────────────────────────
-- Run these after the block above. The legacy gate must not be removed until
-- the first one returns no order that still needs certifying.
--
--   -- Orders that would still fall back to the 016 gate, by status:
--   SELECT wo.status, count(*)
--   FROM public.work_orders wo
--   WHERE NOT EXISTS (
--     SELECT 1 FROM public.work_order_capture_reports cr WHERE cr.work_order_id = wo.id
--   )
--   GROUP BY 1 ORDER BY 2 DESC;
--
--   -- Orders still short of certification that the plan gate would now reject.
--   -- Expected: only orders the admin cannot certify today either. Anything
--   -- listed here with a capture_plan_key set is the plan-override case above —
--   -- decide per order whether to clear the key or have it re-captured.
--   SELECT wo.order_number, wo.status, wo.work_type, wo.capture_plan_key, m.missing
--   FROM public.work_orders wo
--   JOIN public.work_order_capture_reports cr ON cr.work_order_id = wo.id
--   CROSS JOIN LATERAL (
--     SELECT public.capture_plan_missing_nodes(
--              wo.id,
--              public.current_capture_plan(public.work_order_capture_plan_key(wo.id)),
--              cr.answers
--            ) AS missing
--   ) m
--   WHERE wo.status NOT IN ('internally_certified', 'sent_to_client', 'client_accepted',
--                           'invoiced', 'paid', 'cancelled')
--     AND m.missing <> '{}';
