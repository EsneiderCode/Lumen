-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 047 — Audited override for the contractor-assignment gate (Fase 3)
-- Depends on: 046_compliance_retire_legacy_gates.sql
-- Purpose:
--   Fase 3 introduces the per-project aptitude semáforo across the work-order
--   screens and — for the assignment gate installed in 016/046 — a justified,
--   audited escape hatch. Until now block_non_compliant_contractor_assignment()
--   was a hard block: a contractor with red aptitude (or no compliance entity)
--   could never be assigned. Operations sometimes must dispatch a technician
--   before their paperwork clears; this migration lets a holder of
--   `compliance.override_assignment` force the assignment while recording WHO
--   overrode, WHEN, and WHY on the work order itself.
--
--   The override is stored on work_orders (not a side table) so the fact travels
--   with the order, is visible in audits, and the trigger can read it atomically
--   from NEW. compute_entity_aptitude() stays the single source of truth for the
--   traffic light; the override only decides whether a red/no-entity result
--   blocks or is force-allowed. The project_assignments gate from 043 already had
--   its own override columns — this mirrors that pattern for work orders.
--
--   An override is honoured only when compliance_override = true AND a non-empty
--   compliance_override_reason is present. The service is expected to clear these
--   columns on every non-override assignment so a stale flag never lingers.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Override / audit columns on work_orders ────
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS compliance_override        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS compliance_override_by     UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS compliance_override_at     TIMESTAMPTZ;

COMMENT ON COLUMN public.work_orders.compliance_override IS
  'Fase 3 (047): true when an admin force-assigned a non-apt contractor to this order despite a red/no-entity compliance result.';
COMMENT ON COLUMN public.work_orders.compliance_override_reason IS
  'Mandatory justification captured when compliance_override is set. Required by block_non_compliant_contractor_assignment().';

-- 2) Assignment gate: aptitude engine + audited override escape ────
-- Replaces the 046 body. Same trigger name and firing conditions; the only
-- change is that a red / no-entity result no longer hard-blocks when the row
-- carries a justified override.
CREATE OR REPLACE FUNCTION public.block_non_compliant_contractor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  assignee_role public.user_role;
  v_entity_id   UUID;
  v_apt         RECORD;
  v_blocked     BOOLEAN := false;
  v_message     TEXT;
  v_overridden  BOOLEAN;
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
    v_blocked := true;
    v_message := 'contractor assignment blocked: contractor has no compliance record — onboard them in the compliance module';
  ELSE
    SELECT * INTO v_apt
    FROM public.compute_entity_aptitude(v_entity_id, NEW.project_id);
    IF v_apt.level = 'red' THEN
      v_blocked := true;
      v_message := 'contractor assignment blocked: contractor documents are incomplete, unapproved, or expired';
    END IF;
  END IF;

  IF NOT v_blocked THEN
    RETURN NEW;
  END IF;

  -- Blocked: honour a justified override, otherwise reject.
  v_overridden := NEW.compliance_override
                  AND NEW.compliance_override_reason IS NOT NULL
                  AND btrim(NEW.compliance_override_reason) <> '';

  IF v_overridden THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '%', v_message USING ERRCODE = 'check_violation';
END;
$$;
