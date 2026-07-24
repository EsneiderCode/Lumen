-- 049_compliance_document_templates.sql
--
-- Depends on: 048_compliance_notifications.sql
--
-- Blank official templates (Merkblätter, forms) that third parties download and
-- fill in. Stored under  compliance-documents/templates/<code>/<file>  and
-- pointed to by document_types.template_storage_path (added in 042).
--
-- These are non-sensitive public forms, so ANY authenticated user may read them
-- (contractors have no compliance.view and do not "own" the templates folder, so
-- the existing document read policy would reject them). Only matrix
-- configurators (compliance.configure_matrix) may upload / replace / delete.
--
-- Storage policies only — no table changes, so database.types.ts is unaffected.

-- Read: everyone logged in (blank forms are public to the workforce).
DROP POLICY IF EXISTS "storage_compliance_templates_read" ON storage.objects;
CREATE POLICY "storage_compliance_templates_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'compliance-documents'
    AND (storage.foldername(name))[1] = 'templates'
  );

-- Insert: matrix configurators only.
DROP POLICY IF EXISTS "storage_compliance_templates_insert" ON storage.objects;
CREATE POLICY "storage_compliance_templates_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_permission('compliance.configure_matrix')
  );

-- Update: needed for upsert-on-replace.
DROP POLICY IF EXISTS "storage_compliance_templates_update" ON storage.objects;
CREATE POLICY "storage_compliance_templates_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'compliance-documents'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_permission('compliance.configure_matrix')
  )
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_permission('compliance.configure_matrix')
  );

-- Delete: matrix configurators only.
DROP POLICY IF EXISTS "storage_compliance_templates_delete" ON storage.objects;
CREATE POLICY "storage_compliance_templates_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'compliance-documents'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_permission('compliance.configure_matrix')
  );
