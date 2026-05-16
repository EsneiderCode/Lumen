-- ─────────────────────────────────────────────────────────────────────────
-- Migration 006 — Collaborator Pricing + External Certification Type
--
-- Depends on:
--   · 004_service_catalog_seed.sql (service_items table)
--   · 002_cert_audit.sql            (certification_audits + cert_type CHECK)
--   · 005_direct_orders_and_billing.sql (work_orders, work_order_billing_lines)
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. service_items: document existing price + add external price ───────
COMMENT ON COLUMN public.service_items.unit_price IS
  'Price billed to the external client (Insyte, Vancom, …). NULL = "Nach Angebot" (quote on request).';

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS unit_price_external NUMERIC(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_items_unit_price_external_nonneg'
  ) THEN
    ALTER TABLE public.service_items
      ADD CONSTRAINT service_items_unit_price_external_nonneg
      CHECK (unit_price_external IS NULL OR unit_price_external >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.service_items.unit_price_external IS
  'Price paid to the external collaborator (contractor) when they execute this catalog item.
   NULL = pricing pending OR item only ever executed by internal staff.';


-- ── 2. work_order_line_items: full billing lines with external cost ───────
CREATE TABLE IF NOT EXISTS public.work_order_line_items (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id                UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_item_id              UUID NOT NULL REFERENCES public.service_items(id) ON DELETE RESTRICT,
  quantity                     NUMERIC(12, 4) NOT NULL DEFAULT 1,
  unit_price_snapshot          NUMERIC(12, 4),
  unit_price_external_snapshot NUMERIC(12, 4),
  notes                        TEXT,
  created_by                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_woli_work_order
  ON public.work_order_line_items (work_order_id);

CREATE INDEX IF NOT EXISTS idx_woli_service_item
  ON public.work_order_line_items (service_item_id);

ALTER TABLE public.work_order_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_line_items"             ON public.work_order_line_items;
DROP POLICY IF EXISTS "collaborators_read_own_line_items" ON public.work_order_line_items;

CREATE POLICY "admins_all_line_items" ON public.work_order_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "collaborators_read_own_line_items" ON public.work_order_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.assigned_collaborator_id = auth.uid()
    )
  );

COMMENT ON TABLE public.work_order_line_items IS
  'Billing line items for a work order. Prices are snapshotted at certification
   time so retroactive catalog changes do not affect closed orders.';


-- ── 3. certification_audits: add ''external'' as a valid cert_type ────────
ALTER TABLE public.certification_audits
  DROP CONSTRAINT IF EXISTS certification_audits_cert_type_check;

ALTER TABLE public.certification_audits
  ADD CONSTRAINT certification_audits_cert_type_check
  CHECK (cert_type IN ('internal', 'client', 'external'));

COMMENT ON COLUMN public.certification_audits.cert_type IS
  'Type of certification:
     internal — admin-internal quality seal (SHA-256 audit hash).
     client   — admin → client document, gates invoicing.
     external — admin → external collaborator document, gates payment to subcontractor.';


-- ─────────────────────────────────────────────────────────────────────────
-- DONE. Schema ready for collaborator pricing + external certification.
-- Next: regenerate database.types.ts (`supabase gen types typescript`).
-- ─────────────────────────────────────────────────────────────────────────
