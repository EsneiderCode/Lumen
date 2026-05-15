-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — Lock down service catalog pricing
-- Depends on: 013_lock_down_profile_self_updates.sql
-- Purpose:
--   Service orders should not expose prices to technicians/contractors.
--   Only admins see price columns in catalog/billing/certification flows.
-- ─────────────────────────────────────────────────────────────────────────────

-- Active service items are still readable to field users, but the base table
-- contains price columns. Restrict direct table reads to admins only; field UI
-- should use non-priced shapes/views/API paths.
DROP POLICY IF EXISTS "si_read_active" ON public.service_items;
DROP POLICY IF EXISTS "si_admin_all" ON public.service_items;

CREATE POLICY "si_admin_all" ON public.service_items
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Non-priced catalog for field users. This view intentionally excludes
-- unit_price and unit_price_external. It lets technicians choose executed
-- service items without turning the browser into a rate-card leak.
DROP VIEW IF EXISTS public.service_items_public;
CREATE VIEW public.service_items_public AS
SELECT
  si.id,
  si.code,
  si.description_de,
  si.description_es,
  si.unit,
  si.operator_id,
  si.client_id,
  si.detail_form,
  si.display_order,
  si.active,
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
WHERE si.active = true;

GRANT SELECT ON public.service_items_public TO authenticated;

-- Billing lines contain price snapshots and are admin/certification data.
-- Do not expose them to assignees; field users report executed work, admins
-- approve/certify and see amounts.
DROP POLICY IF EXISTS "wobl_assignee_select" ON public.work_order_billing_lines;
DROP POLICY IF EXISTS "wobl_admin_all" ON public.work_order_billing_lines;

CREATE POLICY "wobl_admin_all" ON public.work_order_billing_lines
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
