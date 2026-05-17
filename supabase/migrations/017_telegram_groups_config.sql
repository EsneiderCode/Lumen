-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017 — telegram_groups_config
-- Depends on: 016_mvp_business_logic_hardening.sql
-- Purpose:
--   - Store Telegram groups configurable from the admin dashboard.
--   - Map system event types to one or more groups for automated messaging.
--   - Removes the hardcoded TELEGRAM_CHAT_ID env-var dependency.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums -----------------------------------------------------------------------

CREATE TYPE public.telegram_group_purpose AS ENUM (
  'tareas',
  'alertas',
  'notificaciones'
);

CREATE TYPE public.telegram_event_type AS ENUM (
  'order_returned_for_correction',
  'task_assigned',
  'order_status_changed'
);

-- Tables ----------------------------------------------------------------------

CREATE TABLE public.telegram_groups (
  id         uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    text                          NOT NULL UNIQUE,
  name       text                          NOT NULL,
  purpose    public.telegram_group_purpose NOT NULL,
  is_active  boolean                       NOT NULL DEFAULT true,
  created_at timestamptz                   NOT NULL DEFAULT now(),
  updated_at timestamptz                   NOT NULL DEFAULT now()
);

CREATE TABLE public.event_group_mappings (
  id                uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        public.telegram_event_type NOT NULL,
  telegram_group_id uuid                       NOT NULL
    REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  is_active         boolean                    NOT NULL DEFAULT true,
  created_at        timestamptz                NOT NULL DEFAULT now(),
  UNIQUE (event_type, telegram_group_id)
);

-- Indexes ---------------------------------------------------------------------

CREATE INDEX idx_event_group_mappings_event_type
  ON public.event_group_mappings (event_type)
  WHERE is_active = true;

-- updated_at trigger ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_telegram_groups_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_groups_updated_at
  BEFORE UPDATE ON public.telegram_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_telegram_groups_updated_at();

-- RLS -------------------------------------------------------------------------

ALTER TABLE public.telegram_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_group_mappings ENABLE ROW LEVEL SECURITY;

-- Only active admins can read/write both tables.
-- service_role (used by edge functions) bypasses RLS automatically.

CREATE POLICY "admin_manage_telegram_groups"
  ON public.telegram_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "admin_manage_event_group_mappings"
  ON public.event_group_mappings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
