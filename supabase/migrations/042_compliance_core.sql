-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 042 — Compliance module core (document matrix engine, entities,
--                 versioned documents, reviews, project assignments)
-- Depends on: 019_employees_and_vacations.sql, 035_rbac_policy_migration.sql,
--             041_work_order_telegram_groups.sql
-- Purpose:
--   Foundation of the personnel document-management module:
--     - document_types         : configurable document catalog (i18n names)
--     - document_requirements  : the requirement matrix (who/where/when/how)
--     - compliance_entities    : unified anchor for companies, their workers,
--                                freelancers and internal employees
--     - entity_documents       : materialized checklist items per entity
--     - document_versions      : full upload history (audit/inspection)
--     - document_reviews       : approve/reject audit trail
--     - document_access_log    : GDPR access log for sensitive files
--     - project_assignments    : entity ↔ obra with dates (aptitude scope)
--   Plus: `compliance.*` permissions, `compliance-documents` storage bucket,
--   and auto-mirroring of internal employees into compliance_entities.
--
--   The requirement matrix is SEEDED in 044_compliance_seed_matrix.sql and the
--   aptitude engine lives in 043_compliance_aptitude.sql. Legacy contractor
--   data is migrated in 045_compliance_legacy_migration.sql.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE public.compliance_entity_kind AS ENUM
  ('company', 'company_worker', 'freelancer', 'internal_employee');

CREATE TYPE public.requirement_origin AS ENUM
  ('DE', 'ES', 'EU_OTHER', 'NON_EU', 'ALL');

CREATE TYPE public.requirement_scope AS ENUM ('entity', 'per_project');

CREATE TYPE public.document_validity_rule AS ENUM
  ('expiry_required', 'days_from_issue', 'must_cover_assignment', 'no_expiry');

CREATE TYPE public.entity_document_status AS ENUM
  ('pending', 'in_review', 'approved', 'rejected', 'expiring', 'expired', 'not_applicable');

CREATE TYPE public.compliance_assignment_status AS ENUM
  ('draft', 'confirmed', 'ended', 'cancelled');

-- 2) Document catalog ─────────────────────────────────────────────────────────

CREATE TABLE public.document_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  -- {"es": "...", "de": "...", "en": "..."}
  name_i18n             JSONB NOT NULL,
  description_i18n      JSONB,
  -- Extra metadata fields the upload form must ask for, e.g.
  -- [{"key":"reference_number","type":"text"},{"key":"amount","type":"number"}]
  metadata_schema       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Official template the third party must download and fill in (optional).
  template_storage_path TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Requirement matrix ───────────────────────────────────────────────────────
-- One row = "entities of kind X from origin Y must provide document Z
-- (entity-wide or per obra) under these validity rules".
-- `conditions` uses JSONB containment against compliance_entities.attributes:
-- the requirement applies iff conditions <@ attributes.

CREATE TABLE public.document_requirements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id   UUID NOT NULL REFERENCES public.document_types(id),
  applies_to         public.compliance_entity_kind NOT NULL,
  origin             public.requirement_origin NOT NULL DEFAULT 'ALL',
  scope              public.requirement_scope NOT NULL DEFAULT 'entity',
  is_mandatory       BOOLEAN NOT NULL DEFAULT true,
  conditions         JSONB NOT NULL DEFAULT '{}'::jsonb,
  validity_rule      public.document_validity_rule NOT NULL,
  validity_days      INTEGER,           -- for days_from_issue
  min_amount         NUMERIC(12, 2),    -- e.g. RC insurance >= 200000
  min_amount_currency TEXT NOT NULL DEFAULT 'EUR',
  -- Reviewer must explicitly confirm "coverage includes Germany".
  requires_coverage_confirmation BOOLEAN NOT NULL DEFAULT false,
  notify_days        INTEGER[] NOT NULL DEFAULT '{30,15,7}',
  -- Side effect when the doc is missing/unapproved, e.g. the §48b EStG case:
  -- 'notify_billing_withholding' → billing must withhold 15% Bauabzugsteuer.
  on_missing_action  TEXT,
  notes              TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT requirement_validity_days_needed
    CHECK (validity_rule <> 'days_from_issue' OR validity_days IS NOT NULL)
);

CREATE INDEX idx_doc_requirements_lookup
  ON public.document_requirements (applies_to, origin) WHERE is_active;

-- 4) Compliance entities ──────────────────────────────────────────────────────
-- Unified anchor: subcontractor companies, each of their posted workers,
-- freelancers (autónomos) and internal employees.

CREATE TABLE public.compliance_entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                public.compliance_entity_kind NOT NULL,
  -- company_worker → its company
  parent_entity_id    UUID REFERENCES public.compliance_entities(id) ON DELETE CASCADE,
  -- portal login for companies/freelancers (profiles.role = 'contractor')
  profile_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- internal_employee → employees row (documents managed by Administration)
  employee_id         UUID UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL,
  -- ISO 3166-1 alpha-2, country of establishment → requirement origin bucket
  country_code        TEXT NOT NULL DEFAULT 'DE',
  -- Worker nationality can differ from the company country (Vander Elst).
  nationality_country TEXT,
  -- Evaluable flags for requirement conditions:
  -- {"hires_workers": bool, "regulated_trade": bool, "short_stay": bool,
  --  "non_eu_national": bool, ...}  (service layer keeps non_eu_national in
  -- sync with nationality_country)
  attributes          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {"ust_id": "...", "tax_number_de": "...", "nif": "...", "id_number": "..."}
  legal_ids           JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_email       TEXT,
  contact_phone       TEXT,
  address             TEXT,
  -- Informative anti-Scheinselbstständigkeit checklist (freelancers, §11).
  scheinselbst_check  JSONB,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_worker_has_parent
    CHECK ((kind = 'company_worker') = (parent_entity_id IS NOT NULL)),
  CONSTRAINT entity_internal_has_employee
    CHECK ((kind = 'internal_employee') = (employee_id IS NOT NULL)),
  CONSTRAINT entity_login_only_for_top_level
    CHECK (kind IN ('company', 'freelancer') OR profile_id IS NULL)
);

CREATE UNIQUE INDEX idx_compliance_entities_profile
  ON public.compliance_entities (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_compliance_entities_parent
  ON public.compliance_entities (parent_entity_id) WHERE parent_entity_id IS NOT NULL;
CREATE INDEX idx_compliance_entities_kind ON public.compliance_entities (kind);

-- 5) Checklist items + versioned documents ────────────────────────────────────

CREATE TABLE public.entity_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          UUID NOT NULL REFERENCES public.compliance_entities(id) ON DELETE CASCADE,
  -- NULL = ad-hoc / legacy document not generated by the matrix. Matrix-driven
  -- items always reference their requirement.
  requirement_id     UUID REFERENCES public.document_requirements(id),
  document_type_id   UUID NOT NULL REFERENCES public.document_types(id),
  -- Set only for per_project requirements.
  project_id         UUID REFERENCES public.projects(id),
  status             public.entity_document_status NOT NULL DEFAULT 'pending',
  current_version_id UUID,  -- FK added below (circular)
  -- Reviewer-confirmed metadata — the ONLY values validations trust.
  approved_issued_at  DATE,
  approved_expires_at DATE,
  approved_amount     NUMERIC(12, 2),
  approved_metadata   JSONB,
  coverage_confirmed  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One checklist item per (entity, requirement, obra). uuid_nil() collapses the
-- entity-scope case (project_id NULL) into a single slot.
CREATE UNIQUE INDEX idx_entity_documents_unique_slot
  ON public.entity_documents (
    entity_id, requirement_id,
    COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE requirement_id IS NOT NULL;

CREATE INDEX idx_entity_documents_entity  ON public.entity_documents (entity_id);
CREATE INDEX idx_entity_documents_status  ON public.entity_documents (status);
CREATE INDEX idx_entity_documents_project ON public.entity_documents (project_id)
  WHERE project_id IS NOT NULL;

CREATE TABLE public.document_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_document_id UUID NOT NULL REFERENCES public.entity_documents(id) ON DELETE CASCADE,
  version_number     INTEGER NOT NULL,
  storage_bucket     TEXT NOT NULL DEFAULT 'compliance-documents',
  storage_path       TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  mime_type          TEXT,
  size_bytes         BIGINT,
  -- Metadata as entered by the uploader (issued_at, expires_at, amount,
  -- reference_number, + fields from document_types.metadata_schema).
  submitted_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by        UUID NOT NULL REFERENCES public.profiles(id),
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_document_id, version_number),
  UNIQUE (storage_bucket, storage_path)
);

ALTER TABLE public.entity_documents
  ADD CONSTRAINT entity_documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id)
  ON DELETE SET NULL;

CREATE TABLE public.document_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  action            TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  reviewer_id       UUID NOT NULL REFERENCES public.profiles(id),
  -- Typified causes: ilegible | caducado | importe_insuficiente |
  -- no_cubre_alemania | formato_incorrecto | fechas_no_cubren_obra | otro
  rejection_reasons TEXT[],
  rejection_text    TEXT,
  -- Metadata as confirmed/corrected by the reviewer at approval time.
  approved_metadata JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_rejection_needs_text
    CHECK (action <> 'rejected'
           OR (rejection_text IS NOT NULL AND btrim(rejection_text) <> ''))
);

CREATE INDEX idx_document_reviews_version ON public.document_reviews (version_id);

-- GDPR: every view/download of a stored document is logged.
CREATE TABLE public.document_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL REFERENCES public.profiles(id),
  action      TEXT NOT NULL CHECK (action IN ('view', 'download')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_access_log_version ON public.document_access_log (version_id);

-- 6) Project assignments (obra ↔ entity, with dates) ──────────────────────────

CREATE TABLE public.project_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID NOT NULL REFERENCES public.compliance_entities(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES public.projects(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          public.compliance_assignment_status NOT NULL DEFAULT 'draft',
  -- Administration may force-confirm a NO-APTO entity; audited.
  override        BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  override_by     UUID REFERENCES public.profiles(id),
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_dates_order CHECK (end_date >= start_date),
  CONSTRAINT assignment_override_justified
    CHECK (NOT override OR (override_reason IS NOT NULL AND override_by IS NOT NULL))
);

CREATE INDEX idx_project_assignments_entity  ON public.project_assignments (entity_id);
CREATE INDEX idx_project_assignments_project ON public.project_assignments (project_id);

-- 7) updated_at triggers ──────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.compliance_entities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.entity_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8) Ownership helper for RLS ─────────────────────────────────────────────────
-- A contractor profile owns its own entity and its company's workers.

CREATE OR REPLACE FUNCTION public.owns_compliance_entity(p_entity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.compliance_entities e
    LEFT JOIN public.compliance_entities parent ON parent.id = e.parent_entity_id
    WHERE e.id = p_entity_id
      AND (e.profile_id = auth.uid() OR parent.profile_id = auth.uid())
  );
$$;

-- 9) Permissions (compliance module) ──────────────────────────────────────────
-- Must stay in sync with src/config/permissions.ts (MODULE_REGISTRY).

INSERT INTO public.permissions (module, action, description) VALUES
  ('compliance', 'view',                'View all compliance entities and documents'),
  ('compliance', 'review',              'Approve/reject uploaded documents'),
  ('compliance', 'configure_matrix',    'Edit document catalog and requirement matrix'),
  ('compliance', 'manage_entities',     'Create/edit compliance entities and workers'),
  ('compliance', 'assign',              'Manage project assignments'),
  ('compliance', 'override_assignment', 'Force-confirm assignments of non-apt entities'),
  ('compliance', 'view_project_board',  'View per-project aptitude board (site manager)'),
  ('compliance', 'export_dossier',      'Generate inspection dossiers and exports')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.module = 'compliance'
WHERE r.name = 'admin' AND r.is_system
ON CONFLICT DO NOTHING;

-- 10) RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.document_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_entities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments  ENABLE ROW LEVEL SECURITY;

-- Catalog + matrix: readable by everyone logged in (needed to render
-- checklists); writable only by matrix configurators.
CREATE POLICY "document_types_select" ON public.document_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_types_write" ON public.document_types
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.configure_matrix'))
  WITH CHECK (public.has_permission('compliance.configure_matrix'));

CREATE POLICY "document_requirements_select" ON public.document_requirements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_requirements_write" ON public.document_requirements
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.configure_matrix'))
  WITH CHECK (public.has_permission('compliance.configure_matrix'));

-- Entities: admins with manage_entities do everything; viewers read; owners
-- read their own tree, update their own data and register their workers.
CREATE POLICY "compliance_entities_admin_all" ON public.compliance_entities
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.manage_entities'))
  WITH CHECK (public.has_permission('compliance.manage_entities'));
CREATE POLICY "compliance_entities_view_perm" ON public.compliance_entities
  FOR SELECT TO authenticated
  USING (public.has_permission('compliance.view'));
CREATE POLICY "compliance_entities_own_select" ON public.compliance_entities
  FOR SELECT TO authenticated
  USING (public.owns_compliance_entity(id));
CREATE POLICY "compliance_entities_own_update" ON public.compliance_entities
  FOR UPDATE TO authenticated
  USING (public.owns_compliance_entity(id))
  WITH CHECK (public.owns_compliance_entity(id));
CREATE POLICY "compliance_entities_own_worker_insert" ON public.compliance_entities
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'company_worker'
    AND parent_entity_id IS NOT NULL
    AND public.owns_compliance_entity(parent_entity_id)
  );

-- Checklist items: owners may create pending items (checklist generation) and
-- move them to in_review on upload — never approve themselves.
CREATE POLICY "entity_documents_admin_all" ON public.entity_documents
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.review'))
  WITH CHECK (public.has_permission('compliance.review'));
CREATE POLICY "entity_documents_view_perm" ON public.entity_documents
  FOR SELECT TO authenticated
  USING (public.has_permission('compliance.view'));
CREATE POLICY "entity_documents_own_select" ON public.entity_documents
  FOR SELECT TO authenticated
  USING (public.owns_compliance_entity(entity_id));
CREATE POLICY "entity_documents_own_insert" ON public.entity_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_compliance_entity(entity_id)
    AND status = 'pending'
    AND current_version_id IS NULL
  );
CREATE POLICY "entity_documents_own_update" ON public.entity_documents
  FOR UPDATE TO authenticated
  USING (public.owns_compliance_entity(entity_id))
  WITH CHECK (
    public.owns_compliance_entity(entity_id)
    AND status IN ('pending', 'in_review')
  );

-- Versions: append-only; owners and reviewers.
CREATE POLICY "document_versions_admin_all" ON public.document_versions
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.review'))
  WITH CHECK (public.has_permission('compliance.review'));
CREATE POLICY "document_versions_view_perm" ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.has_permission('compliance.view'));
CREATE POLICY "document_versions_own_select" ON public.document_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entity_documents ed
    WHERE ed.id = entity_document_id AND public.owns_compliance_entity(ed.entity_id)
  ));
CREATE POLICY "document_versions_own_insert" ON public.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.entity_documents ed
      WHERE ed.id = entity_document_id AND public.owns_compliance_entity(ed.entity_id)
    )
  );

-- Reviews: only reviewers write; owners may read them (rejection reasons).
CREATE POLICY "document_reviews_admin_all" ON public.document_reviews
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.review'))
  WITH CHECK (
    public.has_permission('compliance.review') AND reviewer_id = auth.uid()
  );
CREATE POLICY "document_reviews_view_perm" ON public.document_reviews
  FOR SELECT TO authenticated
  USING (public.has_permission('compliance.view'));
CREATE POLICY "document_reviews_own_select" ON public.document_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.document_versions dv
    JOIN public.entity_documents ed ON ed.id = dv.entity_document_id
    WHERE dv.id = version_id AND public.owns_compliance_entity(ed.entity_id)
  ));

-- Access log: anyone logs their own access; only reviewers read the log.
CREATE POLICY "document_access_log_insert_own" ON public.document_access_log
  FOR INSERT TO authenticated
  WITH CHECK (accessed_by = auth.uid());
CREATE POLICY "document_access_log_select_perm" ON public.document_access_log
  FOR SELECT TO authenticated
  USING (public.has_permission('compliance.review'));

-- Assignments: managed by Administration; owners and board viewers read.
CREATE POLICY "project_assignments_admin_all" ON public.project_assignments
  FOR ALL TO authenticated
  USING (public.has_permission('compliance.assign'))
  WITH CHECK (public.has_permission('compliance.assign'));
CREATE POLICY "project_assignments_board_select" ON public.project_assignments
  FOR SELECT TO authenticated
  USING (
    public.has_permission('compliance.view_project_board')
    OR public.has_permission('compliance.view')
  );
CREATE POLICY "project_assignments_own_select" ON public.project_assignments
  FOR SELECT TO authenticated
  USING (public.owns_compliance_entity(entity_id));

-- 11) Storage bucket ──────────────────────────────────────────────────────────
-- Files live under: compliance-documents/<entity_id>/<document_type_code>/<file>

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Text-safe variant for storage policies: folder names that are not valid
-- UUIDs must yield false, never a cast error.
CREATE OR REPLACE FUNCTION public.owns_compliance_entity_path(p_folder TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.owns_compliance_entity(p_folder::uuid);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "storage_compliance_docs_read" ON storage.objects;
CREATE POLICY "storage_compliance_docs_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'compliance-documents'
    AND (
      public.has_permission('compliance.view')
      OR public.owns_compliance_entity_path((storage.foldername(name))[1])
    )
  );

DROP POLICY IF EXISTS "storage_compliance_docs_insert" ON storage.objects;
CREATE POLICY "storage_compliance_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND (
      public.has_permission('compliance.review')
      OR public.owns_compliance_entity_path((storage.foldername(name))[1])
    )
  );

DROP POLICY IF EXISTS "storage_compliance_docs_delete" ON storage.objects;
CREATE POLICY "storage_compliance_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'compliance-documents'
    AND public.has_permission('compliance.review')
  );

-- 12) Internal employees auto-mirror ──────────────────────────────────────────
-- Every employees row gets (and keeps) a compliance_entities twin so internal
-- staff share the same checklist/expiry/aptitude machinery. No external
-- review flow: Administration uploads and approves in one step (service layer).

CREATE OR REPLACE FUNCTION public.sync_employee_compliance_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.compliance_entities
    (kind, employee_id, display_name, country_code, contact_email, contact_phone, is_active)
  VALUES
    ('internal_employee', NEW.id, NEW.full_name, 'DE', NEW.email, NEW.phone, NEW.is_active)
  ON CONFLICT (employee_id) DO UPDATE SET
    display_name  = EXCLUDED.display_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    is_active     = EXCLUDED.is_active;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_sync_compliance_entity ON public.employees;
CREATE TRIGGER employees_sync_compliance_entity
  AFTER INSERT OR UPDATE OF full_name, email, phone, is_active ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_compliance_entity();

-- Backfill existing employees.
INSERT INTO public.compliance_entities
  (kind, employee_id, display_name, country_code, contact_email, contact_phone, is_active)
SELECT 'internal_employee', e.id, e.full_name, 'DE', e.email, e.phone, e.is_active
FROM public.employees e
ON CONFLICT (employee_id) DO NOTHING;
