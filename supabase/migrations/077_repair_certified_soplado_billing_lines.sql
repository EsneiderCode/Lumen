-- LUMEN — Migration 077: repair certified Soplado billing snapshots
-- Depends on: 076_capture_plan_soplado_ra_v4.sql, 018_fix_billing_external_price_snapshot.sql
--
-- Reconstructs the missing accounting line only when an internal certification
-- audit proves that the order was certified and the order still has no billing
-- lines. Quantity and both prices come from the submitted capture report and
-- catalog; no order number, amount or price is hardcoded.

BEGIN;

WITH certified_soplado AS (
  SELECT
    wo.id AS work_order_id,
    wo.service_item_id,
    si.unit_price,
    si.unit_price_external,
    CASE
      WHEN (cr.answers #>> '{details,meters}') ~
           '^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
        THEN (cr.answers #>> '{details,meters}')::numeric
      ELSE NULL
    END AS qty
  FROM public.work_orders wo
  JOIN public.work_order_capture_reports cr
    ON cr.work_order_id = wo.id
   AND cr.submitted_at IS NOT NULL
  JOIN public.service_items si
    ON si.id = wo.service_item_id
  WHERE wo.work_type = 'soplado'
    AND si.unit_price IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.certification_audits ca
      WHERE ca.work_order_id = wo.id
        AND ca.cert_type = 'internal'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.work_order_billing_lines existing
      WHERE existing.work_order_id = wo.id
    )
), inserted AS (
  INSERT INTO public.work_order_billing_lines (
    work_order_id,
    service_item_id,
    qty,
    unit_price_snapshot,
    unit_price_external_snapshot,
    notes
  )
  SELECT
    work_order_id,
    service_item_id,
    qty,
    unit_price,
    unit_price_external,
    'Migration 077: reconstructed from certified capture report'
  FROM certified_soplado
  WHERE qty > 0
  RETURNING work_order_id
)
SELECT count(*) AS repaired_certified_soplado_orders
FROM inserted;

COMMIT;
