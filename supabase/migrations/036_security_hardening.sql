-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 036 — Security hardening
-- Depends on: 035_rbac_policy_migration.sql
-- Purpose:
--   Close three issues found in a security audit of the RBAC rollout:
--
--   1) wo_detail_pop RLS gap. Table 007 shipped with a single
--      `USING (true) WITH CHECK (true)` policy for every authenticated user.
--      The other six wo_detail_* tables were rewritten to permission + ownership
--      checks in 035, but wo_detail_pop was missed — so ANY authenticated user
--      (technician, contractor, scheduler) could read and modify POP install
--      details for orders that are not theirs. Rewrite it to match the other
--      detail tables: admin/office reach via work_orders permissions, field reach
--      via assigned-technician ownership.
--
--   2) SECURITY DEFINER functions without a pinned search_path. get_user_role()
--      and handle_new_user() from 001 run as the definer (superuser) but never
--      SET search_path, so a role that can create objects in an earlier schema on
--      the resolution path could shadow a referenced object and run code as the
--      definer. Recreate both with `SET search_path = public, pg_temp` (parity
--      with every function added in 034).
--
--   3) handle_new_user() trusted a client-supplied role. It inserted the new
--      profile with `raw_user_meta_data->>'role'`, which is attacker-controlled
--      on any self-service signup — a user could sign up as 'admin'. Always
--      default new profiles to 'technician'; the admin-users Edge Function still
--      sets the real role afterwards via its explicit profiles upsert, so the
--      admin-driven create flow is unchanged.
--
-- Run manually in Supabase SQL Editor (after 035).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) wo_detail_pop — replace the permissive policy ────────────────────────────
DROP POLICY IF EXISTS "authenticated_all_wo_detail_pop" ON public.wo_detail_pop;

-- Office/admin reach, gated on work_orders permissions (mirrors 035 §4).
CREATE POLICY "wo_detail_pop_select_perm" ON public.wo_detail_pop
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));
CREATE POLICY "wo_detail_pop_insert_perm" ON public.wo_detail_pop
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('work_orders.edit'));
CREATE POLICY "wo_detail_pop_update_perm" ON public.wo_detail_pop
  FOR UPDATE TO authenticated
  USING (public.has_permission('work_orders.edit'))
  WITH CHECK (public.has_permission('work_orders.edit'));
CREATE POLICY "wo_detail_pop_delete_perm" ON public.wo_detail_pop
  FOR DELETE TO authenticated
  USING (public.has_permission('work_orders.edit'));

-- Field reach: the assigned technician fills POP details for their own order
-- (mirrors the "Users can view/insert/update own order <x> details" policies
-- that 001 created for the other six detail tables).
CREATE POLICY "wo_detail_pop_select_own" ON public.wo_detail_pop
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));
CREATE POLICY "wo_detail_pop_insert_own" ON public.wo_detail_pop
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));
CREATE POLICY "wo_detail_pop_update_own" ON public.wo_detail_pop
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

-- 2 + 3) Recreate the two unpinned SECURITY DEFINER functions ─────────────────

-- get_user_role() — still referenced by ownership RLS OR-branches and by the
-- legacy admin-check Edge Functions. Pin search_path; behavior is unchanged.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- handle_new_user() — pin search_path AND stop trusting the client-supplied
-- role. New profiles always start as 'technician' (the least-privileged
-- persona); privileged roles are assigned only through admin-controlled flows
-- (admin-users upserts the real role right after creating the auth user).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'technician'
  );
  RETURN NEW;
END;
$$;
