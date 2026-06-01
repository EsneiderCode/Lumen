-- LUMEN — Migration 020: add 'pop' to work_type enum + work_order_documents table
-- Depends on: 019_employees_and_vacations.sql
--
-- 1. Adds the missing 'pop' value to the work_type enum (migration 007 added the
--    wo_detail_pop table but forgot to extend the enum itself).
-- 2. Creates work_order_documents for supplementary file attachments (planos,
--    cartas de empalme, routing diagrams, etc.).

-- ─── 1. Extend work_type enum ────────────────────────────────────────────────
ALTER TYPE public.work_type ADD VALUE IF NOT EXISTS 'pop';

-- ─── 2. document_type enum ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.document_type AS ENUM (
      'plano',
      'cartas_empalme',
      'diagrama_routing',
      'other'
    );
  END IF;
END
$$;

-- ─── 3. work_order_documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_order_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  document_type   public.document_type NOT NULL,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  mime_type       TEXT,
  size_bytes      INTEGER,
  uploaded_by     UUID NOT NULL REFERENCES public.profiles (id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_order_documents_work_order
  ON public.work_order_documents (work_order_id);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.work_order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_work_order_documents"
  ON public.work_order_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "tech_read_work_order_documents"
  ON public.work_order_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND (
          wo.assigned_technician = auth.uid()
          OR wo.assigned_team IN (
            SELECT team FROM public.profiles WHERE id = auth.uid()
          )
        )
    )
  );

COMMENT ON TABLE public.work_order_documents IS
  'Supplementary files (planos, cartas de empalme, routing diagrams) attached to a work order. Storage bucket: work-order-documents.';
