-- 050_compliance_retention.sql
-- Depends on: 049_compliance_document_templates.sql
--
-- GDPR data retention for the compliance module (Fase 6b):
--   1) run_compliance_retention_sweep(retain_days) — purges document_access_log
--      rows older than the retention window. The access log is a continuously
--      growing trail of personal data (who viewed/downloaded which document and
--      when); GDPR data minimisation requires it not be kept longer than needed.
--      Pure SQL (no storage, no email, no Edge Function) so it is scheduled
--      DIRECTLY by pg_cron — no net.http_post / Vault chain like the daily sweep.
--   2) Monthly cron 'lumen-compliance-retention' that runs the sweep.
--
-- The right-to-erasure of a single entity's directly-identifying PII is done from
-- the app (admin action on an inactive entity) via a targeted UPDATE under the
-- existing compliance RLS — no dedicated function is needed for that.
--
-- Manual step for Alejandro: apply this migration. It does NOT change
-- database.types.ts (functions only, no new tables/columns).

-- 1) Retention sweep ──────────────────────────────────────────────────────────
-- SECURITY DEFINER: the RLS on document_access_log has no DELETE policy, so the
-- purge must run with the function owner's rights. Returns the number of rows
-- removed so the cron log (and manual runs) show the effect.

CREATE OR REPLACE FUNCTION public.run_compliance_retention_sweep(retain_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged integer;
BEGIN
  IF retain_days IS NULL OR retain_days < 30 THEN
    RAISE EXCEPTION 'retain_days must be at least 30 (got %)', retain_days;
  END IF;

  DELETE FROM public.document_access_log
  WHERE created_at < now() - make_interval(days => retain_days);
  GET DIAGNOSTICS purged = ROW_COUNT;

  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.run_compliance_retention_sweep(integer) FROM public, anon, authenticated;

-- 2) Schedule the monthly retention sweep ─────────────────────────────────────
-- 03:00 UTC on the 1st of each month. Pure SQL call — no Edge Function involved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lumen-compliance-retention') THEN
    PERFORM cron.unschedule('lumen-compliance-retention');
  END IF;

  PERFORM cron.schedule(
    'lumen-compliance-retention',
    '0 3 1 * *',
    $cron$ SELECT public.run_compliance_retention_sweep(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'compliance retention cron not scheduled (enable pg_cron): %', SQLERRM;
END $$;
