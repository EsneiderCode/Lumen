-- 031: Allow profile deletion by relaxing remaining FK constraints
-- Depends on: 030_profiles_fk_on_delete
--
-- Changes all RESTRICT / NO ACTION foreign keys referencing profiles(id)
-- to ON DELETE SET NULL, so admin can permanently delete a user.
-- Uses DO blocks to skip tables that may not exist yet.

-- ── work_orders.created_by ──────────────────────────────────────────────
ALTER TABLE public.work_orders
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.work_orders
  DROP CONSTRAINT work_orders_created_by_fkey,
  ADD CONSTRAINT work_orders_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── certification_audits.certified_by ────────────────────────────────────
ALTER TABLE public.certification_audits
  ALTER COLUMN certified_by DROP NOT NULL;

ALTER TABLE public.certification_audits
  DROP CONSTRAINT certification_audits_certified_by_fkey,
  ADD CONSTRAINT certification_audits_certified_by_fkey
    FOREIGN KEY (certified_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── work_order_line_items.created_by ─────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_order_line_items') THEN
    ALTER TABLE public.work_order_line_items ALTER COLUMN created_by DROP NOT NULL;
    ALTER TABLE public.work_order_line_items DROP CONSTRAINT IF EXISTS work_order_line_items_created_by_fkey;
    ALTER TABLE public.work_order_line_items
      ADD CONSTRAINT work_order_line_items_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── vacations.approved_by ───────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vacations') THEN
    ALTER TABLE public.vacations DROP CONSTRAINT IF EXISTS vacations_approved_by_fkey;
    ALTER TABLE public.vacations
      ADD CONSTRAINT vacations_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── appointments.assigned_to ────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_assigned_to_fkey;
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── contractor_documents.uploaded_by + reviewed_by ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contractor_documents') THEN
    ALTER TABLE public.contractor_documents ALTER COLUMN uploaded_by DROP NOT NULL;
    ALTER TABLE public.contractor_documents DROP CONSTRAINT IF EXISTS contractor_documents_uploaded_by_fkey;
    ALTER TABLE public.contractor_documents
      ADD CONSTRAINT contractor_documents_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.contractor_documents DROP CONSTRAINT IF EXISTS contractor_documents_reviewed_by_fkey;
    ALTER TABLE public.contractor_documents
      ADD CONSTRAINT contractor_documents_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── collaborator_cycles.collaborator_id + published_by ──────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'collaborator_cycles') THEN
    ALTER TABLE public.collaborator_cycles ALTER COLUMN collaborator_id DROP NOT NULL;
    ALTER TABLE public.collaborator_cycles DROP CONSTRAINT IF EXISTS collaborator_cycles_collaborator_id_fkey;
    ALTER TABLE public.collaborator_cycles
      ADD CONSTRAINT collaborator_cycles_collaborator_id_fkey
        FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.collaborator_cycles DROP CONSTRAINT IF EXISTS collaborator_cycles_published_by_fkey;
    ALTER TABLE public.collaborator_cycles
      ADD CONSTRAINT collaborator_cycles_published_by_fkey
        FOREIGN KEY (published_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── material_discrepancies.reported_by ──────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_discrepancies') THEN
    ALTER TABLE public.material_discrepancies ALTER COLUMN reported_by DROP NOT NULL;
    ALTER TABLE public.material_discrepancies DROP CONSTRAINT IF EXISTS material_discrepancies_reported_by_fkey;
    ALTER TABLE public.material_discrepancies
      ADD CONSTRAINT material_discrepancies_reported_by_fkey
        FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── material_transfers.created_by ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_transfers') THEN
    ALTER TABLE public.material_transfers ALTER COLUMN created_by DROP NOT NULL;
    ALTER TABLE public.material_transfers DROP CONSTRAINT IF EXISTS material_transfers_created_by_fkey;
    ALTER TABLE public.material_transfers
      ADD CONSTRAINT material_transfers_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── project_documents.uploaded_by ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_documents') THEN
    ALTER TABLE public.project_documents ALTER COLUMN uploaded_by DROP NOT NULL;
    ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_uploaded_by_fkey;
    ALTER TABLE public.project_documents
      ADD CONSTRAINT project_documents_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── employees.profile_id ────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_profile_id_fkey;
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_profile_id_fkey
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
