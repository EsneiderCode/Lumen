-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 037 — Schedulers share all appointments (drop per-user scope)
-- Depends on: 036_security_hardening.sql
-- Purpose:
--   The scheduler role was scoped to one line + operator via
--   profiles.scheduler_line / scheduler_operator (migration 028), enforced by
--   the appointments_scheduler_scope RLS policy. There is no UI to configure
--   that scope, so scheduler profiles have it NULL and see nothing
--   ("Kein Terminbereich konfiguriert").
--
--   Business decision: every scheduler manages ALL appointments, no per-area
--   isolation. Replace the scope policy with a role-only policy so any active
--   scheduler can read and write every appointment. The permission-based
--   policies from 035 (appointments_*_perm) stay in place for custom roles.
--
--   The profiles.scheduler_line / scheduler_operator columns are kept (nullable,
--   now unused) so no data is dropped; they can be removed in a later migration
--   if the scope model is never reintroduced.
--
-- Run manually in Supabase SQL Editor (after 036).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS appointments_scheduler_scope ON public.appointments;

-- Any active scheduler has full access to every appointment. get_user_role()
-- already resolves to the caller's profile role; RLS on profiles is not
-- re-entered because get_user_role() is SECURITY DEFINER.
CREATE POLICY appointments_scheduler_all ON public.appointments
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'scheduler')
  WITH CHECK (public.get_user_role() = 'scheduler');
