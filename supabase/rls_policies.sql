-- ============================================================
-- LUMEN — RLS Policies + Storage Setup
-- Ejecutar completo en Supabase SQL Editor
-- Seguro de re-ejecutar: usa DROP POLICY IF EXISTS antes de cada CREATE
--
-- Role matrix:
--   admin       → full access to all tables
--   technician  → read/update assigned orders + write Rückmeldung data
--   contractor  → read-only on assigned orders
--   lookup tables (clients/projects/operators/materials) → read-only for non-admins
-- ============================================================

-- ── Helper function (idempotent) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select"            ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"  ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles"  ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles"  ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

-- Admins can create profiles (technicians, contractors)
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

-- Admins can update any profile. Non-admin self-updates are intentionally
-- disabled because authorization-sensitive fields live on profiles.
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ============================================================
-- CLIENTS  (lookup — admin manages, others read-only)
-- ============================================================
DROP POLICY IF EXISTS "clients_select"  ON clients;
DROP POLICY IF EXISTS "clients_insert"  ON clients;
DROP POLICY IF EXISTS "clients_update"  ON clients;
DROP POLICY IF EXISTS "clients_delete"  ON clients;
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
DROP POLICY IF EXISTS "Admins can manage clients"           ON clients;

CREATE POLICY "clients_select"
  ON clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "clients_admin"
  ON clients FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- PROJECTS  (lookup — admin manages, others read-only)
-- ============================================================
DROP POLICY IF EXISTS "projects_select"  ON projects;
DROP POLICY IF EXISTS "projects_insert"  ON projects;
DROP POLICY IF EXISTS "projects_update"  ON projects;
DROP POLICY IF EXISTS "projects_delete"  ON projects;
DROP POLICY IF EXISTS "Authenticated users can read projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage projects"           ON projects;

CREATE POLICY "projects_select"
  ON projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "projects_admin"
  ON projects FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- OPERATORS  (lookup — admin manages, others read-only)
-- ============================================================
DROP POLICY IF EXISTS "operators_select"  ON operators;
DROP POLICY IF EXISTS "operators_insert"  ON operators;
DROP POLICY IF EXISTS "operators_update"  ON operators;
DROP POLICY IF EXISTS "operators_delete"  ON operators;
DROP POLICY IF EXISTS "Authenticated users can read operators" ON operators;
DROP POLICY IF EXISTS "Admins can manage operators"           ON operators;

CREATE POLICY "operators_select"
  ON operators FOR SELECT TO authenticated USING (true);

CREATE POLICY "operators_admin"
  ON operators FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- WORK ORDERS
-- ============================================================
DROP POLICY IF EXISTS "work_orders_select"  ON work_orders;
DROP POLICY IF EXISTS "work_orders_insert"  ON work_orders;
DROP POLICY IF EXISTS "work_orders_update"  ON work_orders;
DROP POLICY IF EXISTS "work_orders_delete"  ON work_orders;
DROP POLICY IF EXISTS "Admins full access to work orders"        ON work_orders;
DROP POLICY IF EXISTS "Technicians can view assigned orders"     ON work_orders;
DROP POLICY IF EXISTS "Technicians can update assigned orders"   ON work_orders;
DROP POLICY IF EXISTS "Contractors can view assigned orders"     ON work_orders;

-- Admins: full access
CREATE POLICY "work_orders_admin"
  ON work_orders FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- Technicians: read + update their own assigned orders
CREATE POLICY "work_orders_technician_select"
  ON work_orders FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND assigned_technician = auth.uid()
  );

CREATE POLICY "work_orders_technician_update"
  ON work_orders FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND assigned_technician = auth.uid()
  );

-- Contractors: read only their assigned orders
CREATE POLICY "work_orders_contractor_select"
  ON work_orders FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'contractor'
    AND assigned_technician = auth.uid()
  );


-- ============================================================
-- WORK ORDER STATE HISTORY
-- ============================================================
DROP POLICY IF EXISTS "wo_history_select"  ON work_order_state_history;
DROP POLICY IF EXISTS "wo_history_insert"  ON work_order_state_history;
DROP POLICY IF EXISTS "Admins full access to state history"               ON work_order_state_history;
DROP POLICY IF EXISTS "Users can view state history of assigned orders"   ON work_order_state_history;

CREATE POLICY "wo_history_admin"
  ON work_order_state_history FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- Technicians + contractors: view history of assigned orders
CREATE POLICY "wo_history_assigned_select"
  ON work_order_state_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

-- Technicians: insert state transitions (status changes, Rückmeldung)
CREATE POLICY "wo_history_technician_insert"
  ON work_order_state_history FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ============================================================
-- WORK ORDER PHOTOS
-- ============================================================
DROP POLICY IF EXISTS "wo_photos_select"  ON work_order_photos;
DROP POLICY IF EXISTS "wo_photos_insert"  ON work_order_photos;
DROP POLICY IF EXISTS "wo_photos_delete"  ON work_order_photos;
DROP POLICY IF EXISTS "Admins full access to photos"                    ON work_order_photos;
DROP POLICY IF EXISTS "Users can view photos of assigned orders"        ON work_order_photos;
DROP POLICY IF EXISTS "Technicians can upload photos to assigned orders" ON work_order_photos;

CREATE POLICY "wo_photos_admin"
  ON work_order_photos FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "wo_photos_assigned_select"
  ON work_order_photos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "wo_photos_technician_insert"
  ON work_order_photos FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "wo_photos_owner_delete"
  ON work_order_photos FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ============================================================
-- DETAIL TABLES — shared macro
-- Technicians: SELECT + INSERT + UPDATE on their assigned order's details
-- Contractors:  SELECT only
-- Admin: full access
-- ============================================================

-- ── wo_detail_soplado ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_soplado_select"  ON wo_detail_soplado;
DROP POLICY IF EXISTS "wo_detail_soplado_insert"  ON wo_detail_soplado;
DROP POLICY IF EXISTS "wo_detail_soplado_update"  ON wo_detail_soplado;
DROP POLICY IF EXISTS "Admins full access to soplado details"       ON wo_detail_soplado;
DROP POLICY IF EXISTS "Users can view own order soplado details"    ON wo_detail_soplado;

CREATE POLICY "soplado_admin"
  ON wo_detail_soplado FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "soplado_assigned_select"
  ON wo_detail_soplado FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "soplado_technician_insert"
  ON wo_detail_soplado FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "soplado_technician_update"
  ON wo_detail_soplado FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── wo_detail_fusion_ap ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_fusion_ap_select"  ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "wo_detail_fusion_ap_insert"  ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "wo_detail_fusion_ap_update"  ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "Admins full access to fusion_ap details"     ON wo_detail_fusion_ap;
DROP POLICY IF EXISTS "Users can view own order fusion_ap details"  ON wo_detail_fusion_ap;

CREATE POLICY "fusion_ap_admin"
  ON wo_detail_fusion_ap FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "fusion_ap_assigned_select"
  ON wo_detail_fusion_ap FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "fusion_ap_technician_insert"
  ON wo_detail_fusion_ap FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "fusion_ap_technician_update"
  ON wo_detail_fusion_ap FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── wo_detail_fusion_dp ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_fusion_dp_select"  ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "wo_detail_fusion_dp_insert"  ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "wo_detail_fusion_dp_update"  ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "Admins full access to fusion_dp details"     ON wo_detail_fusion_dp;
DROP POLICY IF EXISTS "Users can view own order fusion_dp details"  ON wo_detail_fusion_dp;

CREATE POLICY "fusion_dp_admin"
  ON wo_detail_fusion_dp FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "fusion_dp_assigned_select"
  ON wo_detail_fusion_dp FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "fusion_dp_technician_insert"
  ON wo_detail_fusion_dp FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "fusion_dp_technician_update"
  ON wo_detail_fusion_dp FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── wo_detail_alta ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_alta_select"  ON wo_detail_alta;
DROP POLICY IF EXISTS "wo_detail_alta_insert"  ON wo_detail_alta;
DROP POLICY IF EXISTS "wo_detail_alta_update"  ON wo_detail_alta;
DROP POLICY IF EXISTS "Admins full access to alta details"      ON wo_detail_alta;
DROP POLICY IF EXISTS "Users can view own order alta details"   ON wo_detail_alta;

CREATE POLICY "alta_admin"
  ON wo_detail_alta FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "alta_assigned_select"
  ON wo_detail_alta FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "alta_technician_insert"
  ON wo_detail_alta FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "alta_technician_update"
  ON wo_detail_alta FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── wo_detail_nt ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_nt_select"  ON wo_detail_nt;
DROP POLICY IF EXISTS "wo_detail_nt_insert"  ON wo_detail_nt;
DROP POLICY IF EXISTS "wo_detail_nt_update"  ON wo_detail_nt;
DROP POLICY IF EXISTS "Admins full access to nt details"      ON wo_detail_nt;
DROP POLICY IF EXISTS "Users can view own order nt details"   ON wo_detail_nt;

CREATE POLICY "nt_admin"
  ON wo_detail_nt FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "nt_assigned_select"
  ON wo_detail_nt FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "nt_technician_insert"
  ON wo_detail_nt FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "nt_technician_update"
  ON wo_detail_nt FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ── wo_detail_patchkabel ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "wo_detail_patchkabel_select"  ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "wo_detail_patchkabel_insert"  ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "wo_detail_patchkabel_update"  ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "Admins full access to patchkabel details"      ON wo_detail_patchkabel;
DROP POLICY IF EXISTS "Users can view own order patchkabel details"   ON wo_detail_patchkabel;

CREATE POLICY "patchkabel_admin"
  ON wo_detail_patchkabel FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "patchkabel_assigned_select"
  ON wo_detail_patchkabel FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "patchkabel_technician_insert"
  ON wo_detail_patchkabel FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

CREATE POLICY "patchkabel_technician_update"
  ON wo_detail_patchkabel FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );


-- ============================================================
-- MATERIALS  (admin manages, all authenticated read)
-- ============================================================
DROP POLICY IF EXISTS "materials_select"  ON materials;
DROP POLICY IF EXISTS "materials_insert"  ON materials;
DROP POLICY IF EXISTS "materials_update"  ON materials;
DROP POLICY IF EXISTS "materials_delete"  ON materials;
DROP POLICY IF EXISTS "Authenticated users can read materials"  ON materials;
DROP POLICY IF EXISTS "Admins can manage materials"            ON materials;

CREATE POLICY "materials_select"
  ON materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "materials_admin"
  ON materials FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- STORAGE — private buckets (all sensitive data)
-- Access via createSignedUrl() only — no public URLs.
-- ============================================================

-- work-order-photos: client addresses, installation details, operational photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- contractor-documents: Gewerbeanmeldung, Haftpflicht, ID/passport scans
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-documents', 'contractor-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- certification-pdfs: signed certification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('certification-pdfs', 'certification-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- payroll-pdfs: Gehaltsabrechnungen — highly sensitive
INSERT INTO storage.buckets (id, name, public)
VALUES ('payroll-pdfs', 'payroll-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop old policies
DROP POLICY IF EXISTS "storage_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_owner_delete"  ON storage.objects;

-- ── work-order-photos ────────────────────────────────────────
-- READ: authenticated only (prevents anonymous URL guessing; short-lived
--       signed URLs are used in the frontend via createSignedUrl)
CREATE POLICY "storage_photos_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-order-photos');

CREATE POLICY "storage_photos_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "storage_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-photos' AND auth.uid() = owner);

-- ── contractor-documents ────────────────────────────────────
CREATE POLICY "storage_contractor_docs_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contractor-documents');

CREATE POLICY "storage_contractor_docs_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contractor-documents'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "storage_contractor_docs_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND public.get_user_role() = 'admin'
  );

-- ── certification-pdfs ──────────────────────────────────────
CREATE POLICY "storage_cert_pdfs_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certification-pdfs');

CREATE POLICY "storage_cert_pdfs_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certification-pdfs'
    AND public.get_user_role() = 'admin'
  );

-- ── payroll-pdfs ────────────────────────────────────────────
CREATE POLICY "storage_payroll_pdfs_admin_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payroll-pdfs'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "storage_payroll_pdfs_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payroll-pdfs'
    AND public.get_user_role() = 'admin'
  );


-- ============================================================
-- WORK ORDER STATE MACHINE TRIGGER (defense in depth)
-- Enforces valid transitions at the DB level so that no client
-- — even one bypassing frontend validation — can corrupt state.
--
-- Valid transitions mirror the TypeScript VALID_TRANSITIONS map
-- in src/services/workOrderService.ts. Keep both in sync.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_work_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op if status did not change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate against the canonical state machine
  IF NOT (
    (OLD.status = 'created'              AND NEW.status IN ('assigned',           'cancelled')) OR
    (OLD.status = 'assigned'             AND NEW.status IN ('in_progress',        'cancelled')) OR
    (OLD.status = 'in_progress'          AND NEW.status IN ('executed',           'cancelled')) OR
    (OLD.status = 'executed'             AND NEW.status IN ('rueckmeldung_pending','cancelled')) OR
    (OLD.status = 'rueckmeldung_pending' AND NEW.status IN ('rueckmeldung_sent',  'cancelled')) OR
    (OLD.status = 'rueckmeldung_sent'    AND NEW.status IN ('internally_certified','returned', 'cancelled')) OR
    (OLD.status = 'internally_certified' AND NEW.status IN ('sent_to_client',     'cancelled')) OR
    (OLD.status = 'sent_to_client'       AND NEW.status IN ('client_accepted',    'client_rejected')) OR
    (OLD.status = 'client_accepted'      AND NEW.status IN ('invoiced')) OR
    (OLD.status = 'client_rejected'      AND NEW.status IN ('internally_certified')) OR
    (OLD.status = 'invoiced'             AND NEW.status IN ('paid')) OR
    (OLD.status = 'returned'             AND NEW.status IN ('rueckmeldung_pending'))
    -- 'paid' and 'cancelled' have no valid outbound transitions → always raises
  ) THEN
    RAISE EXCEPTION
      'Ungültiger Statusübergang: % → % (Auftrag %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop before recreating (idempotent)
DROP TRIGGER IF EXISTS trg_validate_wo_status_transition ON public.work_orders;

CREATE TRIGGER trg_validate_wo_status_transition
  BEFORE UPDATE OF status ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_work_order_status_transition();
