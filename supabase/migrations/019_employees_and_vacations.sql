-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 — Employees (Mitarbeiter) + Vacation requests (Urlaubsverwaltung)
-- Depends on: 001_initial_schema.sql
-- Purpose:
--   - Track internal employees with German payroll data (not system users).
--   - Manage vacation requests with BUrlG minimum (20 days/year).
--   - Admin-only access via RLS.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Employees ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  -- German payroll fields
  sv_nummer       TEXT,                          -- Sozialversicherungsnummer
  steuer_id       TEXT,                          -- Steueridentifikationsnummer (11-digit)
  steuerklasse    TEXT CHECK (steuerklasse IN ('I', 'II', 'III', 'IV', 'V', 'VI')),
  iban            TEXT,
  gross_salary    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- Employment period
  start_date      DATE NOT NULL,
  end_date        DATE,
  -- Meta
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees (is_active);
CREATE INDEX IF NOT EXISTS idx_employees_name   ON public.employees (full_name);

DROP TRIGGER IF EXISTS handle_employees_updated_at ON public.employees;
CREATE TRIGGER handle_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_admin_all" ON public.employees;
CREATE POLICY "employees_admin_all" ON public.employees
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ── Vacation requests (Urlaubsanträge) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year            SMALLINT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_count      SMALLINT NOT NULL CHECK (days_count > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  notes           TEXT,
  approved_by     UUID REFERENCES public.profiles(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vacation_dates_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON public.vacation_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_year     ON public.vacation_requests (employee_id, year);

DROP TRIGGER IF EXISTS handle_vacation_requests_updated_at ON public.vacation_requests;
CREATE TRIGGER handle_vacation_requests_updated_at
  BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacation_requests_admin_all" ON public.vacation_requests;
CREATE POLICY "vacation_requests_admin_all" ON public.vacation_requests
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ── Helper: total approved vacation days for an employee in a given year ──────

CREATE OR REPLACE FUNCTION public.employee_vacation_days_used(
  p_employee_id UUID,
  p_year        SMALLINT
)
RETURNS SMALLINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(days_count), 0)::SMALLINT
  FROM public.vacation_requests
  WHERE employee_id = p_employee_id
    AND year       = p_year
    AND status     = 'approved';
$$;
