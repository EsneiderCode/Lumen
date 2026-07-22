-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 038 — user_telegram_groups
-- Depends on: 037_scheduler_shared_appointments.sql
-- Purpose:
--   - Link users (profiles) to the Telegram groups they belong to.
--   - Notification routing: when an event concerns a user (assignment, report,
--     status change of their order), send-telegram delivers ONLY to that
--     user's groups. If the user has no groups, it falls back to the
--     event_group_mappings configuration (current behavior).
-- ─────────────────────────────────────────────────────────────────────────────

-- Table ------------------------------------------------------------------------

CREATE TABLE public.user_telegram_groups (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid        NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  telegram_group_id uuid        NOT NULL
    REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, telegram_group_id)
);

-- Indexes -----------------------------------------------------------------------

CREATE INDEX idx_user_telegram_groups_profile_id
  ON public.user_telegram_groups (profile_id);

-- RLS ----------------------------------------------------------------------------

ALTER TABLE public.user_telegram_groups ENABLE ROW LEVEL SECURITY;

-- Managed from the admin user editor; requires the users.edit permission.
-- service_role (used by the send-telegram edge function) bypasses RLS.

CREATE POLICY "user_telegram_groups_manage_perm"
  ON public.user_telegram_groups
  FOR ALL
  TO authenticated
  USING (public.has_permission('users.edit'))
  WITH CHECK (public.has_permission('users.edit'));
