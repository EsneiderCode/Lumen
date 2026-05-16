-- ─────────────────────────────────────────────────────────────────────────
-- Migration 005 — Direct Orders + Billing Model
--
-- Depends on:
--   · 001_initial_schema.sql            (work_orders, wo_detail_*, profiles)
--   · 002_cert_audit.sql                (certification_audits, status trigger fn)
--   · 004_service_catalog_seed.sql      (service_items table + 102 contract rows)
--
-- Adds the foundation so DATEV export can compute amounts per certified order:
--   1. work_orders.client_id → nullable (NULL = direct order, no Insyte/Vancom)
--   2. work_orders.assigned_collaborator_id + billing_reference
--   3. wo_detail_fusion_ap / wo_detail_fusion_dp gain cabinet_code + card_count
--   4. work_order_billing_lines: per-order line items with snapshot pricing
--   5. validate_work_order_status_transition(): direct orders may shortcut
--      internally_certified → invoiced (skip sent_to_client / client_accepted)
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. work_orders.client_id → nullable ──────────────────────────────────
ALTER TABLE public.work_orders
  ALTER COLUMN client_id DROP NOT NULL;

COMMENT ON COLUMN public.work_orders.client_id IS
  'External client (Insyte, Vancom, etc.). NULL = direct order with no external client.';


-- ── 2. assigned_collaborator_id + billing_reference ──────────────────────
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS assigned_collaborator_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wo_collaborator
  ON public.work_orders (assigned_collaborator_id)
  WHERE assigned_collaborator_id IS NOT NULL;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS billing_reference TEXT;

COMMENT ON COLUMN public.work_orders.assigned_collaborator_id IS
  'Set on direct orders. When non-null the order is managed by an
   external collaborator instead of an internal team technician.';

COMMENT ON COLUMN public.work_orders.billing_reference IS
  'Client-facing invoice or billing-cycle reference. Populated on
   transition to invoiced status.';


-- ── 3. Fusion details: cabinet identifier + card count for POP ───────────
ALTER TABLE public.wo_detail_fusion_ap
  ADD COLUMN IF NOT EXISTS cabinet_code TEXT,
  ADD COLUMN IF NOT EXISTS card_count   INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wo_detail_fusion_ap_card_count_positive'
  ) THEN
    ALTER TABLE public.wo_detail_fusion_ap
      ADD CONSTRAINT wo_detail_fusion_ap_card_count_positive
      CHECK (card_count IS NULL OR card_count > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.wo_detail_fusion_ap.cabinet_code IS
  'Schrank/cabinet identifier (e.g. NE3-S-001). Single cabinet per order.';
COMMENT ON COLUMN public.wo_detail_fusion_ap.card_count IS
  'Number of cards fused. Used at POP level (multiple cards in one cabinet). NULL or 1 for NE3/NE4 cabinet-level work.';

ALTER TABLE public.wo_detail_fusion_dp
  ADD COLUMN IF NOT EXISTS cabinet_code TEXT,
  ADD COLUMN IF NOT EXISTS card_count   INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wo_detail_fusion_dp_card_count_positive'
  ) THEN
    ALTER TABLE public.wo_detail_fusion_dp
      ADD CONSTRAINT wo_detail_fusion_dp_card_count_positive
      CHECK (card_count IS NULL OR card_count > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.wo_detail_fusion_dp.cabinet_code IS
  'Schrank/cabinet identifier. Single cabinet per order.';
COMMENT ON COLUMN public.wo_detail_fusion_dp.card_count IS
  'Number of cards fused. Only meaningful at POP level.';


-- ── 4. Billing lines: snapshot pricing at certification time ─────────────
CREATE TABLE IF NOT EXISTS public.work_order_billing_lines (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id         UUID          NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_item_id       UUID          NOT NULL REFERENCES public.service_items(id),
  qty                   NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  unit_price_snapshot   NUMERIC(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  subtotal              NUMERIC(14,2) GENERATED ALWAYS AS (qty * unit_price_snapshot) STORED,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_lines_wo
  ON public.work_order_billing_lines (work_order_id);

CREATE INDEX IF NOT EXISTS idx_billing_lines_service_item
  ON public.work_order_billing_lines (service_item_id);

DROP TRIGGER IF EXISTS set_updated_at_billing_lines ON public.work_order_billing_lines;
CREATE TRIGGER set_updated_at_billing_lines BEFORE UPDATE ON public.work_order_billing_lines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.work_order_billing_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_lines_admin"             ON public.work_order_billing_lines;
DROP POLICY IF EXISTS "billing_lines_assigned_select"   ON public.work_order_billing_lines;
DROP POLICY IF EXISTS "billing_lines_technician_insert" ON public.work_order_billing_lines;
DROP POLICY IF EXISTS "billing_lines_technician_update" ON public.work_order_billing_lines;

CREATE POLICY "billing_lines_admin"
  ON public.work_order_billing_lines FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "billing_lines_assigned_select"
  ON public.work_order_billing_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "billing_lines_technician_insert"
  ON public.work_order_billing_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "billing_lines_technician_update"
  ON public.work_order_billing_lines FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── 5. State machine: direct-order shortcut ──────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_work_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_direct BOOLEAN := (NEW.client_id IS NULL);
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'created'              AND NEW.status IN ('assigned',           'cancelled')) OR
    (OLD.status = 'assigned'             AND NEW.status IN ('in_progress',        'cancelled')) OR
    (OLD.status = 'in_progress'          AND NEW.status IN ('executed',           'cancelled')) OR
    (OLD.status = 'executed'             AND NEW.status IN ('rueckmeldung_pending','cancelled')) OR
    (OLD.status = 'rueckmeldung_pending' AND NEW.status IN ('rueckmeldung_sent',  'cancelled')) OR
    (OLD.status = 'rueckmeldung_sent'    AND NEW.status IN ('internally_certified','returned', 'cancelled')) OR
    (OLD.status = 'internally_certified' AND (
        NEW.status = 'sent_to_client'
        OR NEW.status = 'cancelled'
        OR (is_direct AND NEW.status = 'invoiced')
    )) OR
    (OLD.status = 'sent_to_client'       AND NEW.status IN ('client_accepted',    'client_rejected')) OR
    (OLD.status = 'client_accepted'      AND NEW.status IN ('invoiced')) OR
    (OLD.status = 'client_rejected'      AND NEW.status IN ('internally_certified')) OR
    (OLD.status = 'invoiced'             AND NEW.status IN ('paid')) OR
    (OLD.status = 'returned'             AND NEW.status IN ('rueckmeldung_pending'))
  ) THEN
    RAISE EXCEPTION
      'Ungültiger Statusübergang: % → % (Auftrag %, direct=%)',
      OLD.status, NEW.status, OLD.id, is_direct
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- DONE. Schema ready for direct orders + billing.
-- Next: regenerate database.types.ts (`supabase gen types typescript`).
-- ─────────────────────────────────────────────────────────────────────────
