-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 039 — work-order-documents storage bucket
-- Depends on: 038_user_telegram_groups.sql
-- Purpose:
--   Migration 020 created the work_order_documents table and referenced the
--   'work-order-documents' storage bucket in a comment, but no migration ever
--   created the bucket itself (011 did it for 'contractor-documents'). Every
--   upload from the work order form fails with "Bucket not found".
--   Create the private bucket and its storage.objects policies, mirroring the
--   table RLS: permission-based access for office users (035) plus read access
--   for the assigned technician / team (020's tech_read policy).
--   Files live under: work-order-documents/<work_order_id>/<timestamp>-<file>
-- ─────────────────────────────────────────────────────────────────────────────

-- Bucket ----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-documents', 'work-order-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Policies --------------------------------------------------------------------

DROP POLICY IF EXISTS "storage_wo_docs_read" ON storage.objects;
CREATE POLICY "storage_wo_docs_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-documents'
    AND (
      public.has_permission('work_orders.view')
      OR EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.id::text = (storage.foldername(name))[1]
          AND (
            wo.assigned_technician = auth.uid()
            OR wo.assigned_team IN (
              SELECT team FROM public.profiles WHERE id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "storage_wo_docs_insert" ON storage.objects;
CREATE POLICY "storage_wo_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-documents'
    AND public.has_permission('work_orders.manage_documents')
  );

DROP POLICY IF EXISTS "storage_wo_docs_delete" ON storage.objects;
CREATE POLICY "storage_wo_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-documents'
    AND public.has_permission('work_orders.manage_documents')
  );
