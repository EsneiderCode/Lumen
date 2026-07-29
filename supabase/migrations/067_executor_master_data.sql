-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 067 — Own-team master data and personnel links
-- Depends on: 066_client_owned_service_catalog.sql
-- Purpose:
--   - Replace team_color as team identity with admin-managed teams.
--   - Link payroll employees and operational profiles to the same team row.
--   - Keep legacy enum columns during the compatibility window.
--   - Prepare normalized own-team sources for executor linkage in migration 068.
-- Apply manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  color_key    public.team_color NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one active team owns a brand color. A color may be reused only after
-- its former team is deactivated, which keeps historical rows intact.
CREATE UNIQUE INDEX IF NOT EXISTS teams_active_color_unique
  ON public.teams (color_key)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_teams_active_name
  ON public.teams (is_active, display_name);

DROP TRIGGER IF EXISTS teams_set_updated_at ON public.teams;
CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.teams (code, display_name, color_key) VALUES
  ('rot',     'Team Rot',     'rot'),
  ('gruen',   'Team Grün',    'gruen'),
  ('blau',    'Team Blau',    'blau'),
  ('gelb',    'Team Gelb',    'gelb'),
  ('weiss',   'Team Weiß',    'weiss'),
  ('grau',    'Team Grau',    'grau'),
  ('braun',   'Team Braun',   'braun'),
  ('violett', 'Team Violett', 'violett'),
  ('tuerkis', 'Team Türkis',  'tuerkis'),
  ('schwarz', 'Team Schwarz', 'schwarz'),
  ('orange',  'Team Orange',  'orange'),
  ('rosa',    'Team Rosa',    'rosa')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS team_id UUID
    REFERENCES public.teams(id) ON DELETE RESTRICT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id UUID
    REFERENCES public.teams(id) ON DELETE RESTRICT;

-- Deterministic compatibility backfill from the current enum.
DO $$
DECLARE
  backfilled_count BIGINT;
BEGIN
UPDATE public.employees employee
SET team_id = team.id
FROM public.teams team
WHERE employee.team IS NOT NULL
  AND team.color_key = employee.team
  AND employee.team_id IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE 'backfilled employee team rows: %', backfilled_count;

UPDATE public.profiles profile
SET team_id = team.id
FROM public.teams team
WHERE profile.team IS NOT NULL
  AND team.color_key = profile.team
  AND profile.team_id IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE 'backfilled profile team rows: %', backfilled_count;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_employees_team_id
  ON public.employees (team_id)
  WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_id
  ON public.profiles (team_id)
  WHERE team_id IS NOT NULL;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select" ON public.teams;
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT TO authenticated
  USING (
    is_active
    OR public.has_permission('employees.view')
  );

DROP POLICY IF EXISTS "teams_insert_perm" ON public.teams;
CREATE POLICY "teams_insert_perm" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('employees.create'));

DROP POLICY IF EXISTS "teams_update_perm" ON public.teams;
CREATE POLICY "teams_update_perm" ON public.teams
  FOR UPDATE TO authenticated
  USING (public.has_permission('employees.edit'))
  WITH CHECK (public.has_permission('employees.edit'));

-- No DELETE policy by design: admin "delete" is soft-deactivation. FKs use
-- RESTRICT, so referenced team history cannot be erased accidentally.

COMMENT ON TABLE public.teams IS
  'Admin-managed own-team catalog. team_color remains a presentation token, not identity.';
COMMENT ON COLUMN public.employees.team_id IS
  'Canonical own-team membership. Legacy employees.team is dual-written during UI cutover.';
COMMENT ON COLUMN public.profiles.team_id IS
  'Canonical operational team membership. Legacy profiles.team is retained during UI cutover.';

COMMIT;
