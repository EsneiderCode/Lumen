-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 041 — work_order_telegram_groups
-- Depends on: 040_expand_team_colors.sql
-- Purpose:
--   - Order-scoped Telegram notification routing: each work order can have one
--     or more Telegram groups assigned (at creation or later). Every
--     notification about the order (assignment, status change, report,
--     cancellation, deletion) is delivered ONLY to those groups.
--   - Orders without assigned groups fall back to the event_group_mappings
--     configuration from Settings (unchanged).
--   - Supersedes per-user routing: user_telegram_groups (migration 038) is
--     dropped along with its data. The admin UI panel moves from the user
--     editor to the work order form.
-- ─────────────────────────────────────────────────────────────────────────────

-- Table ------------------------------------------------------------------------

CREATE TABLE public.work_order_telegram_groups (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     uuid        NOT NULL
    REFERENCES public.work_orders(id) ON DELETE CASCADE,
  telegram_group_id uuid        NOT NULL
    REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, telegram_group_id)
);

-- Indexes -----------------------------------------------------------------------

CREATE INDEX idx_wo_telegram_groups_work_order_id
  ON public.work_order_telegram_groups (work_order_id);

-- RLS ----------------------------------------------------------------------------

ALTER TABLE public.work_order_telegram_groups ENABLE ROW LEVEL SECURITY;

-- Managed from the work order form; service_role (send-telegram edge function)
-- bypasses RLS. INSERT additionally allows work_orders.create so groups can be
-- attached right after creating an order.

CREATE POLICY "wo_telegram_groups_select_perm"
  ON public.work_order_telegram_groups
  FOR SELECT
  TO authenticated
  USING (public.has_permission('work_orders.view'));

CREATE POLICY "wo_telegram_groups_insert_perm"
  ON public.work_order_telegram_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('work_orders.edit')
    OR public.has_permission('work_orders.create')
  );

CREATE POLICY "wo_telegram_groups_delete_perm"
  ON public.work_order_telegram_groups
  FOR DELETE
  TO authenticated
  USING (public.has_permission('work_orders.edit'));

-- Drop superseded per-user routing ----------------------------------------------

DROP TABLE IF EXISTS public.user_telegram_groups;
