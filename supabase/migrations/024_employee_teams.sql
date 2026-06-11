-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — Employee teams and app-profile link
-- Depends on: 023_project_defaults.sql
-- Purpose:
--   Add team assignment and optional app-login linkage to internal employees
--   so personnel can be rostered against operational teams.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS team public.team_color,
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_employees_team ON public.employees (team);

COMMENT ON COLUMN public.employees.team IS
  'Field team this internal employee works in (rot/gruen/blau/gelb). Nullable: office staff have no team.';
COMMENT ON COLUMN public.employees.profile_id IS
  'Optional link to the employee''s app login (profiles). Lets the roster show app access and team consistency.';
