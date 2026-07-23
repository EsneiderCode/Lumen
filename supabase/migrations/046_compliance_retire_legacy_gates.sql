-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 046 — Retire the legacy contractor-document gates (Fase 2)
-- Depends on: 045_compliance_legacy_migration.sql
-- Purpose:
--   The new compliance portal (contractor checklist + admin review inbox)
--   replaces the legacy contractor_documents UI, so the transitional fallback
--   introduced in 045 is removed and BOTH enforcement gates now consult only
--   the aptitude engine:
--   1) block_external_cert_without_valid_docs(): external certification
--      requires a compliance entity with non-red aptitude for the work
--      order's project. The legacy 10-document fallback is GONE.
--   2) block_non_compliant_contractor_assignment() (from 016): work-order
--      assignment to a contractor now checks compute_entity_aptitude()
--      instead of contractor_documents_are_valid().
--
--   Contractors without a compliance entity are blocked by both gates —
--   entities were auto-created for every contractor profile in 045, and new
--   contractors are onboarded through the compliance module, so a missing
--   entity means "never onboarded".
--
--   Legacy objects (contractor_documents, subcontractor_onboarding and the
--   contractor_documents_are_valid()/contractor_document_compliance_failures()
--   helpers) are kept for history/audit but are no longer consulted by any
--   trigger. A future cleanup migration may drop them once the retention
--   window agreed for the old records has passed.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) External certification gate: aptitude engine only ────
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
  WHERE ce.profile_id = assignee
    AND ce.is_active;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION
      'External certification blocked: contractor has no compliance record — onboard them in the compliance module'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_apt
  FROM public.compute_entity_aptitude(v_entity_id, v_project_id);

  IF v_apt.level = 'red' THEN
    RAISE EXCEPTION
      'External certification blocked: contractor compliance documents are incomplete, unapproved, or expired'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Work-order assignment gate: aptitude engine only ────
-- Replaces the 016 body (contractor_documents_are_valid). Same trigger name
-- and firing conditions; only the compliance source changes.
CREATE OR REPLACE FUNCTION public.block_non_compliant_contractor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  assignee_role public.user_role;
  v_entity_id   UUID;
  v_apt         RECORD;
BEGIN
  IF NEW.assigned_technician IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.assigned_technician IS NOT DISTINCT FROM OLD.assigned_technician
     AND NEW.assigned_date IS NOT DISTINCT FROM OLD.assigned_date THEN
    RETURN NEW;
  END IF;

  SELECT role INTO assignee_role
  FROM public.profiles
  WHERE id = NEW.assigned_technician;

  IF assignee_role <> 'contractor' THEN
    RETURN NEW;
  END IF;

  SELECT ce.id INTO v_entity_id
  FROM public.compliance_entities ce
  WHERE ce.profile_id = NEW.assigned_technician
    AND ce.is_active;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION
      'contractor assignment blocked: contractor has no compliance record — onboard them in the compliance module'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_apt
  FROM public.compute_entity_aptitude(v_entity_id, NEW.project_id);

  IF v_apt.level = 'red' THEN
    RAISE EXCEPTION
      'contractor assignment blocked: contractor documents are incomplete, unapproved, or expired'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Documentation ────
COMMENT ON FUNCTION public.contractor_documents_are_valid(uuid, date) IS
  'DEPRECATED (046): no longer consulted by any gate. Superseded by compute_entity_aptitude(). Kept for audit queries against legacy data.';
COMMENT ON TABLE public.contractor_documents IS
  'DEPRECATED: superseded by entity_documents (migration 045). Read-only legacy history; the compliance portal replaced the old UI in Fase 2 (046).';
COMMENT ON TABLE public.subcontractor_onboarding IS
  'DEPRECATED: superseded by compliance_entities (migration 045). Read-only legacy history; the compliance onboarding wizard replaced the old UI in Fase 2 (046).';

-- 4) Drop the now-unused legacy 'onboarding' RBAC permission module ────
-- The subcontractor onboarding UI was replaced by the compliance module and its
-- route/page/permission were removed from the frontend registry, so these
-- permissions are dead. The admin-protection trigger on role_permissions
-- (migration 034) rejects removing any permission from the admin system role,
-- so it is disabled for the cascade delete and re-enabled immediately after.
ALTER TABLE public.role_permissions DISABLE TRIGGER role_permissions_protect_admin;
DELETE FROM public.permissions WHERE module = 'onboarding';
ALTER TABLE public.role_permissions ENABLE TRIGGER role_permissions_protect_admin;
