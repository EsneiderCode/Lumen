-- ============================================
-- Work order provenance: source + external_metadata
-- ============================================
-- Adds typed origin tracking to work_orders so LUMEN can distinguish
-- orders created in-app from those synced by the NE4 bridge.
--
-- Depends on: 024_employee_teams.sql

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'lumen'
    CHECK (source IN ('lumen', 'ne4')),
  ADD COLUMN IF NOT EXISTS external_metadata JSONB;

-- Backfill provenance for orders the bridge already created
-- (order_number convention NE4-<report uuid> since the bridge launched):
UPDATE public.work_orders SET source = 'ne4'
WHERE order_number LIKE 'NE4-%' AND source = 'lumen';

CREATE INDEX IF NOT EXISTS idx_work_orders_source
  ON public.work_orders (source) WHERE source <> 'lumen';

COMMENT ON COLUMN public.work_orders.source IS
  'Origin system: lumen (created in-app) or ne4 (synced by the NE4 Work Manager bridge).';
COMMENT ON COLUMN public.work_orders.external_metadata IS
  'Structured payload from the origin system (NE4: report/cita ids, HA, WE count, workflow, score, work zones).';
