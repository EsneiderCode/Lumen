-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Billing flow extensions + direct orders
-- Depends on: 001_initial_schema.sql, 002_cert_audit.sql, 004_service_catalog_seed.sql, 005_direct_orders_and_billing.sql, 006_collaborator_pricing.sql, 008_wo_service_item_id.sql
-- Purpose:
--   - Direct orders can exist without client_id.
--   - Service catalog stores internal and external collaborator prices.
--   - Work orders can persist billing line snapshots for invoicing/DATEV.
--   - Certification audit supports external collaborator acceptance.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Direct orders: internal jobs do not always have an external client.
ALTER TABLE public.work_orders
  ALTER COLUMN client_id DROP NOT NULL;

-- 2. External collaborator pricing on service catalog.
ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS unit_price_external NUMERIC(10,2);

-- 3. Certification audits: external collaborators need their own acceptance row.
ALTER TABLE public.certification_audits
  DROP CONSTRAINT IF EXISTS certification_audits_cert_type_check;

ALTER TABLE public.certification_audits
  ADD CONSTRAINT certification_audits_cert_type_check
  CHECK (cert_type IN ('internal', 'client', 'external'));

-- 4. Billing line snapshots.
-- Snapshots are intentionally copied from service_items at the time of billing,
-- so later catalog price edits do not rewrite old invoices. Tiny accounting time
-- machine. Useful. Dangerous if missing. Now not missing.
CREATE TABLE IF NOT EXISTS public.work_order_billing_lines (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id                 UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_item_id               UUID NOT NULL REFERENCES public.service_items(id),
  qty                           NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  unit_price_snapshot           NUMERIC(10,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  unit_price_external_snapshot  NUMERIC(10,2) CHECK (unit_price_external_snapshot IS NULL OR unit_price_external_snapshot >= 0),
  subtotal                      NUMERIC(12,2) GENERATED ALWAYS AS (round(qty * unit_price_snapshot, 2)) STORED,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wobl_work_order
  ON public.work_order_billing_lines (work_order_id);

CREATE INDEX IF NOT EXISTS idx_wobl_service_item
  ON public.work_order_billing_lines (service_item_id);

DROP TRIGGER IF EXISTS handle_wobl_updated_at ON public.work_order_billing_lines;
CREATE TRIGGER handle_wobl_updated_at
  BEFORE UPDATE ON public.work_order_billing_lines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.work_order_billing_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wobl_admin_all" ON public.work_order_billing_lines;
CREATE POLICY "wobl_admin_all" ON public.work_order_billing_lines
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "wobl_assignee_select" ON public.work_order_billing_lines;
CREATE POLICY "wobl_assignee_select" ON public.work_order_billing_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.assigned_technician = auth.uid()
    )
  );
