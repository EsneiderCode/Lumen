-- 031: Allow profile deletion by relaxing remaining FK constraints
-- Depends on: 030_profiles_fk_on_delete
--
-- Changes all RESTRICT / NO ACTION foreign keys referencing profiles(id)
-- to ON DELETE SET NULL, so admin can permanently delete a user.
-- FKs already set to CASCADE or SET NULL in previous migrations are skipped.

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

-- ── collaborator_pricing.created_by ─────────────────────────────────────
ALTER TABLE public.collaborator_pricing
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.collaborator_pricing
  DROP CONSTRAINT collaborator_pricing_created_by_fkey,
  ADD CONSTRAINT collaborator_pricing_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── vacations.approved_by (already nullable) ────────────────────────────
ALTER TABLE public.vacations
  DROP CONSTRAINT IF EXISTS vacations_approved_by_fkey,
  ADD CONSTRAINT vacations_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── appointments.assigned_to (already nullable) ─────────────────────────
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_assigned_to_fkey,
  ADD CONSTRAINT appointments_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── appointments.created_by (already nullable) ──────────────────────────
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_created_by_fkey,
  ADD CONSTRAINT appointments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── contractor_documents.uploaded_by ────────────────────────────────────
ALTER TABLE public.contractor_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE public.contractor_documents
  DROP CONSTRAINT contractor_documents_uploaded_by_fkey,
  ADD CONSTRAINT contractor_documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── contractor_documents.reviewed_by (already nullable) ─────────────────
ALTER TABLE public.contractor_documents
  DROP CONSTRAINT IF EXISTS contractor_documents_reviewed_by_fkey,
  ADD CONSTRAINT contractor_documents_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── collaborator_cycles.collaborator_id ─────────────────────────────────
ALTER TABLE public.collaborator_cycles
  ALTER COLUMN collaborator_id DROP NOT NULL;

ALTER TABLE public.collaborator_cycles
  DROP CONSTRAINT collaborator_cycles_collaborator_id_fkey,
  ADD CONSTRAINT collaborator_cycles_collaborator_id_fkey
    FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── collaborator_cycles.published_by (already nullable) ─────────────────
ALTER TABLE public.collaborator_cycles
  DROP CONSTRAINT IF EXISTS collaborator_cycles_published_by_fkey,
  ADD CONSTRAINT collaborator_cycles_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── material_discrepancies.reported_by ──────────────────────────────────
ALTER TABLE public.material_discrepancies
  ALTER COLUMN reported_by DROP NOT NULL;

ALTER TABLE public.material_discrepancies
  DROP CONSTRAINT material_discrepancies_reported_by_fkey,
  ADD CONSTRAINT material_discrepancies_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── material_transfers.created_by ───────────────────────────────────────
ALTER TABLE public.material_transfers
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.material_transfers
  DROP CONSTRAINT material_transfers_created_by_fkey,
  ADD CONSTRAINT material_transfers_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── project_documents.uploaded_by ───────────────────────────────────────
ALTER TABLE public.project_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE public.project_documents
  DROP CONSTRAINT project_documents_uploaded_by_fkey,
  ADD CONSTRAINT project_documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ── employees.profile_id (already nullable) ─────────────────────────────
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_profile_id_fkey,
  ADD CONSTRAINT employees_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
