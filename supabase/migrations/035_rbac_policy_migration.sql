-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 035 — Rewrite admin-gated RLS policies to permission checks
-- Depends on: 034_rbac_core.sql
-- Purpose:
--   Replace every policy gated on the role literal ('admin') with a
--   public.has_permission('<module>.<action>') check so custom roles created in
--   the RBAC admin UI get real backend enforcement.
--
--   NOT touched:
--     - Ownership/scope policies (assigned_technician = auth.uid(), scheduler
--       line/operator scope, contractor own-rows, team stock policies). Field
--       personas keep their reach through those, not through permissions.
--     - OR-branches like `get_user_role() = 'admin' OR <owner>` inside scoped
--       policies: redundant but harmless — admins also pass through the new
--       permission policies below, and get_user_role() keeps working.
--
--   Since the seeded system role 'admin' holds every permission (034), behavior
--   is identical after applying; the granularity only matters for custom roles.
--
-- Run manually in Supabase SQL Editor (after 034).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) profiles (001 select/insert; 013 update) ─────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "profiles_select_perm" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_permission('users.view'));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "profiles_insert_perm" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('users.create'));

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_perm" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_permission('users.edit'))
  WITH CHECK (public.has_permission('users.edit'));

-- 2) work_orders (001) ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins full access to work orders" ON public.work_orders;
CREATE POLICY "work_orders_select_perm" ON public.work_orders
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));
CREATE POLICY "work_orders_insert_perm" ON public.work_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('work_orders.create'));
CREATE POLICY "work_orders_update_perm" ON public.work_orders
  FOR UPDATE TO authenticated
  USING (public.has_permission('work_orders.edit'))
  WITH CHECK (public.has_permission('work_orders.edit'));
CREATE POLICY "work_orders_delete_perm" ON public.work_orders
  FOR DELETE TO authenticated
  USING (public.has_permission('work_orders.delete'));

-- 3) clients / projects / operators (001) ─────────────────────────────────────
-- Reads stay open to authenticated (001 policies untouched); writes need perms.
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
CREATE POLICY "clients_insert_perm" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('projects.create'));
CREATE POLICY "clients_update_perm" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_permission('projects.edit'))
  WITH CHECK (public.has_permission('projects.edit'));
CREATE POLICY "clients_delete_perm" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_permission('projects.edit'));

DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
CREATE POLICY "projects_insert_perm" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('projects.create'));
CREATE POLICY "projects_update_perm" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.has_permission('projects.edit'))
  WITH CHECK (public.has_permission('projects.edit'));
CREATE POLICY "projects_delete_perm" ON public.projects
  FOR DELETE TO authenticated
  USING (public.has_permission('projects.deactivate'));

DROP POLICY IF EXISTS "Admins can manage operators" ON public.operators;
CREATE POLICY "operators_insert_perm" ON public.operators
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('projects.create'));
CREATE POLICY "operators_update_perm" ON public.operators
  FOR UPDATE TO authenticated
  USING (public.has_permission('projects.edit'))
  WITH CHECK (public.has_permission('projects.edit'));
CREATE POLICY "operators_delete_perm" ON public.operators
  FOR DELETE TO authenticated
  USING (public.has_permission('projects.edit'));

-- 4) wo_detail_* (001) — identical shape across the six detail tables ─────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wo_detail_soplado', 'wo_detail_fusion_ap', 'wo_detail_fusion_dp',
    'wo_detail_alta', 'wo_detail_nt', 'wo_detail_patchkabel'
  ] LOOP
    -- 001 named these "Admins full access to <suffix> details" (raw suffix)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   'Admins full access to ' || replace(t, 'wo_detail_', '') || ' details', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L))',
      t || '_select_perm', t, 'work_orders.view');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(%L))',
      t || '_insert_perm', t, 'work_orders.edit');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
      t || '_update_perm', t, 'work_orders.edit', 'work_orders.edit');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_permission(%L))',
      t || '_delete_perm', t, 'work_orders.edit');
  END LOOP;
END $$;

-- 5) work_order_photos / state history / documents ────────────────────────────
DROP POLICY IF EXISTS "Admins full access to photos" ON public.work_order_photos;
CREATE POLICY "wo_photos_select_perm" ON public.work_order_photos
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));
CREATE POLICY "wo_photos_write_perm" ON public.work_order_photos
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.manage_photos'))
  WITH CHECK (public.has_permission('work_orders.manage_photos'));

DROP POLICY IF EXISTS "Admins full access to state history" ON public.work_order_state_history;
CREATE POLICY "wo_state_history_select_perm" ON public.work_order_state_history
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));
CREATE POLICY "wo_state_history_write_perm" ON public.work_order_state_history
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.edit'))
  WITH CHECK (public.has_permission('work_orders.edit'));

DROP POLICY IF EXISTS "admin_all_work_order_documents" ON public.work_order_documents;
CREATE POLICY "wo_documents_select_perm" ON public.work_order_documents
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));
CREATE POLICY "wo_documents_write_perm" ON public.work_order_documents
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.manage_documents'))
  WITH CHECK (public.has_permission('work_orders.manage_documents'));

-- 6) materials (001) ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage materials" ON public.materials;
CREATE POLICY "materials_insert_perm" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('materials.create'));
CREATE POLICY "materials_update_perm" ON public.materials
  FOR UPDATE TO authenticated
  USING (public.has_permission('materials.edit'))
  WITH CHECK (public.has_permission('materials.edit'));
CREATE POLICY "materials_delete_perm" ON public.materials
  FOR DELETE TO authenticated
  USING (public.has_permission('materials.deactivate'));

-- 7) certification_audits (002) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access to cert audits" ON public.certification_audits;
CREATE POLICY "cert_audits_select_perm" ON public.certification_audits
  FOR SELECT TO authenticated
  USING (public.has_permission('certification.view'));
CREATE POLICY "cert_audits_write_perm" ON public.certification_audits
  FOR ALL TO authenticated
  USING (public.has_permission('certification.certify_internal'))
  WITH CHECK (public.has_permission('certification.certify_internal'));

-- 8) service_items (014) ──────────────────────────────────────────────────────
-- Field users keep reading via the non-priced service_items_public view.
DROP POLICY IF EXISTS "si_admin_all" ON public.service_items;
CREATE POLICY "si_select_perm" ON public.service_items
  FOR SELECT TO authenticated
  USING (public.has_permission('service_catalog.view'));
CREATE POLICY "si_insert_perm" ON public.service_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('service_catalog.create'));
CREATE POLICY "si_update_perm" ON public.service_items
  FOR UPDATE TO authenticated
  USING (public.has_permission('service_catalog.edit'))
  WITH CHECK (public.has_permission('service_catalog.edit'));
CREATE POLICY "si_delete_perm" ON public.service_items
  FOR DELETE TO authenticated
  USING (public.has_permission('service_catalog.delete'));

-- 9) billing lines + line items (005/009/014, 006) ────────────────────────────
-- 005's "billing_lines_admin" was never dropped by 009/014 — remove it too.
DROP POLICY IF EXISTS "billing_lines_admin" ON public.work_order_billing_lines;
DROP POLICY IF EXISTS "wobl_admin_all" ON public.work_order_billing_lines;
CREATE POLICY "wobl_select_perm" ON public.work_order_billing_lines
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view_billing'));
CREATE POLICY "wobl_write_perm" ON public.work_order_billing_lines
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.edit_billing'))
  WITH CHECK (public.has_permission('work_orders.edit_billing'));

DROP POLICY IF EXISTS "admins_all_line_items" ON public.work_order_line_items;
CREATE POLICY "wo_line_items_select_perm" ON public.work_order_line_items
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view_billing'));
CREATE POLICY "wo_line_items_write_perm" ON public.work_order_line_items
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.edit_billing'))
  WITH CHECK (public.has_permission('work_orders.edit_billing'));

-- 10) pin_trusted_devices (010) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "pin_devices_admin_all" ON public.pin_trusted_devices;
CREATE POLICY "pin_devices_manage_perm" ON public.pin_trusted_devices
  FOR ALL TO authenticated
  USING (public.has_permission('users.edit'))
  WITH CHECK (public.has_permission('users.edit'));

-- 11) contractor_documents + storage bucket (011) ─────────────────────────────
DROP POLICY IF EXISTS "contractor_docs_admin_all" ON public.contractor_documents;
CREATE POLICY "contractor_docs_select_perm" ON public.contractor_documents
  FOR SELECT TO authenticated
  USING (public.has_permission('onboarding.view'));
CREATE POLICY "contractor_docs_write_perm" ON public.contractor_documents
  FOR ALL TO authenticated
  USING (public.has_permission('onboarding.review_documents'))
  WITH CHECK (public.has_permission('onboarding.review_documents'));

DROP POLICY IF EXISTS "storage_contractor_docs_auth_read" ON storage.objects;
CREATE POLICY "storage_contractor_docs_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND (
      public.has_permission('onboarding.view')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "storage_contractor_docs_admin_insert" ON storage.objects;
CREATE POLICY "storage_contractor_docs_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contractor-documents'
    AND public.has_permission('onboarding.review_documents')
  );

DROP POLICY IF EXISTS "storage_contractor_docs_admin_delete" ON storage.objects;
CREATE POLICY "storage_contractor_docs_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND public.has_permission('onboarding.review_documents')
  );

-- 12) material inventory (012) ────────────────────────────────────────────────
-- Team-scoped select/write policies stay untouched (field flows).
DROP POLICY IF EXISTS "inventory_vehicles_admin_all" ON public.inventory_vehicles;
CREATE POLICY "inventory_vehicles_select_perm" ON public.inventory_vehicles
  FOR SELECT TO authenticated
  USING (public.has_permission('materials.view'));
CREATE POLICY "inventory_vehicles_insert_perm" ON public.inventory_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('materials.create'));
CREATE POLICY "inventory_vehicles_update_perm" ON public.inventory_vehicles
  FOR UPDATE TO authenticated
  USING (public.has_permission('materials.edit'))
  WITH CHECK (public.has_permission('materials.edit'));
CREATE POLICY "inventory_vehicles_delete_perm" ON public.inventory_vehicles
  FOR DELETE TO authenticated
  USING (public.has_permission('materials.deactivate'));

DROP POLICY IF EXISTS "vehicle_stock_admin_all" ON public.vehicle_material_stock;
CREATE POLICY "vehicle_stock_select_perm" ON public.vehicle_material_stock
  FOR SELECT TO authenticated
  USING (public.has_permission('materials.view'));
CREATE POLICY "vehicle_stock_write_perm" ON public.vehicle_material_stock
  FOR ALL TO authenticated
  USING (public.has_permission('materials.edit'))
  WITH CHECK (public.has_permission('materials.edit'));

DROP POLICY IF EXISTS "womc_admin_all" ON public.work_order_material_consumptions;
CREATE POLICY "womc_select_perm" ON public.work_order_material_consumptions
  FOR SELECT TO authenticated
  USING (public.has_permission('materials.view'));
CREATE POLICY "womc_write_perm" ON public.work_order_material_consumptions
  FOR ALL TO authenticated
  USING (public.has_permission('materials.edit'))
  WITH CHECK (public.has_permission('materials.edit'));

DROP POLICY IF EXISTS "stock_movements_admin_all" ON public.stock_movements;
CREATE POLICY "stock_movements_select_perm" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.has_permission('materials.view'));
CREATE POLICY "stock_movements_write_perm" ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.has_permission('materials.edit'))
  WITH CHECK (public.has_permission('materials.edit'));

-- 13) telegram config (017) ───────────────────────────────────────────────────
-- has_permission() already requires an active profile (parity with the old
-- `AND is_active = true` condition).
DROP POLICY IF EXISTS "admin_manage_telegram_groups" ON public.telegram_groups;
CREATE POLICY "telegram_groups_manage_perm" ON public.telegram_groups
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage_telegram'))
  WITH CHECK (public.has_permission('settings.manage_telegram'));

DROP POLICY IF EXISTS "admin_manage_event_group_mappings" ON public.event_group_mappings;
CREATE POLICY "event_group_mappings_manage_perm" ON public.event_group_mappings
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage_telegram'))
  WITH CHECK (public.has_permission('settings.manage_telegram'));

-- 14) employees + vacations (019) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_admin_all" ON public.employees;
CREATE POLICY "employees_select_perm" ON public.employees
  FOR SELECT TO authenticated
  USING (public.has_permission('employees.view'));
CREATE POLICY "employees_insert_perm" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('employees.create'));
CREATE POLICY "employees_update_perm" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_permission('employees.edit'))
  WITH CHECK (public.has_permission('employees.edit'));
CREATE POLICY "employees_delete_perm" ON public.employees
  FOR DELETE TO authenticated
  USING (public.has_permission('employees.deactivate'));

DROP POLICY IF EXISTS "vacation_requests_admin_all" ON public.vacation_requests;
CREATE POLICY "vacation_requests_select_perm" ON public.vacation_requests
  FOR SELECT TO authenticated
  USING (public.has_permission('employees.view'));
CREATE POLICY "vacation_requests_write_perm" ON public.vacation_requests
  FOR ALL TO authenticated
  USING (public.has_permission('employees.manage_vacations'))
  WITH CHECK (public.has_permission('employees.manage_vacations'));

-- 15) team_pins (021) ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_pins_admin_all" ON public.team_pins;
CREATE POLICY "team_pins_manage_perm" ON public.team_pins
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage_team_pins'))
  WITH CHECK (public.has_permission('settings.manage_team_pins'));

-- 16) appointments (028) ──────────────────────────────────────────────────────
-- appointments_scheduler_scope stays untouched (line/operator scope).
DROP POLICY IF EXISTS "appointments_admin_all" ON public.appointments;
CREATE POLICY "appointments_select_perm" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.has_permission('appointments.view'));
CREATE POLICY "appointments_insert_perm" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('appointments.create'));
CREATE POLICY "appointments_update_perm" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.has_permission('appointments.edit'))
  WITH CHECK (public.has_permission('appointments.edit'));
CREATE POLICY "appointments_delete_perm" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_permission('appointments.edit'));

-- 17) collaborator cycles (029) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "collaborator_cycles_admin_all" ON public.collaborator_cycles;
CREATE POLICY "collaborator_cycles_select_perm" ON public.collaborator_cycles
  FOR SELECT TO authenticated
  USING (public.has_permission('cycles.view'));
CREATE POLICY "collaborator_cycles_insert_perm" ON public.collaborator_cycles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('cycles.create'));
CREATE POLICY "collaborator_cycles_update_perm" ON public.collaborator_cycles
  FOR UPDATE TO authenticated
  USING (public.has_permission('cycles.edit'))
  WITH CHECK (public.has_permission('cycles.edit'));
CREATE POLICY "collaborator_cycles_delete_perm" ON public.collaborator_cycles
  FOR DELETE TO authenticated
  USING (public.has_permission('cycles.delete'));

DROP POLICY IF EXISTS "collaborator_cycle_orders_admin_all" ON public.collaborator_cycle_orders;
CREATE POLICY "collaborator_cycle_orders_select_perm" ON public.collaborator_cycle_orders
  FOR SELECT TO authenticated
  USING (public.has_permission('cycles.view'));
CREATE POLICY "collaborator_cycle_orders_write_perm" ON public.collaborator_cycle_orders
  FOR ALL TO authenticated
  USING (public.has_permission('cycles.edit'))
  WITH CHECK (public.has_permission('cycles.edit'));

-- 18) subcontractor_onboarding (033) ──────────────────────────────────────────
DROP POLICY IF EXISTS "subcontractor_onboarding_admin_all" ON public.subcontractor_onboarding;
CREATE POLICY "subcontractor_onboarding_select_perm" ON public.subcontractor_onboarding
  FOR SELECT TO authenticated
  USING (public.has_permission('onboarding.view'));
CREATE POLICY "subcontractor_onboarding_write_perm" ON public.subcontractor_onboarding
  FOR ALL TO authenticated
  USING (public.has_permission('onboarding.edit'))
  WITH CHECK (public.has_permission('onboarding.edit'));
