-- ============================================================
-- LUMEN — Migration 007: wo_detail_pop
-- HMR Nexus Engineering GmbH
-- ============================================================
-- Creates the missing wo_detail_pop table so POP work orders
-- can complete the detail-form step and pass certification.
-- The TypeScript type was already defined in database.types.ts;
-- this migration makes the schema match.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wo_detail_pop (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id       UUID NOT NULL UNIQUE
                        REFERENCES public.work_orders(id) ON DELETE CASCADE,
  rack_id             TEXT,
  tray_count          INT,
  cable_entry_points  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_detail_pop_work_order
  ON public.wo_detail_pop (work_order_id);

-- RLS: same pattern as other wo_detail_* tables
ALTER TABLE public.wo_detail_pop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_wo_detail_pop" ON public.wo_detail_pop
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.wo_detail_pop IS
  'Technical detail form for POP (Point of Presence) installation work orders.
   Required before certification can proceed for work_type = ''pop''.';
