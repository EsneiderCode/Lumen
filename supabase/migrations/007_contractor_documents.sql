-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Contractor documents + external payment certification gate
-- Depends on: 001_initial_schema.sql, 005_billing_direct_orders.sql
-- Purpose:
--   - Track required contractor compliance documents.
--   - Allow admin/contractor uploads with admin approval.
--   - Block external collaborator certification until all required documents
--     are approved and not expired.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contractor_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL CHECK (document_type IN (
    'gewerbeanmeldung',
    'haftpflichtversicherung',
    'unbedenklichkeit_finanzamt',
    'unbedenklichkeit_sozialkasse',
    'id_passport',
    'subcontractor_agreement'
  )),
  status            TEXT NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  file_name         TEXT NOT NULL,
  storage_path      TEXT NOT NULL UNIQUE,
  mime_type         TEXT,
  size_bytes        BIGINT,
  issued_at         DATE,
  expires_at        DATE,
  uploaded_by       UUID NOT NULL REFERENCES public.profiles(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by       UUID REFERENCES public.profiles(id),
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_documents_contractor
  ON public.contractor_documents (contractor_id);

CREATE INDEX IF NOT EXISTS idx_contractor_documents_type_latest
  ON public.contractor_documents (contractor_id, document_type, uploaded_at DESC);

DROP TRIGGER IF EXISTS handle_contractor_documents_updated_at ON public.contractor_documents;
CREATE TRIGGER handle_contractor_documents_updated_at
  BEFORE UPDATE ON public.contractor_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_docs_admin_all" ON public.contractor_documents;
CREATE POLICY "contractor_docs_admin_all" ON public.contractor_documents
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "contractor_docs_own_select" ON public.contractor_documents;
CREATE POLICY "contractor_docs_own_select" ON public.contractor_documents
  FOR SELECT TO authenticated
  USING (contractor_id = auth.uid());

DROP POLICY IF EXISTS "contractor_docs_own_insert" ON public.contractor_documents;
CREATE POLICY "contractor_docs_own_insert" ON public.contractor_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    contractor_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND status = 'pending_review'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- Storage bucket and policies. Files live under:
--   contractor-documents/<contractor_id>/<document_type>/<file>
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-documents', 'contractor-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage_contractor_docs_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_contractor_docs_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_contractor_docs_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_contractor_docs_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_contractor_docs_owner_insert" ON storage.objects;

CREATE POLICY "storage_contractor_docs_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND (
      public.get_user_role() = 'admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "storage_contractor_docs_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contractor-documents'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "storage_contractor_docs_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contractor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_contractor_docs_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contractor-documents'
    AND public.get_user_role() = 'admin'
  );

CREATE OR REPLACE FUNCTION public.contractor_required_document_types()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'gewerbeanmeldung',
    'haftpflichtversicherung',
    'unbedenklichkeit_finanzamt',
    'unbedenklichkeit_sozialkasse',
    'id_passport',
    'subcontractor_agreement'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.contractor_documents_are_valid(p_contractor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  WITH required AS (
    SELECT unnest(public.contractor_required_document_types()) AS document_type
  ),
  latest_valid AS (
    SELECT DISTINCT ON (document_type)
      document_type
    FROM public.contractor_documents
    WHERE contractor_id = p_contractor_id
      AND status = 'approved'
      AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
    ORDER BY document_type, uploaded_at DESC
  )
  SELECT NOT EXISTS (
    SELECT 1
    FROM required r
    LEFT JOIN latest_valid v USING (document_type)
    WHERE v.document_type IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.block_external_cert_without_valid_docs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  assignee UUID;
  assignee_role public.user_role;
BEGIN
  IF NEW.cert_type <> 'external' THEN
    RETURN NEW;
  END IF;

  SELECT wo.assigned_technician, p.role
    INTO assignee, assignee_role
  FROM public.work_orders wo
  LEFT JOIN public.profiles p ON p.id = wo.assigned_technician
  WHERE wo.id = NEW.work_order_id;

  IF assignee IS NULL OR assignee_role <> 'contractor' THEN
    RAISE EXCEPTION 'External certification requires a contractor assignee'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.contractor_documents_are_valid(assignee) THEN
    RAISE EXCEPTION 'External certification blocked: contractor documents are incomplete, unapproved, or expired'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_external_cert_documents ON public.certification_audits;
CREATE TRIGGER enforce_external_cert_documents
  BEFORE INSERT ON public.certification_audits
  FOR EACH ROW EXECUTE FUNCTION public.block_external_cert_without_valid_docs();
