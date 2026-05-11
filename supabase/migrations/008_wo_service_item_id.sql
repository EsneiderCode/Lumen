-- ============================================================
-- LUMEN — Migration 008: Add service_item_id to work_orders
-- HMR Nexus Engineering GmbH
-- ============================================================
-- The frontend (WorkOrderFormPage) references service_item_id
-- on work_orders for invoicing / catalog linkage, but the column
-- was never added to the table. This migration closes the gap.
-- ============================================================

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS service_item_id UUID
    REFERENCES public.service_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wo_service_item
  ON public.work_orders (service_item_id)
  WHERE service_item_id IS NOT NULL;

COMMENT ON COLUMN public.work_orders.service_item_id IS
  'Links the work order to a catalog service item for invoicing.
   Drives unit price and billing reference when generating client invoices.';
