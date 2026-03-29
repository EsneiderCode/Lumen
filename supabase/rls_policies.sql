-- ============================================================
-- LUMEN — RLS Policies + Storage Setup
-- Ejecutar completo en Supabase SQL Editor
-- Seguro de re-ejecutar: usa DROP POLICY IF EXISTS antes de cada CREATE
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── clients ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;

CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (true);

-- ── projects ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated USING (true);

-- ── operators ────────────────────────────────────────────────
DROP POLICY IF EXISTS "operators_select" ON operators;
DROP POLICY IF EXISTS "operators_insert" ON operators;
DROP POLICY IF EXISTS "operators_update" ON operators;

CREATE POLICY "operators_select" ON operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators_insert" ON operators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operators_update" ON operators FOR UPDATE TO authenticated USING (true);

-- ── work_orders ──────────────────────────────────────────────
DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
DROP POLICY IF EXISTS "work_orders_delete" ON work_orders;

CREATE POLICY "work_orders_select" ON work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_orders_delete" ON work_orders FOR DELETE TO authenticated USING (true);

-- ── work_order_state_history ──────────────────────────────────
DROP POLICY IF EXISTS "wo_history_select" ON work_order_state_history;
DROP POLICY IF EXISTS "wo_history_insert" ON work_order_state_history;

CREATE POLICY "wo_history_select" ON work_order_state_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_history_insert" ON work_order_state_history FOR INSERT TO authenticated WITH CHECK (true);

-- ── work_order_photos ─────────────────────────────────────────
DROP POLICY IF EXISTS "wo_photos_select" ON work_order_photos;
DROP POLICY IF EXISTS "wo_photos_insert" ON work_order_photos;
DROP POLICY IF EXISTS "wo_photos_delete" ON work_order_photos;

CREATE POLICY "wo_photos_select" ON work_order_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_photos_insert" ON work_order_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_photos_delete" ON work_order_photos FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- ── wo_detail_soplado ─────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_soplado_select" ON wo_detail_soplado;
DROP POLICY IF EXISTS "wo_detail_soplado_insert" ON wo_detail_soplado;
DROP POLICY IF EXISTS "wo_detail_soplado_update" ON wo_detail_soplado;

CREATE POLICY "wo_detail_soplado_select" ON wo_detail_soplado FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_soplado_insert" ON wo_detail_soplado FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_soplado_update" ON wo_detail_soplado FOR UPDATE TO authenticated USING (true);

-- ── wo_detail_fusion_ap ───────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_fusion_ap_select" ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "wo_detail_fusion_ap_insert" ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "wo_detail_fusion_ap_update" ON wo_detail_fusion_ap;

CREATE POLICY "wo_detail_fusion_ap_select" ON wo_detail_fusion_ap FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_fusion_ap_insert" ON wo_detail_fusion_ap FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_fusion_ap_update" ON wo_detail_fusion_ap FOR UPDATE TO authenticated USING (true);

-- ── wo_detail_fusion_dp ───────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_fusion_dp_select" ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "wo_detail_fusion_dp_insert" ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "wo_detail_fusion_dp_update" ON wo_detail_fusion_dp;

CREATE POLICY "wo_detail_fusion_dp_select" ON wo_detail_fusion_dp FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_fusion_dp_insert" ON wo_detail_fusion_dp FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_fusion_dp_update" ON wo_detail_fusion_dp FOR UPDATE TO authenticated USING (true);

-- ── wo_detail_alta ────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_alta_select" ON wo_detail_alta;
DROP POLICY IF EXISTS "wo_detail_alta_insert" ON wo_detail_alta;
DROP POLICY IF EXISTS "wo_detail_alta_update" ON wo_detail_alta;

CREATE POLICY "wo_detail_alta_select" ON wo_detail_alta FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_alta_insert" ON wo_detail_alta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_alta_update" ON wo_detail_alta FOR UPDATE TO authenticated USING (true);

-- ── wo_detail_nt ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_nt_select" ON wo_detail_nt;
DROP POLICY IF EXISTS "wo_detail_nt_insert" ON wo_detail_nt;
DROP POLICY IF EXISTS "wo_detail_nt_update" ON wo_detail_nt;

CREATE POLICY "wo_detail_nt_select" ON wo_detail_nt FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_nt_insert" ON wo_detail_nt FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_nt_update" ON wo_detail_nt FOR UPDATE TO authenticated USING (true);

-- ── wo_detail_patchkabel ──────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_patchkabel_select" ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "wo_detail_patchkabel_insert" ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "wo_detail_patchkabel_update" ON wo_detail_patchkabel;

CREATE POLICY "wo_detail_patchkabel_select" ON wo_detail_patchkabel FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_detail_patchkabel_insert" ON wo_detail_patchkabel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wo_detail_patchkabel_update" ON wo_detail_patchkabel FOR UPDATE TO authenticated USING (true);

-- ── materials ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "materials_select" ON materials;
DROP POLICY IF EXISTS "materials_insert" ON materials;
DROP POLICY IF EXISTS "materials_update" ON materials;

CREATE POLICY "materials_select" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "materials_insert" ON materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "materials_update" ON materials FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- STORAGE — bucket work-order-photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_owner_delete" ON storage.objects;

CREATE POLICY "storage_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'work-order-photos');

CREATE POLICY "storage_photos_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "storage_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-photos' AND auth.uid() = owner);
