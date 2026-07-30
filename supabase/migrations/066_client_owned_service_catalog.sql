-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066 — Client-owned service and price catalog
-- Depends on: 065_client_master_data.sql
-- Purpose:
--   - Keep service_items as the single SKU/rate table.
--   - Mark global/operator-scoped rows so new selectors can exclude them.
--   - Preserve global/operator-scoped rows for historical work orders only.
--   - Remove operator from new catalog applicability without deleting history.
-- The client-required CHECK is deferred to migration 070 after old
-- ServiceItemsPage writes have been cut over to client-owned rows.
--
-- Preflight:
--   SELECT client_id, code, count(*)
--   FROM public.service_items
--   WHERE client_id IS NOT NULL
--   GROUP BY client_id, code HAVING count(*) > 1;
--
-- Resolve duplicates before applying. Historical work_orders and
-- work_order_billing_lines must keep their existing service_item_id values.
-- Apply manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS legacy_only BOOLEAN NOT NULL DEFAULT false;

-- Rows without a client were previously global or operator-scoped. They remain
-- addressable by historical FKs but disappear from all new selectable catalogs.
UPDATE public.service_items
SET legacy_only = true
WHERE client_id IS NULL;

DO $$
DECLARE
  duplicate_rows TEXT;
BEGIN
  SELECT string_agg(client_id::text || ':' || code, ', ' ORDER BY client_id::text, code)
    INTO duplicate_rows
  FROM (
    SELECT client_id, code
    FROM public.service_items
    WHERE legacy_only = false
    GROUP BY client_id, code
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_rows IS NOT NULL THEN
    RAISE EXCEPTION
      'duplicate client catalog codes; merge or mark legacy before migration: %',
      duplicate_rows
      USING ERRCODE = 'unique_violation';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS service_items_client_code_unique
  ON public.service_items (client_id, code)
  WHERE legacy_only = false;
CREATE INDEX IF NOT EXISTS idx_service_items_client_selectable
  ON public.service_items (client_id, active, display_order)
  WHERE legacy_only = false;

CREATE OR REPLACE FUNCTION public.prevent_used_service_item_client_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     AND (
       EXISTS (
         SELECT 1 FROM public.work_orders wo WHERE wo.service_item_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.work_order_billing_lines line
         WHERE line.service_item_id = OLD.id
       )
     ) THEN
    RAISE EXCEPTION
      'service item client cannot change after order or billing use'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_items_freeze_used_client ON public.service_items;
CREATE TRIGGER service_items_freeze_used_client
  BEFORE UPDATE OF client_id ON public.service_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_used_service_item_client_change();

-- OWNER-EDITABLE CATALOG CLONING MAP
-- Keep this section commented until Alejandro explicitly maps every legacy row
-- to the clients that own a copy. Operator is intentionally not used to infer a
-- client. Add one VALUES row per approved source/client pair, then run the CTE
-- in a reviewed copy of this migration before the application switches to v2.
--
-- WITH catalog_map (source_service_item_id, client_code) AS (
--   VALUES
--     -- ('00000000-0000-0000-0000-000000000000'::UUID, 'INSYTE')
-- ),
-- resolved AS (
--   SELECT source.*, client.id AS target_client_id
--   FROM catalog_map map
--   JOIN public.service_items source ON source.id = map.source_service_item_id
--   JOIN public.clients client ON client.code = map.client_code
-- )
-- INSERT INTO public.service_items (
--   code, description_de, description_es, unit, unit_price,
--   unit_price_external, operator_id, client_id, detail_form, category,
--   display_order, active, is_pass_through, notes, legacy_only
-- )
-- SELECT
--   code, description_de, description_es, unit, unit_price,
--   unit_price_external, NULL, target_client_id, detail_form, category,
--   display_order, active, is_pass_through,
--   concat_ws(E'\n', notes, 'Cloned from legacy service item ' || id),
--   false
-- FROM resolved
-- ON CONFLICT (client_id, code) WHERE legacy_only = false DO NOTHING;

-- Field flows receive definitions and scope, never either price column.
DROP VIEW IF EXISTS public.service_items_public;
CREATE VIEW public.service_items_public AS
SELECT
  si.id,
  si.code,
  si.description_de,
  si.description_es,
  si.unit,
  si.category,
  si.operator_id,
  si.client_id,
  si.detail_form,
  si.display_order,
  si.active,
  si.is_pass_through,
  si.legacy_only,
  si.notes,
  si.created_at,
  si.updated_at,
  op.code AS operator_code,
  op.name AS operator_name,
  cl.code AS client_code,
  cl.name AS client_name
FROM public.service_items si
LEFT JOIN public.operators op ON op.id = si.operator_id
LEFT JOIN public.clients cl ON cl.id = si.client_id
WHERE si.active = true
  AND si.is_pass_through = false;

GRANT SELECT ON public.service_items_public TO authenticated;

COMMENT ON COLUMN public.service_items.legacy_only IS
  'True for historical global/operator-scoped rows. New order selectors must filter false and match client_id.';
COMMENT ON COLUMN public.service_items.operator_id IS
  'Legacy catalog provenance only. Ignored for client-first applicability; new client-owned rows write NULL.';

COMMIT;
