-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028 — Appointments (Termine) + scheduler scope
-- Depends on: 027_user_role_scheduler.sql
-- Purpose:
--   1. Add per-scheduler scope columns to profiles (scheduler_line + operator).
--   2. Create the appointments table (Termine) for the scheduler role.
--   3. RLS: admin sees everything; scheduler is scoped to their profile's
--      scheduler_line + scheduler_operator (defined in profiles).
--
--   References public.user_role 'scheduler' added in migration 027 (must be a
--   separate transaction from the ALTER TYPE ... ADD VALUE).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Scheduler scope on profiles ───────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scheduler_line     TEXT CHECK (scheduler_line IN ('NE3', 'NE4')),
  ADD COLUMN IF NOT EXISTS scheduler_operator UUID REFERENCES public.operators(id);

COMMENT ON COLUMN public.profiles.scheduler_line IS
  'Scope line for role=scheduler. NULL for non-scheduler profiles.';
COMMENT ON COLUMN public.profiles.scheduler_operator IS
  'Scope operator for role=scheduler. NULL for non-scheduler profiles.';

-- ── 2. Appointments (Termine) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL, -- optional
  line          TEXT NOT NULL CHECK (line IN ('NE3', 'NE4')),
  operator_id   UUID NOT NULL REFERENCES public.operators(id),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_min  INT NOT NULL DEFAULT 60,
  address       TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  status        TEXT NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed', 'confirmed', 'rescheduled', 'completed', 'cancelled')),
  notes         TEXT,
  assigned_to   UUID REFERENCES public.profiles(id),  -- the responsible scheduler
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_line_operator_idx
  ON public.appointments (line, operator_id, scheduled_at);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- admin: full access
CREATE POLICY appointments_admin_all ON public.appointments
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- scheduler: only their line + operator (scope read from profiles)
CREATE POLICY appointments_scheduler_scope ON public.appointments
  FOR ALL
  USING (
    public.get_user_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.scheduler_line = appointments.line
        AND p.scheduler_operator = appointments.operator_id
    )
  )
  WITH CHECK (
    public.get_user_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.scheduler_line = appointments.line
        AND p.scheduler_operator = appointments.operator_id
    )
  );
