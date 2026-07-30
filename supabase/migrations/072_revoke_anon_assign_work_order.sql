-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 072 — Quitar a `anon` el permiso de asignar órdenes
-- Depends on: 069_executor_certification_paths.sql
-- Purpose:
--   `public.assign_work_order_checked` es SECURITY DEFINER y, por el GRANT que
--   Postgres da por defecto a las funciones nuevas de `public`, la podían
--   ejecutar PUBLIC y `anon`. Por dentro no comprueba `auth.uid()` ni
--   `has_permission()` — solo valida reglas de negocio (cumplimiento documental
--   del contratista y poco más — y lanza excepción con eso). Al ser SECURITY
--   DEFINER corre con los privilegios del dueño, así que ese GRANT dejaba a
--   cualquiera SIN AUTENTICAR llamar a `/rpc/assign_work_order_checked` por
--   PostgREST y asignar órdenes saltándose el RLS por completo.
--
--   La 069 endureció así sus hermanas del ciclo de vida —`certify_work_order_
--   internal`, `accept_work_order_client`, `invoice_work_order_checked` y las
--   RPC nuevas— pero dejó fuera ésta, que es de la 016 y no entraba en el
--   alcance de la base cliente-primero. Verificado en producción el 2026-07-30:
--   las otras ya solo las alcanzaba `authenticated`; ésta seguía abierta a
--   `anon` y a PUBLIC.
--
--   El hallazgo es de Jarl (PR #21, 2026-07-13). Ese PR se descarta entero: va
--   61 commits por detrás y su migración `039_gate_lifecycle_rpcs.sql` recrea
--   con cuerpos viejos tres RPC que la 069 acaba de reescribir, lo que
--   desharía el ruteo de certificación por ejecutor sin que git avise. Aquí se
--   rescata solo la parte que sigue siendo válida, y sin tocar el cuerpo de la
--   función.
--
--   NO CAMBIA EL COMPORTAMIENTO DE LA APP: `authenticated` y `service_role`
--   conservan el permiso, y la aplicación siempre llama autenticada.
--   Revertir: volver a otorgar EXECUTE a `anon` (no debería hacer falta nunca).
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE EXECUTE ON FUNCTION public.assign_work_order_checked(
  p_work_order_id UUID,
  p_team public.team_color,
  p_assignee_id UUID,
  p_assigned_date DATE,
  p_changed_by UUID,
  p_notes TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_work_order_checked(
  p_work_order_id UUID,
  p_team public.team_color,
  p_assignee_id UUID,
  p_assigned_date DATE,
  p_changed_by UUID,
  p_notes TEXT
) TO authenticated, service_role;

-- No dejar el permiso a medias: si `anon` conserva EXECUTE o `authenticated` lo
-- pierde, esto revierte en lugar de dar por bueno el endurecimiento.
DO $$
DECLARE
  v_oid OID;
BEGIN
  SELECT oid INTO v_oid FROM pg_proc WHERE proname = 'assign_work_order_checked';

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon conserva EXECUTE sobre assign_work_order_checked'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated perdió EXECUTE sobre assign_work_order_checked'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

COMMIT;
