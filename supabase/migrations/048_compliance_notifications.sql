-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 048 — Compliance notifications: in-app inbox + daily sweep fan-out
-- Depends on: 047_compliance_assignment_override.sql
-- Purpose:
--   Fase 4 closes the compliance alert loop. Until now
--   run_compliance_expiry_sweep() (043) only transitioned documents
--   approved → expiring → expired and returned a bare count; nobody was told.
--   This migration:
--     1) Adds public.notifications — a lightweight in-app inbox. Rows are written
--        ONLY by SECURITY DEFINER code (the sweep below and a review trigger), so
--        there is no INSERT policy for end users. Recipients read/mark-read their
--        own rows; compliance.view holders may read all. Idempotent via a unique
--        (recipient_id, dedupe_key) index + ON CONFLICT DO NOTHING.
--     2) Rewrites run_compliance_expiry_sweep() to (a) transition documents,
--        (b) insert in-app notifications for admins (compliance.review holders)
--        and for the entity owner, and (c) RETURN the enriched transition rows so
--        the compliance-notify Edge Function can fan out email (Resend) + Telegram.
--        Changing the return type requires DROP + CREATE.
--     3) Adds a trigger that notifies the entity owner in-app on every
--        document_reviews insert (approve/reject) — covers both the admin inbox
--        flow and the compliance-upload direct_approve path.
--     4) Schedules the daily sweep with pg_cron, invoking the compliance-notify
--        Edge Function via pg_net. The function URL + service key are read from
--        Supabase Vault (secrets 'project_url' and 'service_role_key') so no
--        credential is committed to git.
--
--   MANUAL STEPS for Alejandro after applying:
--     - Ensure the pg_cron and pg_net extensions are enabled in the project.
--     - Insert Vault secrets 'project_url' (e.g. https://<ref>.supabase.co) and
--       'service_role_key'. Without them the cron job runs but the HTTP call is a
--       no-op (URL resolves NULL) — the in-app rows are still written by the sweep.
--     - Set Edge Function secrets: RESEND_API_KEY, COMPLIANCE_FROM_EMAIL, and
--       (optional) COMPLIANCE_TELEGRAM_CHAT_ID.
--     - Regenerate database.types.ts (the notifications table is new).
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) In-app inbox table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- doc_expiring | doc_expired | doc_approved | doc_rejected
  category     TEXT NOT NULL,
  -- info | warn | err  (drives the dot colour in the bell)
  level        TEXT NOT NULL DEFAULT 'info',
  -- i18n-agnostic context; the client renders the copy from keys + payload.
  -- { entity_id, entity_document_id, entity_name, doc_type_code, doc_type_name,
  --   status, expires_on, days }
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Stable key so re-running the sweep the same day never duplicates a row.
  dedupe_key   TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (recipient_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients read their own; compliance.view holders read all. No INSERT policy:
-- rows are created exclusively by the SECURITY DEFINER functions below.
CREATE POLICY "notifications_own_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.has_permission('compliance.view'));

-- Recipients may only flip their own rows read/unread (read_at). WITH CHECK keeps
-- ownership; column-level protection is enforced by the service (updates read_at
-- only) — the policy guarantees you can never touch someone else's row.
CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- 2) Sweep rewrite: transition + in-app notify + return enriched transitions ───
-- The return type changes (INTEGER → TABLE), so drop first.
DROP FUNCTION IF EXISTS public.run_compliance_expiry_sweep();

CREATE FUNCTION public.run_compliance_expiry_sweep()
RETURNS TABLE (
  entity_document_id   UUID,
  entity_id            UUID,
  entity_display_name  TEXT,
  entity_contact_email TEXT,
  entity_profile_id    UUID,
  document_type_code   TEXT,
  document_type_name   JSONB,
  new_status           TEXT,
  expires_on           DATE,
  days_remaining       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- The RETURNS TABLE columns (expires_on, new_status, entity_id, …) share names
-- with the query columns below; resolve every such clash in favour of the column.
#variable_conflict use_column
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  -- Collect the documents that change state in this run.
  CREATE TEMP TABLE _sweep_tx (
    entity_document_id UUID,
    new_status         TEXT,
    expires_on         DATE
  ) ON COMMIT DROP;

  -- Effective expiry per item:
  --   days_from_issue → approved_issued_at + validity_days
  --   otherwise       → approved_expires_at
  WITH effective AS (
    SELECT
      ed.id,
      ed.status,
      CASE
        WHEN r.validity_rule = 'days_from_issue'
          THEN ed.approved_issued_at + r.validity_days
        ELSE ed.approved_expires_at
      END AS expires_on,
      (SELECT max(d) FROM unnest(r.notify_days) AS d) AS warn_days
    FROM public.entity_documents ed
    JOIN public.document_requirements r ON r.id = ed.requirement_id
    WHERE ed.status IN ('approved', 'expiring')
      AND r.validity_rule <> 'no_expiry'
  ),
  expired AS (
    UPDATE public.entity_documents ed
    SET status = 'expired'
    FROM effective ef
    WHERE ed.id = ef.id
      AND ef.expires_on IS NOT NULL
      AND ef.expires_on < v_today
    RETURNING ed.id, ef.expires_on
  )
  INSERT INTO _sweep_tx (entity_document_id, new_status, expires_on)
  SELECT expired.id, 'expired', expired.expires_on FROM expired;

  WITH effective AS (
    SELECT
      ed.id,
      ed.status,
      CASE
        WHEN r.validity_rule = 'days_from_issue'
          THEN ed.approved_issued_at + r.validity_days
        ELSE ed.approved_expires_at
      END AS expires_on,
      (SELECT max(d) FROM unnest(r.notify_days) AS d) AS warn_days
    FROM public.entity_documents ed
    JOIN public.document_requirements r ON r.id = ed.requirement_id
    WHERE ed.status = 'approved'
      AND r.validity_rule <> 'no_expiry'
  ),
  expiring AS (
    UPDATE public.entity_documents ed
    SET status = 'expiring'
    FROM effective ef
    WHERE ed.id = ef.id
      AND ef.expires_on IS NOT NULL
      AND ef.expires_on >= v_today
      AND ef.expires_on - v_today <= COALESCE(ef.warn_days, 30)
    RETURNING ed.id, ef.expires_on
  )
  INSERT INTO _sweep_tx (entity_document_id, new_status, expires_on)
  SELECT expiring.id, 'expiring', expiring.expires_on FROM expiring;

  -- Enriched view of the transitions, shared by the notification insert and the
  -- RETURN below.
  CREATE TEMP TABLE _sweep_rich ON COMMIT DROP AS
  SELECT
    tx.entity_document_id,
    e.id            AS entity_id,
    e.display_name  AS entity_display_name,
    e.contact_email AS entity_contact_email,
    e.profile_id    AS entity_profile_id,
    dt.code         AS document_type_code,
    dt.name_i18n    AS document_type_name,
    tx.new_status,
    tx.expires_on,
    (tx.expires_on - v_today) AS days_remaining
  FROM _sweep_tx tx
  JOIN public.entity_documents ed ON ed.id = tx.entity_document_id
  JOIN public.compliance_entities e ON e.id = ed.entity_id
  JOIN public.document_types dt ON dt.id = ed.document_type_id;

  -- In-app notifications for admins (compliance.review holders).
  INSERT INTO public.notifications (recipient_id, category, level, payload, dedupe_key)
  SELECT
    p.id,
    'doc_' || rich.new_status,
    CASE WHEN rich.new_status = 'expired' THEN 'err' ELSE 'warn' END,
    jsonb_build_object(
      'entity_id', rich.entity_id,
      'entity_document_id', rich.entity_document_id,
      'entity_name', rich.entity_display_name,
      'doc_type_code', rich.document_type_code,
      'doc_type_name', rich.document_type_name,
      'status', rich.new_status,
      'expires_on', rich.expires_on,
      'days', rich.days_remaining
    ),
    'sweep:' || rich.entity_document_id || ':' || rich.new_status
  FROM _sweep_rich rich
  CROSS JOIN LATERAL (
    SELECT pr.id
    FROM public.profiles pr
    WHERE pr.is_active AND public.user_has_permission(pr.id, 'compliance.review')
  ) p
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING;

  -- In-app notification for the entity owner (contractor portal), if any.
  INSERT INTO public.notifications (recipient_id, category, level, payload, dedupe_key)
  SELECT
    rich.entity_profile_id,
    'doc_' || rich.new_status,
    CASE WHEN rich.new_status = 'expired' THEN 'err' ELSE 'warn' END,
    jsonb_build_object(
      'entity_id', rich.entity_id,
      'entity_document_id', rich.entity_document_id,
      'entity_name', rich.entity_display_name,
      'doc_type_code', rich.document_type_code,
      'doc_type_name', rich.document_type_name,
      'status', rich.new_status,
      'expires_on', rich.expires_on,
      'days', rich.days_remaining
    ),
    'sweep:' || rich.entity_document_id || ':' || rich.new_status
  FROM _sweep_rich rich
  WHERE rich.entity_profile_id IS NOT NULL
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING;

  RETURN QUERY
    SELECT
      rich.entity_document_id,
      rich.entity_id,
      rich.entity_display_name,
      rich.entity_contact_email,
      rich.entity_profile_id,
      rich.document_type_code,
      rich.document_type_name,
      rich.new_status,
      rich.expires_on,
      rich.days_remaining
    FROM _sweep_rich rich;
END;
$$;

-- 3) Review → owner notification trigger ──────────────────────────────────────
-- Every document_reviews insert (approve/reject, admin inbox OR direct_approve)
-- tells the entity owner in-app. dedupe_key = 'review:'||review_id (append-only).
CREATE OR REPLACE FUNCTION public.notify_entity_owner_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
  v_entity_id  UUID;
  v_entity_name TEXT;
  v_doc_code   TEXT;
  v_doc_name   JSONB;
BEGIN
  SELECT e.profile_id, e.id, e.display_name, dt.code, dt.name_i18n
    INTO v_profile_id, v_entity_id, v_entity_name, v_doc_code, v_doc_name
  FROM public.document_versions dv
  JOIN public.entity_documents ed ON ed.id = dv.entity_document_id
  JOIN public.compliance_entities e ON e.id = ed.entity_id
  JOIN public.document_types dt ON dt.id = ed.document_type_id
  WHERE dv.id = NEW.version_id;

  IF v_profile_id IS NULL THEN
    RETURN NEW;  -- internal employee / no portal login: nothing to notify.
  END IF;

  INSERT INTO public.notifications (recipient_id, category, level, payload, dedupe_key)
  VALUES (
    v_profile_id,
    'doc_' || NEW.action,
    CASE WHEN NEW.action = 'rejected' THEN 'err' ELSE 'info' END,
    jsonb_build_object(
      'entity_id', v_entity_id,
      'entity_name', v_entity_name,
      'doc_type_code', v_doc_code,
      'doc_type_name', v_doc_name,
      'action', NEW.action,
      'rejection_reasons', NEW.rejection_reasons,
      'rejection_text', NEW.rejection_text
    ),
    'review:' || NEW.id
  )
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_reviews_notify_owner ON public.document_reviews;
CREATE TRIGGER document_reviews_notify_owner
  AFTER INSERT ON public.document_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_entity_owner_on_review();

-- 4) Schedule the daily sweep → compliance-notify Edge Function ────────────────
-- 06:00 Europe/Berlin ≈ 05:00 UTC (winter) / 04:00 UTC (summer); pg_cron runs in
-- UTC. We schedule at 05:00 UTC — close enough for a daily digest.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lumen-compliance-daily') THEN
    PERFORM cron.unschedule('lumen-compliance-daily');
  END IF;

  PERFORM cron.schedule(
    'lumen-compliance-daily',
    '0 5 * * *',
    $cron$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/compliance-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'compliance cron not scheduled (enable pg_cron/pg_net + set Vault secrets): %', SQLERRM;
END $$;
