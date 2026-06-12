-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — Project defaults for order creation
-- Depends on: 022_service_item_categories.sql
-- Purpose:
--   Add optional project-level defaults for operator and line so the new-order
--   form can pre-fill derivable values while keeping per-order overrides.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_operator_id UUID REFERENCES public.operators(id),
  ADD COLUMN IF NOT EXISTS default_line TEXT CHECK (default_line IN ('NE3', 'NE4'));

COMMENT ON COLUMN public.projects.default_operator_id IS
  'Pre-fills work_orders.operator_id in the new-order form. Overridable per order.';
COMMENT ON COLUMN public.projects.default_line IS
  'Pre-fills work_orders.line in the new-order form. Overridable per order.';
