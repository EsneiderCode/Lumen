-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 074 — Quitar la columna fantasma `is_direct_order` del trigger
-- Depends on: 073_work_order_access_scope.sql
-- Purpose:
--   `validate_client_first_work_order()` (migración 068) lee
--   `NEW.is_direct_order` / `OLD.is_direct_order` en su guarda de entrada, pero
--   esa columna NO EXISTE en `public.work_orders` ni ha existido nunca. Es
--   estado local del formulario (`WorkOrderFormPage.tsx`), y al persistir se
--   traduce a `client_id IS NULL` — «direct order = client_id IS NULL», la regla
--   que fijó la migración 005.
--
--   plpgsql resuelve los campos de un record al PLANIFICAR la expresión, no al
--   evaluarla, así que `CREATE FUNCTION` aceptó el cuerpo sin protestar y el
--   fallo aparece en tiempo de ejecución, en CADA alta o edición de orden:
--
--     record "new" has no field "is_direct_order"
--
--   El trigger es BEFORE INSERT OR UPDATE FOR EACH ROW, de modo que la tabla
--   `work_orders` quedó sin poder recibir escrituras desde que se aplicó la 068.
--
--   Se elimina la condición en vez de crear la columna: es redundante. La guarda
--   ya compara `NEW.client_id IS NOT DISTINCT FROM OLD.client_id` dos líneas más
--   arriba, y `is_direct_order` no es más que `client_id IS NULL`. Añadir una
--   columna para sostener la referencia sería inventar esquema para un concepto
--   que el frontend nunca envía.
--
--   El resto del cuerpo se reproduce sin un solo cambio respecto a la 068.
-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback notes: esta migración solo reemplaza el cuerpo de una función. Para
-- volver atrás, reaplica el bloque CREATE OR REPLACE FUNCTION de la migración
-- 068 tal cual — pero ten en cuenta que eso reintroduce el fallo en tiempo de
-- ejecución y deja `work_orders` sin poder recibir escrituras.

begin;

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

-- El trigger `work_orders_validate_client_first` de la 068 sigue en pie y
-- apunta a esta función ya corregida; no hace falta recrearlo.

commit;
