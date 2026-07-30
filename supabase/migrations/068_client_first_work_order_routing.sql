-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 068 — Client-first work-order routing and canonical executor
-- Depends on: 067_executor_master_data.sql
-- Purpose:
--   - Keep existing orders and the NE4 bridge on flow_version 1.
--   - Make new flow_version 2 orders client/project/catalog consistent.
--   - Persist own-team vs external-contractor execution independently of role.
--   - Omit operator_id and NE3/NE4 line for v2 (Plan 010 decisions D1/D3).
-- Apply manually in Supabase SQL Editor.
-- Rollback notes:
--   - Unbind work_orders_validate_client_first before restoring prior routing.
--   - Restore migration 016 RPC bodies if migration 069 is also rolled back.
--   - Keep operator_id/line nullable; the compatibility relaxation stays.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname = 'work_order_executor_type'
  ) THEN
    CREATE TYPE public.work_order_executor_type AS ENUM
      ('own_team', 'external_contractor');
  END IF;
END;
$$;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS flow_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS executor_type public.work_order_executor_type,
  ADD COLUMN IF NOT EXISTS executor_team_id UUID
    REFERENCES public.teams(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS executor_entity_id UUID
    REFERENCES public.compliance_entities(id) ON DELETE RESTRICT;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_flow_version_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_flow_version_check
  CHECK (flow_version IN (1, 2));

-- D1: v2 writes NULL for both fields. They remain populated and readable on
-- historical v1/NE4 rows, and the legacy line CHECK still validates non-null
-- values.
ALTER TABLE public.work_orders
  ALTER COLUMN operator_id DROP NOT NULL,
  ALTER COLUMN line DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_flow_executor
  ON public.work_orders (flow_version, executor_type, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_executor_team
  ON public.work_orders (executor_team_id)
  WHERE executor_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_executor_entity
  ON public.work_orders (executor_entity_id)
  WHERE executor_entity_id IS NOT NULL;

-- Reporting-only deterministic backfill. Every existing order remains v1; an
-- unresolved executor stays NULL instead of being guessed as own work.
DO $$
DECLARE
  backfilled_count BIGINT;
BEGIN
UPDATE public.work_orders orders
SET executor_type = 'external_contractor',
    executor_entity_id = entity.id,
    executor_team_id = NULL
FROM public.profiles profile
JOIN public.compliance_entities entity ON entity.profile_id = profile.id
WHERE orders.assigned_collaborator_id = profile.id
  AND profile.role = 'contractor'
  AND entity.kind IN ('company', 'freelancer')
  AND orders.executor_type IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE
    'backfilled external_contractor from assigned_collaborator_id: %',
    backfilled_count;

UPDATE public.work_orders orders
SET executor_type = 'external_contractor',
    executor_entity_id = entity.id,
    executor_team_id = NULL
FROM public.profiles profile
JOIN public.compliance_entities entity ON entity.profile_id = profile.id
WHERE orders.assigned_technician = profile.id
  AND profile.role = 'contractor'
  AND entity.kind IN ('company', 'freelancer')
  AND orders.executor_type IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE
    'backfilled external_contractor from assigned_technician: %',
    backfilled_count;

UPDATE public.work_orders orders
SET executor_type = 'own_team',
    executor_entity_id = entity.id
FROM public.profiles profile
JOIN public.employees employee ON employee.profile_id = profile.id
JOIN public.compliance_entities entity ON entity.employee_id = employee.id
WHERE orders.assigned_technician = profile.id
  AND profile.role <> 'contractor'
  AND entity.kind = 'internal_employee'
  AND orders.executor_type IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE
    'backfilled own_team from internal employee: %',
    backfilled_count;

UPDATE public.work_orders orders
SET executor_type = 'own_team',
    executor_team_id = team.id
FROM public.teams team
WHERE orders.assigned_team = team.color_key
  AND orders.executor_type IS NULL;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE
    'backfilled own_team from legacy assigned_team: %',
    backfilled_count;

-- Add a team to already-recognized own employees when the legacy assignment
-- supplies one; this preserves the more specific employee entity too.
UPDATE public.work_orders orders
SET executor_team_id = team.id
FROM public.teams team
WHERE orders.executor_type = 'own_team'
  AND orders.executor_team_id IS NULL
  AND orders.assigned_team = team.color_key;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE
    'enriched own_team executor_team_id from legacy assigned_team: %',
    backfilled_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_client_first_work_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  project_client_id UUID;
  project_active BOOLEAN;
  service_client_id UUID;
  service_active BOOLEAN;
  service_legacy BOOLEAN;
  team_active BOOLEAN;
  team_color public.team_color;
  entity_kind public.compliance_entity_kind;
  entity_active BOOLEAN;
  entity_profile_id UUID;
  entity_employee_id UUID;
  employee_team_id UUID;
  employee_profile_id UUID;
  assignee_team_id UUID;
  assignee_role public.user_role;
BEGIN
  -- Status-only and other non-routing updates must not re-query protected
  -- master data under the caller's RLS context.
  IF TG_OP = 'UPDATE'
     AND NEW.flow_version IS NOT DISTINCT FROM OLD.flow_version
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
     AND NEW.service_item_id IS NOT DISTINCT FROM OLD.service_item_id
     AND NEW.executor_type IS NOT DISTINCT FROM OLD.executor_type
     AND NEW.executor_team_id IS NOT DISTINCT FROM OLD.executor_team_id
     AND NEW.executor_entity_id IS NOT DISTINCT FROM OLD.executor_entity_id
     AND NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id
     AND NEW.line IS NOT DISTINCT FROM OLD.line
     AND NEW.is_direct_order IS NOT DISTINCT FROM OLD.is_direct_order
     AND NEW.assigned_team IS NOT DISTINCT FROM OLD.assigned_team
     AND NEW.assigned_technician IS NOT DISTINCT FROM OLD.assigned_technician
     AND NEW.assigned_collaborator_id IS NOT DISTINCT FROM OLD.assigned_collaborator_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status NOT IN ('created', 'assigned')
     AND NEW.flow_version IS DISTINCT FROM OLD.flow_version THEN
    RAISE EXCEPTION
      'flow_version cannot change after work starts'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.flow_version = 2
     AND OLD.status NOT IN ('created', 'assigned')
     AND (
       NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.service_item_id IS DISTINCT FROM OLD.service_item_id
       OR NEW.executor_type IS DISTINCT FROM OLD.executor_type
       OR NEW.executor_team_id IS DISTINCT FROM OLD.executor_team_id
       OR NEW.executor_entity_id IS DISTINCT FROM OLD.executor_entity_id
     ) THEN
    RAISE EXCEPTION
      'client-first routing is frozen from in_progress'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.flow_version = 1 THEN
    IF NEW.operator_id IS NULL OR NEW.line IS NULL THEN
      RAISE EXCEPTION
        'v1 work orders require operator_id and line'
        USING ERRCODE = 'not_null_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.operator_id IS NOT NULL OR NEW.line IS NOT NULL THEN
    RAISE EXCEPTION
      'v2 work orders omit operator_id and line'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.client_id IS NULL THEN
    RAISE EXCEPTION
      'v2 work orders require a client'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clients client
    WHERE client.id = NEW.client_id AND client.is_active
  ) THEN
    RAISE EXCEPTION
      'v2 work order client must be active'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT project.client_id, project.is_active
    INTO project_client_id, project_active
  FROM public.projects project
  WHERE project.id = NEW.project_id;

  IF project_client_id IS NULL
     OR project_client_id <> NEW.client_id
     OR NOT project_active THEN
    RAISE EXCEPTION
      'v2 project must be active and owned by the selected client'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.service_item_id IS NULL THEN
    RAISE EXCEPTION
      'v2 work orders require a client-owned service item'
      USING ERRCODE = 'not_null_violation';
  END IF;

  SELECT item.client_id, item.active, item.legacy_only
    INTO service_client_id, service_active, service_legacy
  FROM public.service_items item
  WHERE item.id = NEW.service_item_id;

  IF service_client_id IS NULL
     OR service_client_id <> NEW.client_id
     OR NOT service_active
     OR service_legacy THEN
    RAISE EXCEPTION
      'v2 service item must be active, non-legacy, and owned by the selected client'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.executor_type IS NULL THEN
    RAISE EXCEPTION
      'v2 work orders require executor_type'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NEW.executor_team_id IS NOT NULL THEN
    SELECT team.is_active, team.color_key
      INTO team_active, team_color
    FROM public.teams team
    WHERE team.id = NEW.executor_team_id;
  END IF;

  IF NEW.executor_entity_id IS NOT NULL THEN
    SELECT entity.kind, entity.is_active, entity.profile_id, entity.employee_id
      INTO entity_kind, entity_active, entity_profile_id, entity_employee_id
    FROM public.compliance_entities entity
    WHERE entity.id = NEW.executor_entity_id;
  END IF;

  IF NEW.executor_type = 'own_team' THEN
    IF NEW.executor_team_id IS NULL AND NEW.executor_entity_id IS NULL THEN
      RAISE EXCEPTION
        'own_team executor requires a team or internal employee'
        USING ERRCODE = 'not_null_violation';
    END IF;

    IF NEW.assigned_collaborator_id IS NOT NULL THEN
      RAISE EXCEPTION
        'own_team executor cannot have assigned_collaborator_id'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.executor_team_id IS NOT NULL
       AND coalesce(team_active, false) = false THEN
      RAISE EXCEPTION
        'own_team executor team must be active'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NEW.executor_entity_id IS NOT NULL THEN
      IF entity_kind IS DISTINCT FROM 'internal_employee'
         OR coalesce(entity_active, false) = false THEN
        RAISE EXCEPTION
          'own_team executor entity must be an active internal employee'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      SELECT employee.team_id, employee.profile_id
        INTO employee_team_id, employee_profile_id
      FROM public.employees employee
      WHERE employee.id = entity_employee_id;

      IF NEW.executor_team_id IS NOT NULL
         AND employee_team_id IS DISTINCT FROM NEW.executor_team_id THEN
        RAISE EXCEPTION
          'own employee must belong to the selected executor team'
          USING ERRCODE = 'check_violation';
      END IF;

      IF NEW.assigned_technician IS NOT NULL
         AND employee_profile_id IS DISTINCT FROM NEW.assigned_technician THEN
        RAISE EXCEPTION
          'assigned technician must match the selected own employee'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF NEW.assigned_technician IS NOT NULL THEN
      SELECT profile.team_id, profile.role
        INTO assignee_team_id, assignee_role
      FROM public.profiles profile
      WHERE profile.id = NEW.assigned_technician;

      IF assignee_role = 'contractor'
         OR assignee_team_id IS DISTINCT FROM NEW.executor_team_id THEN
        RAISE EXCEPTION
          'assigned technician must belong to the selected executor team'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF NEW.assigned_team IS NOT NULL
       AND NEW.executor_team_id IS NOT NULL
       AND NEW.assigned_team IS DISTINCT FROM team_color THEN
      RAISE EXCEPTION
        'legacy assigned_team must match executor_team_id'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.executor_team_id IS NOT NULL OR NEW.assigned_team IS NOT NULL THEN
      RAISE EXCEPTION
        'external_contractor executor cannot have an own team'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.executor_entity_id IS NULL
       OR entity_kind NOT IN ('company', 'freelancer')
       OR coalesce(entity_active, false) = false THEN
      RAISE EXCEPTION
        'external_contractor executor requires an active company or freelancer'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NEW.assigned_technician IS NOT NULL THEN
      SELECT profile.role INTO assignee_role
      FROM public.profiles profile
      WHERE profile.id = NEW.assigned_technician;

      IF assignee_role IS DISTINCT FROM 'contractor'
         OR entity_profile_id IS DISTINCT FROM NEW.assigned_technician THEN
        RAISE EXCEPTION
          'assigned contractor profile must match executor_entity_id'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF NEW.assigned_collaborator_id IS NOT NULL
       AND entity_profile_id IS DISTINCT FROM NEW.assigned_collaborator_id THEN
      RAISE EXCEPTION
        'assigned collaborator profile must match executor_entity_id'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_orders_validate_client_first ON public.work_orders;
CREATE TRIGGER work_orders_validate_client_first
  BEFORE INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_first_work_order();

COMMENT ON COLUMN public.work_orders.flow_version IS
  '1 = legacy/direct/NE4-compatible flow; 2 = client-first executor-driven flow.';
COMMENT ON COLUMN public.work_orders.executor_type IS
  'Canonical certification branch. Never derive from profiles.role.';
COMMENT ON COLUMN public.work_orders.executor_team_id IS
  'Canonical own-team executor; optional when a specific internal employee is selected.';
COMMENT ON COLUMN public.work_orders.executor_entity_id IS
  'Canonical employee or top-level contractor entity in compliance_entities.';
COMMENT ON COLUMN public.work_orders.operator_id IS
  'Historical/NE4 routing only. Must be NULL on client-first v2 orders.';
COMMENT ON COLUMN public.work_orders.line IS
  'Historical/NE4 NE3/NE4 level only. Must be NULL on client-first v2 orders; segment_kind remains RA/RD.';

COMMIT;
