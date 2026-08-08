-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 080 — real client signature (plan 011 Gap C)
-- Depends on: 052_capture_plans.sql, 073_work_order_access_scope.sql
-- Purpose:
--   Until now "the client signed" was a bare boolean the technician ticked
--   (`client_signature` capture field). The field stays — the TS engine and the
--   SQL gate keep judging the boolean they already know — but the app now
--   captures a hand-drawn signature and stores it as a PNG. This column is the
--   report's reference to that image.
--
--   Where the image lives, and why no storage DDL appears here:
--     bucket `work-order-photos`, path `<work_order_id>/signature/<file>.png`.
--   The 073 policies scope that bucket by the first path segment — the order
--   id — granting INSERT/SELECT to the order's assigned technician and to the
--   office (`work_orders.view`), which is exactly the contract a signature
--   needs: the technician in the field writes it, certification and the PDF
--   read it. Reusing that prefix means neither this migration nor
--   `supabase/rls_policies.sql` (the two DDL sources for storage policies)
--   changes at all — nothing can drift out of sync.
--
--   The path hangs off the capture report rather than a `work_order_photos`
--   row on purpose: a signature is not job evidence photography. As a report
--   column it never shows up in photo galleries, never counts toward any photo
--   slot of any plan version, and travels inside the one row that already is
--   "what the technician handed in".
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.work_order_capture_reports
  ADD COLUMN IF NOT EXISTS client_signature_path text NULL;

COMMENT ON COLUMN public.work_order_capture_reports.client_signature_path IS
  'Storage path of the client''s hand-drawn signature PNG, inside the '
  'work-order-photos bucket under <work_order_id>/signature/. NULL = not '
  'signed. The boolean client_signature answer remains what the '
  'certification gate evaluates; this is the evidence behind it.';
