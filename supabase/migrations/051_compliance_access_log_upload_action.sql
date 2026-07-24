-- 051_compliance_access_log_upload_action.sql
-- Depends on: 050_compliance_retention.sql
--
-- Fix: the compliance-upload Edge Function writes an RGPD access-trail row for
-- every upload with action = 'upload', but document_access_log.action (defined in
-- 042_compliance_core.sql) had a CHECK constraint allowing only ('view','download').
-- The insert therefore failed with 23514 (check_violation), which surfaced as a
-- 500 from the Edge Function even though the file, its version and the slot status
-- had already been persisted (partial write reported as an error).
--
-- The Edge Function now treats the access-log insert as best-effort, so uploads no
-- longer fail on it; this migration additionally widens the constraint so the
-- upload IS recorded in the RGPD trail as intended.
--
-- Manual step for Alejandro: apply this migration. It does NOT change
-- database.types.ts (constraint only, no new tables/columns).

ALTER TABLE public.document_access_log
  DROP CONSTRAINT IF EXISTS document_access_log_action_check;

ALTER TABLE public.document_access_log
  ADD CONSTRAINT document_access_log_action_check
  CHECK (action IN ('view', 'download', 'upload'));
