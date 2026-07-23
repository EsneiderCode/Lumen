-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 045 — Migrate legacy contractor data + rewire external cert gate
-- Depends on: 044_compliance_seed_matrix.sql
-- Purpose:
--   1) Every profiles.role='contractor' becomes a compliance_entities row
--      ('company' if the onboarding record names a company or lists A1 workers,
--      otherwise 'freelancer'; country defaults to ES — the legacy checklist
--      was the Spanish UMTELKOMD one; correct per entity in the UI if needed).
--   2) subcontractor_onboarding.a1_workers JSONB → first-class company_worker
--      entities.
--   3) contractor_documents rows → entity_documents + document_versions (full
--      history preserved) + document_reviews (approval/rejection audit).
--      Files stay in the old 'contractor-documents' bucket (document_versions
--      records the bucket per version — nothing to move in Storage).
--   4) block_external_cert_without_valid_docs() now checks the NEW aptitude
--      engine (per work-order project), with the legacy check kept as a
--      TRANSITIONAL fallback so the old contractor UI keeps working until the
--      new portal ships. A later migration removes the fallback.
--
-- ⚠ BEHAVIORAL NOTE — per-project requirements:
--   Zoll/Meldeportal and MiLoG are per-obra in the new matrix. Legacy uploads
--   were entity-wide, so they are preserved as historical documents but do NOT
--   satisfy the per-obra slots: each obra needs its own notification going
--   forward. During the transition the legacy fallback (all 10 old documents
--   approved & valid) still unblocks external certification.
--
-- Legacy tables contractor_documents and subcontractor_onboarding are now
-- DEPRECATED: kept read/write for the current UI, retired after the new
-- portal replaces it.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Contractor profiles → compliance entities ────────────────────────────────

INSERT INTO public.compliance_entities
  (kind, profile_id, display_name, country_code, legal_ids,
   contact_email, contact_phone, address, is_active)
SELECT
  CASE
    WHEN NULLIF(btrim(COALESCE(so.company_name, '')), '') IS NOT NULL
      OR jsonb_array_length(COALESCE(so.a1_workers, '[]'::jsonb)) > 0
    THEN 'company'::public.compliance_entity_kind
    ELSE 'freelancer'::public.compliance_entity_kind
  END,
  p.id,
  COALESCE(NULLIF(btrim(COALESCE(so.company_name, '')), ''), p.full_name),
  'ES',
  jsonb_strip_nulls(jsonb_build_object(
    'ust_id', so.ust_id_es,
    'tax_number_de', so.tax_number_de
  )),
  COALESCE(so.contact_email, p.email),
  so.contact_phone,
  so.address,
  p.is_active
FROM public.profiles p
LEFT JOIN public.subcontractor_onboarding so ON so.contractor_id = p.id
WHERE p.role = 'contractor'
ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO NOTHING;

-- 2) A1 worker roster → company_worker entities ───────────────────────────────

INSERT INTO public.compliance_entities
  (kind, parent_entity_id, display_name, country_code, legal_ids, notes)
SELECT
  'company_worker',
  ce.id,
  btrim(w->>'name'),
  'ES',
  jsonb_strip_nulls(jsonb_build_object('id_number', w->>'id_number')),
  CASE WHEN NULLIF(w->>'a1_valid_until', '') IS NOT NULL
       THEN 'Migrado: A1 válido hasta ' || (w->>'a1_valid_until')
  END
FROM public.subcontractor_onboarding so
JOIN public.compliance_entities ce ON ce.profile_id = so.contractor_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(so.a1_workers, '[]'::jsonb)) AS w
WHERE NULLIF(btrim(COALESCE(w->>'name', '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.compliance_entities cw
    WHERE cw.parent_entity_id = ce.id
      AND cw.kind = 'company_worker'
      AND cw.display_name = btrim(w->>'name')
  );

-- 3) contractor_documents → entity_documents / versions / reviews ─────────────

-- 3a) One checklist slot per (entity, mapped type), from the LATEST legacy row.
--     Requirement lookup prefers the entity-scope ES rule for the entity kind;
--     unmatched types land as ad-hoc items (requirement_id NULL).
WITH mapping (old_code, new_code) AS (
  VALUES
    ('a1_bescheinigung',              'a1_certificate'),
    ('unbedenklichkeit_finanzamt',    'unbedenklichkeit_finanzamt'),
    ('mindestlohn_meldung_gzd',       'zoll_meldeportal_notification'),
    ('unbedenklichkeit_sozialkasse',  'soka_bau_clearance'),
    ('ust_id_reverse_charge',         'ust_id_confirmation'),
    ('gewerbeanmeldung',              'business_registration'),
    ('haftpflichtversicherung',       'rc_insurance'),
    ('id_passport',                   'id_document'),
    ('zusatzvereinbarung_mindestlohn','milog_declaration'),
    ('subcontractor_agreement',       'subcontractor_agreement')
),
latest AS (
  SELECT DISTINCT ON (ce.id, m.new_code)
    ce.id   AS entity_id,
    ce.kind AS entity_kind,
    m.new_code,
    cd.status,
    cd.issued_at,
    cd.expires_at
  FROM public.contractor_documents cd
  JOIN mapping m ON m.old_code = cd.document_type
  JOIN public.compliance_entities ce ON ce.profile_id = cd.contractor_id
  ORDER BY ce.id, m.new_code, cd.uploaded_at DESC
)
INSERT INTO public.entity_documents
  (entity_id, requirement_id, document_type_id, project_id, status,
   approved_issued_at, approved_expires_at)
SELECT
  l.entity_id,
  (
    SELECT r.id
    FROM public.document_requirements r
    JOIN public.document_types dt2 ON dt2.id = r.document_type_id
    WHERE dt2.code = l.new_code
      AND r.applies_to = l.entity_kind
      AND r.origin = 'ES'
      AND r.conditions = '{}'::jsonb
    ORDER BY r.scope  -- 'entity' before 'per_project'
    LIMIT 1
  ),
  dt.id,
  NULL,
  CASE l.status
    WHEN 'approved' THEN 'approved'::public.entity_document_status
    WHEN 'rejected' THEN 'rejected'::public.entity_document_status
    ELSE 'in_review'::public.entity_document_status
  END,
  CASE WHEN l.status = 'approved' THEN l.issued_at END,
  CASE WHEN l.status = 'approved' THEN l.expires_at END
FROM latest l
JOIN public.document_types dt ON dt.code = l.new_code;

-- 3b) Every legacy row becomes a version (history preserved, oldest = v1).
WITH mapping (old_code, new_code) AS (
  VALUES
    ('a1_bescheinigung',              'a1_certificate'),
    ('unbedenklichkeit_finanzamt',    'unbedenklichkeit_finanzamt'),
    ('mindestlohn_meldung_gzd',       'zoll_meldeportal_notification'),
    ('unbedenklichkeit_sozialkasse',  'soka_bau_clearance'),
    ('ust_id_reverse_charge',         'ust_id_confirmation'),
    ('gewerbeanmeldung',              'business_registration'),
    ('haftpflichtversicherung',       'rc_insurance'),
    ('id_passport',                   'id_document'),
    ('zusatzvereinbarung_mindestlohn','milog_declaration'),
    ('subcontractor_agreement',       'subcontractor_agreement')
)
INSERT INTO public.document_versions
  (entity_document_id, version_number, storage_bucket, storage_path,
   file_name, mime_type, size_bytes, submitted_metadata, uploaded_by, uploaded_at)
SELECT
  ed.id,
  row_number() OVER (PARTITION BY ed.id ORDER BY cd.uploaded_at),
  'contractor-documents',
  cd.storage_path,
  cd.file_name,
  cd.mime_type,
  cd.size_bytes,
  jsonb_strip_nulls(jsonb_build_object(
    'issued_at', cd.issued_at, 'expires_at', cd.expires_at
  )),
  cd.uploaded_by,
  cd.uploaded_at
FROM public.contractor_documents cd
JOIN mapping m ON m.old_code = cd.document_type
JOIN public.compliance_entities ce ON ce.profile_id = cd.contractor_id
JOIN public.document_types dt ON dt.code = m.new_code
JOIN public.entity_documents ed
  ON ed.entity_id = ce.id AND ed.document_type_id = dt.id AND ed.project_id IS NULL
ON CONFLICT (storage_bucket, storage_path) DO NOTHING;

-- 3c) Point each slot at its newest version.
UPDATE public.entity_documents ed
SET current_version_id = dv.id
FROM (
  SELECT DISTINCT ON (entity_document_id) id, entity_document_id
  FROM public.document_versions
  ORDER BY entity_document_id, version_number DESC
) dv
WHERE dv.entity_document_id = ed.id
  AND ed.current_version_id IS NULL;

-- 3d) Reviews for legacy approved/rejected rows (audit trail).
INSERT INTO public.document_reviews
  (version_id, action, reviewer_id, rejection_reasons, rejection_text,
   approved_metadata, created_at)
SELECT
  dv.id,
  cd.status,
  COALESCE(cd.reviewed_by, cd.uploaded_by),
  CASE WHEN cd.status = 'rejected' THEN ARRAY['otro'] END,
  CASE WHEN cd.status = 'rejected'
       THEN COALESCE(NULLIF(btrim(COALESCE(cd.review_notes, '')), ''),
                     'Migrado del sistema anterior (motivo no registrado)')
  END,
  CASE WHEN cd.status = 'approved'
       THEN jsonb_strip_nulls(jsonb_build_object(
              'issued_at', cd.issued_at, 'expires_at', cd.expires_at))
  END,
  COALESCE(cd.reviewed_at, cd.uploaded_at)
FROM public.contractor_documents cd
JOIN public.document_versions dv
  ON dv.storage_bucket = 'contractor-documents'
 AND dv.storage_path = cd.storage_path
WHERE cd.status IN ('approved', 'rejected');

-- 4) External certification gate → new aptitude engine ────────────────────────
-- Replaces the migration 011/033 implementation in place (the trigger on
-- certification_audits stays bound to this function name). Transitional: the
-- legacy 10-document check still passes an entity while the old contractor UI
-- remains in use; remove the fallback when the new portal replaces it.

CREATE OR REPLACE FUNCTION public.block_external_cert_without_valid_docs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  assignee      UUID;
  assignee_role public.user_role;
  v_project_id  UUID;
  v_entity_id   UUID;
  v_apt         RECORD;
BEGIN
  IF NEW.cert_type <> 'external' THEN
    RETURN NEW;
  END IF;

  SELECT wo.assigned_technician, p.role, wo.project_id
    INTO assignee, assignee_role, v_project_id
  FROM public.work_orders wo
  LEFT JOIN public.profiles p ON p.id = wo.assigned_technician
  WHERE wo.id = NEW.work_order_id;

  IF assignee IS NULL OR assignee_role <> 'contractor' THEN
    RAISE EXCEPTION 'External certification requires a contractor assignee'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ce.id INTO v_entity_id
  FROM public.compliance_entities ce
  WHERE ce.profile_id = assignee;

  IF v_entity_id IS NOT NULL THEN
    SELECT * INTO v_apt
    FROM public.compute_entity_aptitude(v_entity_id, v_project_id);
    IF v_apt.level <> 'red' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Transitional fallback: legacy document set still unblocks.
  IF public.contractor_documents_are_valid(assignee) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'External certification blocked: contractor compliance documents are incomplete, unapproved, or expired'
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON TABLE public.contractor_documents IS
  'DEPRECATED: superseded by entity_documents/document_versions (migration 045). Kept until the new compliance portal replaces the contractor documents UI.';
COMMENT ON TABLE public.subcontractor_onboarding IS
  'DEPRECATED: superseded by compliance_entities (migration 045). Kept until the new compliance portal replaces the onboarding UI.';
