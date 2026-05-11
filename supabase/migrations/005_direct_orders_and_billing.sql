-- ============================================================
-- LUMEN — Migration 005: Direct Orders & Billing Foundation
-- HMR Nexus Engineering GmbH
-- ============================================================
-- Adds support for work orders assigned directly to an external
-- collaborator (contractor) instead of an internal team, and
-- lays the billing reference fields.
-- ============================================================

-- ── 1. Add assigned_collaborator_id to work_orders ─────────────────────────
--
-- A "direct order" is a work order where the admin assigns a collaborator
-- directly (role = 'contractor') bypassing the team assignment flow.
-- Both assigned_team and assigned_collaborator_id may be set, but in
-- practice one XOR the other is non-null for a given order.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS assigned_collaborator_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wo_collaborator
  ON public.work_orders (assigned_collaborator_id)
  WHERE assigned_collaborator_id IS NOT NULL;

-- ── 2. Add billing_reference to work_orders ────────────────────────────────
--
-- Free-text reference tied to the client invoice / billing cycle.
-- Populated by admin when issuing invoice.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS billing_reference TEXT;

-- ── 3. Expose collaborator in work_order_state_history ─────────────────────
--
-- No schema change needed — changed_by already records who acted.
-- This comment is intentional: the transition validator must allow
-- 'assigned → in_progress' for collaborator-owned orders.

COMMENT ON COLUMN public.work_orders.assigned_collaborator_id IS
  'Set on direct orders. When non-null the order is managed by an
   external collaborator instead of an internal team technician.';

COMMENT ON COLUMN public.work_orders.billing_reference IS
  'Client-facing invoice or billing-cycle reference. Populated on
   transition to invoiced status.';
