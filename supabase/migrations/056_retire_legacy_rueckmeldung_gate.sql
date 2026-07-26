-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 056 — Retire the pre-capture-plan certification gate
-- Depends on: 054_capture_plan_gate.sql, 055_capture_reports_backfill.sql
-- Purpose:
--   Last step of phase 7. Since 055 every work order that was ever captured
--   carries a row in work_order_capture_reports, so the fallback 054 kept for
--   orders without one — assert_work_order_rueckmeldung_complete_legacy(), the
--   verbatim 016 gate reading wo_detail_* — has nothing left to judge.
--
--   Keeping it would be worse than useless: it is a second, laxer set of rules
--   that any order could still fall into by simply having no report, which is
--   exactly the state an order is in while a technician is halfway through it.
--   From here a missing report is an explicit refusal, not a softer gate.
--
--   The wo_detail_* tables are NOT dropped. Nothing in the application reads or
--   writes them any more (phase 7), but they are the only remaining copy of what
--   was captured before the plans, and Alejandro has to confirm no export or
--   report outside this repo still points at them. Dropping them is a separate,
--   deliberate migration.
--
--   PRECONDITION, ENFORCED BELOW: no work order sitting at or past "the
--   technician has done the work" may be without a capture report. The guard
--   raises and rolls the whole migration back rather than leaving those orders
--   uncertifiable.
--
--   IF THE GUARD FIRES, running 055 again will not help — 055 has already moved
--   everything it could. There are exactly three reasons an order past execution
--   can still have no report, and each needs a decision, not a retry:
--     1. Its wo_detail_* row is empty, or it has none. Nobody reported anything;
--        the order needs its Rückmeldung filled in, or moving back/cancelling.
--     2. Its capture_plan_key names a plan that is in no migration. A data
--        error: fix the key (or seed the plan) and re-run 055.
--     3. It reached this state without ever passing through the technician's
--        screen. Worth understanding before waving it through.
--   The query in section 1 is the same one the guard runs; use it to look.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- The whole migration is one transaction ON PURPOSE. The guard below is a
-- separate statement from the DROP it protects, so without this a runner that
-- keeps going after an error — psql without ON_ERROR_STOP, for one — would
-- report the refusal and then drop the function anyway. Verified: it does.
BEGIN;

-- 1) Refuse to proceed if anything would be stranded ──────────────────────────
-- 'created' and 'assigned' orders legitimately have no report yet — nobody has
-- been on site. The states below are the ones an admin could be asked to
-- certify, and those must all be judgeable by their plan.

DO $guard$
DECLARE
  v_stranded integer;
  v_sample   text;
BEGIN
  SELECT count(*), string_agg(wo.order_number, ', ' ORDER BY wo.order_number)
    INTO v_stranded, v_sample
  FROM public.work_orders wo
  WHERE wo.status IN ('executed', 'returned', 'rueckmeldung_pending',
                      'rueckmeldung_sent', 'client_rejected')
    AND NOT EXISTS (
      SELECT 1 FROM public.work_order_capture_reports cr
      WHERE cr.work_order_id = wo.id
    );

  IF v_stranded > 0 THEN
    RAISE EXCEPTION
      'Cannot retire the legacy gate: % order(s) past execution have no capture report (%)',
      v_stranded, left(v_sample, 200)
      USING errcode = 'check_violation',
            hint = 'Re-running 055 will not help; it already moved everything it could. '
                || 'Each of these has an empty/absent wo_detail_* row, or a capture_plan_key '
                || 'that no migration seeds. See the header of 056.';
  END IF;
END;
$guard$;

-- 2) The gate, without its fallback ───────────────────────────────────────────
-- Same body as 054 minus the legacy branch: no capture report is now a refusal
-- with a message that says what is actually missing.

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rückmeldung fehlt — Auftrag kann nicht zertifiziert werden'
      USING errcode = 'check_violation';
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
  'Certification gate: every order is judged by its capture plan. No report means no certification.';

-- 3) The 016 rules are gone ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.assert_work_order_rueckmeldung_complete_legacy(uuid);

COMMIT;
