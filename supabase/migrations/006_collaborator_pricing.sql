-- ============================================================
-- LUMEN — Migration 006: Collaborator Pricing
-- HMR Nexus Engineering GmbH
-- ============================================================
-- Adds unit_price_external to service_items so each catalog entry
-- can carry both the client-facing price and the collaborator cost,
-- and adds a work_order_line_items table that records the actual
-- quantities and prices used per work order (for billing reports).
-- ============================================================

-- ── 1. unit_price_external on service_items ────────────────────────────────
--
-- unit_price         = what we charge the client (€ netto)
-- unit_price_external = what we pay the collaborator (€ netto)
-- Values loaded from UMTELKOMD contract PDF by Jarl after this migration lands.

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS unit_price_external NUMERIC(12, 4);

COMMENT ON COLUMN public.service_items.unit_price_external IS
  'Cost price paid to external collaborator per unit. NULL = Nach Angebot.
   Loaded from operator contract after migration 006.';

-- ── 2. work_order_line_items ───────────────────────────────────────────────
--
-- Records which service items were performed on a work order, the
-- agreed quantity, and the locked-in prices at time of certification.
-- This allows retroactive contract changes without altering history.

CREATE TABLE IF NOT EXISTS public.work_order_line_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id        UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_item_id      UUID NOT NULL REFERENCES public.service_items(id) ON DELETE RESTRICT,
  quantity             NUMERIC(12, 4) NOT NULL DEFAULT 1,
  -- Snapshot prices locked at time of billing (null = Nach Angebot)
  unit_price_snapshot          NUMERIC(12, 4),
  unit_price_external_snapshot NUMERIC(12, 4),
  notes                TEXT,
  created_by           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_woli_work_order
  ON public.work_order_line_items (work_order_id);

CREATE INDEX IF NOT EXISTS idx_woli_service_item
  ON public.work_order_line_items (service_item_id);

-- ── 3. RLS policies ────────────────────────────────────────────────────────

ALTER TABLE public.work_order_line_items ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_all_line_items" ON public.work_order_line_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Collaborators can read line items for their own orders
CREATE POLICY "collaborators_read_own_line_items" ON public.work_order_line_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.assigned_collaborator_id = auth.uid()
    )
  );

COMMENT ON TABLE public.work_order_line_items IS
  'Billing line items for a work order. Prices are snapshotted at
   certification time so retroactive catalog changes do not affect
   closed orders.';
