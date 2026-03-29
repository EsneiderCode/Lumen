-- ============================================================
-- LUMEN — Sprint 2: Complete Database Schema
-- HMR Nexus Engineering GmbH
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CUSTOM ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE public.user_role AS ENUM ('admin', 'technician', 'contractor');
CREATE TYPE public.team_color AS ENUM ('rot', 'gruen', 'blau', 'gelb');
CREATE TYPE public.work_order_status AS ENUM (
  'created', 'assigned', 'in_progress', 'executed',
  'rueckmeldung_pending', 'rueckmeldung_sent',
  'internally_certified', 'sent_to_client',
  'client_accepted', 'client_rejected',
  'invoiced', 'paid',
  'returned', 'cancelled'
);
CREATE TYPE public.work_type AS ENUM (
  'soplado', 'fusion_ap', 'fusion_dp',
  'alta', 'nt_installation', 'patchkabel'
);
CREATE TYPE public.priority_level AS ENUM ('normal', 'alta', 'urgente');

-- ────────────────────────────────────────────────────────────
-- 2. PROFILES (linked to auth.users)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL,
  role        public.user_role NOT NULL DEFAULT 'technician',
  team        public.team_color,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_team ON public.profiles (team) WHERE team IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. LOOKUP / REFERENCE TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,       -- e.g. 'Insyte Deutschland', 'Vancom IT'
  code        TEXT NOT NULL UNIQUE,       -- e.g. 'INSYTE', 'VANCOM'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,       -- HXT, RSD, WCB, QFF, WRZ, EHR
  name        TEXT NOT NULL,
  client_id   UUID REFERENCES public.clients(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.operators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,       -- DGF, GFP, UGG
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 4. WORK ORDERS (core table)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.work_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT NOT NULL UNIQUE,
  -- references
  client_id             UUID NOT NULL REFERENCES public.clients(id),
  project_id            UUID NOT NULL REFERENCES public.projects(id),
  operator_id           UUID NOT NULL REFERENCES public.operators(id),
  line                  TEXT NOT NULL CHECK (line IN ('NE3', 'NE4')),
  -- type & status
  work_type             public.work_type NOT NULL,
  status                public.work_order_status NOT NULL DEFAULT 'created',
  priority              public.priority_level NOT NULL DEFAULT 'normal',
  -- assignment
  assigned_team         public.team_color,
  assigned_technician   UUID REFERENCES public.profiles(id),
  assigned_date         DATE,
  -- location
  address               TEXT,
  postal_code           TEXT,
  city                  TEXT,
  -- metadata
  internal_notes        TEXT,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wo_status ON public.work_orders (status);
CREATE INDEX idx_wo_team ON public.work_orders (assigned_team) WHERE assigned_team IS NOT NULL;
CREATE INDEX idx_wo_technician ON public.work_orders (assigned_technician) WHERE assigned_technician IS NOT NULL;
CREATE INDEX idx_wo_client ON public.work_orders (client_id);
CREATE INDEX idx_wo_project ON public.work_orders (project_id);
CREATE INDEX idx_wo_created_at ON public.work_orders (created_at DESC);
CREATE INDEX idx_wo_order_number ON public.work_orders (order_number);

-- ────────────────────────────────────────────────────────────
-- 5. WORK-TYPE SPECIFIC DETAIL TABLES
-- ────────────────────────────────────────────────────────────

-- Soplado (NE3/NE4)
CREATE TABLE public.wo_detail_soplado (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  meters          NUMERIC(10,2),
  section         TEXT,                     -- tramo
  tube_diameter   TEXT,                     -- diámetro del tubo
  result          TEXT,                     -- resultado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fusión AP (Access Point)
CREATE TABLE public.wo_detail_fusion_ap (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  splice_count    INTEGER,
  fiber_type      TEXT,
  fusion_losses   NUMERIC(6,3),             -- dB
  has_measurement_cert BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fusión DP (Distribution Point)
CREATE TABLE public.wo_detail_fusion_dp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  splice_count    INTEGER,
  fiber_type      TEXT,
  fusion_losses   NUMERIC(6,3),
  has_measurement_cert BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alta / Installation
CREATE TABLE public.wo_detail_alta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  access_type     TEXT,                     -- tipo de acceso
  equipment_installed TEXT,
  client_signature BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NT Installation
CREATE TABLE public.wo_detail_nt (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  nt_type         TEXT,
  serial_number   TEXT,
  location        TEXT,
  configuration   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patchkabel
CREATE TABLE public.wo_detail_patchkabel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  connected_section TEXT,
  cable_length    NUMERIC(8,2),
  connector_type  TEXT,
  test_result     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 6. WORK ORDER PHOTOS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.work_order_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,             -- path in Supabase Storage
  photo_type      TEXT NOT NULL CHECK (photo_type IN ('before', 'during', 'after')),
  caption         TEXT,
  uploaded_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_wo ON public.work_order_photos (work_order_id);

-- ────────────────────────────────────────────────────────────
-- 7. WORK ORDER STATE HISTORY (audit trail)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.work_order_state_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  from_status     public.work_order_status,
  to_status       public.work_order_status NOT NULL,
  changed_by      UUID NOT NULL REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_history_wo ON public.work_order_state_history (work_order_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 8. MATERIAL CATALOG (base for Sprint 4+)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL CHECK (unit IN ('m', 'ud', 'rollo', 'caja')),
  min_stock       INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 9. UPDATED_AT TRIGGER FUNCTION
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 10. AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_soplado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_fusion_ap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_fusion_dp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_alta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_nt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_detail_patchkabel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── PROFILES ──

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Admins can insert profiles (for creating technicians/contractors)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

-- Admins can update any profile
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() = 'admin');

-- Users can update their own profile (limited)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ── WORK ORDERS ──

-- Admins: full access
CREATE POLICY "Admins full access to work orders"
  ON public.work_orders FOR ALL
  USING (public.get_user_role() = 'admin');

-- Technicians: read assigned orders
CREATE POLICY "Technicians can view assigned orders"
  ON public.work_orders FOR SELECT
  USING (
    public.get_user_role() = 'technician'
    AND assigned_technician = auth.uid()
  );

-- Technicians: update assigned orders (for status changes)
CREATE POLICY "Technicians can update assigned orders"
  ON public.work_orders FOR UPDATE
  USING (
    public.get_user_role() = 'technician'
    AND assigned_technician = auth.uid()
  );

-- Contractors: read assigned orders
CREATE POLICY "Contractors can view assigned orders"
  ON public.work_orders FOR SELECT
  USING (
    public.get_user_role() = 'contractor'
    AND assigned_technician = auth.uid()
  );

-- ── LOOKUP TABLES (read-only for all authenticated) ──

CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage clients"
  ON public.clients FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated users can read projects"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage projects"
  ON public.projects FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated users can read operators"
  ON public.operators FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage operators"
  ON public.operators FOR ALL
  USING (public.get_user_role() = 'admin');

-- ── WORK TYPE DETAILS (follow parent work_order access) ──

CREATE POLICY "Admins full access to soplado details"
  ON public.wo_detail_soplado FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order soplado details"
  ON public.wo_detail_soplado FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Admins full access to fusion_ap details"
  ON public.wo_detail_fusion_ap FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order fusion_ap details"
  ON public.wo_detail_fusion_ap FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Admins full access to fusion_dp details"
  ON public.wo_detail_fusion_dp FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order fusion_dp details"
  ON public.wo_detail_fusion_dp FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Admins full access to alta details"
  ON public.wo_detail_alta FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order alta details"
  ON public.wo_detail_alta FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Admins full access to nt details"
  ON public.wo_detail_nt FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order nt details"
  ON public.wo_detail_nt FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Admins full access to patchkabel details"
  ON public.wo_detail_patchkabel FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view own order patchkabel details"
  ON public.wo_detail_patchkabel FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

-- ── PHOTOS ──

CREATE POLICY "Admins full access to photos"
  ON public.work_order_photos FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view photos of assigned orders"
  ON public.work_order_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

CREATE POLICY "Technicians can upload photos to assigned orders"
  ON public.work_order_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
    )
  );

-- ── STATE HISTORY ──

CREATE POLICY "Admins full access to state history"
  ON public.work_order_state_history FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view state history of assigned orders"
  ON public.work_order_state_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

-- ── MATERIALS ──

CREATE POLICY "Authenticated users can read materials"
  ON public.materials FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage materials"
  ON public.materials FOR ALL
  USING (public.get_user_role() = 'admin');

-- ────────────────────────────────────────────────────────────
-- 12. SEED DATA
-- ────────────────────────────────────────────────────────────

-- Clients
INSERT INTO public.clients (name, code) VALUES
  ('Insyte Deutschland', 'INSYTE'),
  ('Vancom IT', 'VANCOM');

-- Projects
INSERT INTO public.projects (code, name, client_id) VALUES
  ('HXT', 'Projekt HXT', (SELECT id FROM public.clients WHERE code = 'INSYTE')),
  ('RSD', 'Projekt RSD', (SELECT id FROM public.clients WHERE code = 'INSYTE')),
  ('WCB', 'Projekt WCB', (SELECT id FROM public.clients WHERE code = 'VANCOM')),
  ('QFF', 'Projekt QFF', (SELECT id FROM public.clients WHERE code = 'VANCOM')),
  ('WRZ', 'Projekt WRZ', (SELECT id FROM public.clients WHERE code = 'INSYTE')),
  ('EHR', 'Projekt EHR', (SELECT id FROM public.clients WHERE code = 'VANCOM'));

-- Operators
INSERT INTO public.operators (code, name) VALUES
  ('DGF', 'DGF'),
  ('GFP', 'GFP'),
  ('UGG', 'UGG');

-- ────────────────────────────────────────────────────────────
-- 13. STORAGE BUCKETS (run separately if buckets don't exist)
-- ────────────────────────────────────────────────────────────
-- These are created via Supabase Dashboard > Storage, or via:
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('work-order-photos', 'work-order-photos', false),
--   ('contractor-documents', 'contractor-documents', false),
--   ('certification-pdfs', 'certification-pdfs', false),
--   ('payroll-pdfs', 'payroll-pdfs', false);

-- ────────────────────────────────────────────────────────────
-- DONE. Schema ready for Sprint 2.
-- ────────────────────────────────────────────────────────────
