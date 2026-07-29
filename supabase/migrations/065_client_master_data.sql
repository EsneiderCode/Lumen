-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 065 — Client master data and compatibility-safe project ownership
-- Depends on: 064_work_order_site_reference.sql
-- Purpose:
--   - Promote clients to maintained master data.
--   - Backfill project ownership only from unambiguous historical evidence.
--   - Scope project codes by client instead of globally.
--   - Abort on conflicting ownership; leave no-evidence Direktauftrag projects NULL.
-- projects.client_id NOT NULL enforcement is deferred to migration 070 after
-- the client-first UI cutover.
--
-- Preflight (run before applying):
--   WITH evidence AS (
--     SELECT id AS project_id, client_id FROM public.projects WHERE client_id IS NOT NULL
--     UNION ALL
--     SELECT project_id, client_id FROM public.work_orders WHERE client_id IS NOT NULL
--   )
--   SELECT p.code, array_agg(DISTINCT e.client_id) AS client_ids
--   FROM evidence e JOIN public.projects p ON p.id = e.project_id
--   GROUP BY p.id, p.code HAVING count(DISTINCT e.client_id) > 1;
--
--   SELECT p.id, p.code, p.name
--   FROM public.projects p
--   WHERE p.client_id IS NULL
--     AND NOT EXISTS (
--       SELECT 1 FROM public.work_orders wo
--       WHERE wo.project_id = p.id AND wo.client_id IS NOT NULL
--     );
--
-- Owner remediation: resolve only rows returned by the conflict query. Projects
-- without ownership evidence may be legitimate Direktauftrag projects and stay
-- NULL until the post-cutover migration.
-- Apply manually in Supabase SQL Editor. Regenerate database.types.ts after
-- the complete migration series is applied.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- The lookup remains readable to every authenticated user, but internal notes
-- follow the profiles.pin_hash pattern: remove table-wide SELECT, grant only
-- safe columns, and expose notes through a permission-checked RPC.
REVOKE SELECT ON public.clients FROM anon, authenticated;
GRANT SELECT (id, name, code, is_active, created_at, updated_at)
  ON public.clients TO authenticated;

CREATE OR REPLACE FUNCTION public.get_client_notes(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  client_notes TEXT;
BEGIN
  IF NOT public.has_permission('projects.view') THEN
    RAISE EXCEPTION
      'client notes require projects.view permission'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT client.notes INTO client_notes
  FROM public.clients client
  WHERE client.id = p_client_id;

  RETURN client_notes;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_notes(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_notes(UUID) TO authenticated;

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Conflicting project→client evidence is a hard stop. Evidence includes both
-- the current project owner and every historical client-backed order.
DO $$
DECLARE
  conflicting_projects TEXT;
BEGIN
  WITH evidence AS (
    SELECT id AS project_id, client_id
    FROM public.projects
    WHERE client_id IS NOT NULL
    UNION ALL
    SELECT project_id, client_id
    FROM public.work_orders
    WHERE client_id IS NOT NULL
  ),
  conflicts AS (
    SELECT project_id
    FROM evidence
    GROUP BY project_id
    HAVING count(DISTINCT client_id) > 1
  )
  SELECT string_agg(p.code || ' (' || p.id::text || ')', ', ' ORDER BY p.code)
    INTO conflicting_projects
  FROM conflicts c
  JOIN public.projects p ON p.id = c.project_id;

  IF conflicting_projects IS NOT NULL THEN
    RAISE EXCEPTION
      'conflicting project -> client evidence; map explicitly before migration: %',
      conflicting_projects
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- Deterministic backfill: a project inherits a client only when all non-null
-- historical order evidence agrees on exactly one client.
DO $$
DECLARE
  backfilled_count BIGINT;
BEGIN
WITH deterministic_owner AS (
  SELECT project_id, min(client_id::text)::UUID AS client_id
  FROM public.work_orders
  WHERE client_id IS NOT NULL
  GROUP BY project_id
  HAVING count(DISTINCT client_id) = 1
)
UPDATE public.projects p
SET client_id = owner.client_id
FROM deterministic_owner owner
WHERE p.id = owner.project_id
  AND p.client_id IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE 'backfilled project client ownership rows: %', backfilled_count;
END;
$$;

-- Unresolved projects are compatible during the deploy window; report their
-- count and codes so the owner can distinguish valid Direktauftrag rows.
DO $$
DECLARE
  unresolved_count BIGINT;
  unresolved_projects TEXT;
BEGIN
  SELECT count(*),
         string_agg(code || ' (' || id::text || ')', ', ' ORDER BY code)
    INTO unresolved_count, unresolved_projects
  FROM public.projects
  WHERE client_id IS NULL;

  IF unresolved_count > 0 THEN
    RAISE NOTICE
      'unresolved project ownership left nullable (% rows): %',
      unresolved_count, unresolved_projects;
  END IF;
END;
$$;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

-- Project codes are meaningful inside a client catalog, not globally.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS projects_client_code_unique
  ON public.projects (client_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS projects_null_client_code_unique
  ON public.projects (code)
  WHERE client_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client_active_name
  ON public.projects (client_id, is_active, name);

CREATE OR REPLACE FUNCTION public.prevent_referenced_project_client_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     AND EXISTS (
       SELECT 1 FROM public.work_orders wo WHERE wo.project_id = OLD.id
     ) THEN
    RAISE EXCEPTION
      'project client cannot change after work orders reference it'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_freeze_referenced_client ON public.projects;
CREATE TRIGGER projects_freeze_referenced_client
  BEFORE UPDATE OF client_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_referenced_project_client_change();

COMMENT ON COLUMN public.projects.client_id IS
  'Owning client when known. NULL remains allowed for legacy/Direktauftrag rows; NOT NULL is deferred to migration 070.';
COMMENT ON COLUMN public.projects.default_operator_id IS
  'Deprecated for client-first v2 orders. Kept until the post-UI-cutover cleanup migration.';
COMMENT ON COLUMN public.projects.default_line IS
  'Deprecated for client-first v2 orders. Kept until the post-UI-cutover cleanup migration.';

COMMIT;
