-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029 — Collaborator cycle calendar (administrative milestones)
-- Depends on: 028_appointments_and_scheduler_scope.sql
-- Purpose:
--   1. Create collaborator_cycles: per-collaborator administrative/billing cycle
--      with a free date range (period_start/period_end) and four milestone dates
--      (emission, review_start, final_cert, payment). Visibility gated by
--      status draft|published (D5: unpublish allowed, both directions).
--   2. Create collaborator_cycle_orders bridge: explicit work orders attached to
--      a cycle (D2). PK (cycle_id, work_order_id); cascade on cycle delete.
--   3. RLS (plan §5): admin FOR ALL via get_user_role()='admin'; contractor SELECT
--      only own published rows; same visibility join for the bridge. No contractor
--      write.
--
--   Business rules enforced in the application layer, not here:
--     - D3: review window end = review_start_date + 3 business days (derived).
--     - D4: payment_date = final_cert_date + 20 calendar days, ALWAYS recalculated
--            when final_cert_date changes (no override flag/column).
--   The contractor role value is 'contractor' (public.user_role).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Collaborator cycles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaborator_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id   UUID NOT NULL REFERENCES public.profiles(id),  -- role = contractor
  -- free date range (D1): admin sets start/end
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  period_label      TEXT,                 -- optional free-form label
  -- milestones
  emission_date     DATE,
  review_start_date DATE,                 -- end = +3 business days (D3, derived in app)
  final_cert_date   DATE,
  payment_date      DATE,                 -- = final_cert_date + 20 (D4, recalculated in app)
  -- visibility
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  published_at      TIMESTAMPTZ,
  published_by      UUID REFERENCES public.profiles(id),
  -- audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS collaborator_cycles_collaborator_status_idx
  ON public.collaborator_cycles (collaborator_id, status);

-- ── 2. Cycle ↔ work orders bridge (D2) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaborator_cycle_orders (
  cycle_id      UUID NOT NULL REFERENCES public.collaborator_cycles(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id),
  PRIMARY KEY (cycle_id, work_order_id)
);

CREATE INDEX IF NOT EXISTS collaborator_cycle_orders_work_order_idx
  ON public.collaborator_cycle_orders (work_order_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.collaborator_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_cycle_orders ENABLE ROW LEVEL SECURITY;

-- admin: full access to all cycles
CREATE POLICY collaborator_cycles_admin_all ON public.collaborator_cycles
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- contractor: SELECT only own published cycles. No write.
CREATE POLICY collaborator_cycles_contractor_read ON public.collaborator_cycles
  FOR SELECT
  USING (
    public.get_user_role() = 'contractor'
    AND collaborator_id = auth.uid()
    AND status = 'published'
  );

-- admin: full access to the bridge
CREATE POLICY collaborator_cycle_orders_admin_all ON public.collaborator_cycle_orders
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- contractor: SELECT bridge rows only for own published cycles. No write.
CREATE POLICY collaborator_cycle_orders_contractor_read ON public.collaborator_cycle_orders
  FOR SELECT
  USING (
    public.get_user_role() = 'contractor'
    AND EXISTS (
      SELECT 1 FROM public.collaborator_cycles c
      WHERE c.id = collaborator_cycle_orders.cycle_id
        AND c.collaborator_id = auth.uid()
        AND c.status = 'published'
    )
  );
