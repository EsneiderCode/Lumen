-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040 — expand team_color enum to 12 teams
-- Depends on: 039_work_order_documents_bucket.sql
-- Purpose:
--   - Grow the team palette from 4 to 12 colors:
--     rot, gruen, blau, gelb (existing)
--     + weiss, grau, braun, violett, tuerkis, schwarz, orange, rosa.
--   - team_pins needs no schema change (team_color is TEXT there); admins
--     create PINs for the new teams from Settings once this is applied.
-- Notes:
--   - ALTER TYPE ... ADD VALUE is append-only and safe for existing rows.
--   - Values use ASCII names (weiss, tuerkis) matching the existing
--     convention (gruen, not grün).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'weiss';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'grau';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'braun';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'violett';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'tuerkis';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'schwarz';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'orange';
ALTER TYPE public.team_color ADD VALUE IF NOT EXISTS 'rosa';
