-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 058 — RLS del flujo de captura para el personal de campo
-- Depends on: 052_capture_plans.sql, 053_capture_plan_soplado_ra.sql,
--             034_rbac_core.sql, 035_rbac_policy_migration.sql
-- Purpose:
--   052 y 053 escribieron la RLS del flujo de captura SOLO en clave de permisos
--   (`work_orders.view` / `work_orders.edit`), y esos permisos los tiene la
--   oficina, no el campo: 034 §6 da a los roles technician/contractor/scheduler
--   ÚNICAMENTE su permiso `portal.*.access`, y su alcance a los datos se decide
--   por propiedad de la orden (assigned_technician), como hacen desde 001 las
--   siete tablas wo_detail_* y como 036 §1 arregló para wo_detail_pop.
--
--   Consecuencia en producción: un técnico que rellena una Rückmeldung recibe
--     new row violates row-level security policy for table
--     "work_order_capture_reports"
--   al guardar, y además:
--     - no puede releer su propio informe (no hay política SELECT que le valga),
--       así que al reabrir la orden el formulario aparece vacío;
--     - no puede leer el catálogo `capture_plans`, así que siempre cae en los
--       planes compilados en el cliente y nunca ve una versión publicada en
--       base de datos (p. ej. una revisión de "Soplado de RA");
--     - no puede leer el bucket `capture-examples`, así que las fotos de
--       ejemplo — lo que hace el formulario autoexplicativo — no se le muestran.
--
--   Esta migración añade el alcance de campo que faltaba. NO toca ni relaja las
--   políticas por permiso ya existentes: se suman a ellas (en RLS varias
--   políticas PERMISSIVE sobre la misma acción se combinan con OR).
--
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) work_order_capture_reports — alcance por orden asignada ──────────────────
-- Mismo patrón exacto que las wo_detail_* que este informe sustituye: sin
-- comprobación de rol, porque el colaborador externo también se asigna en
-- `assigned_technician` y rellena la misma Rückmeldung.

DROP POLICY IF EXISTS "wo_capture_reports_select_own" ON public.work_order_capture_reports;
CREATE POLICY "wo_capture_reports_select_own" ON public.work_order_capture_reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

DROP POLICY IF EXISTS "wo_capture_reports_insert_own" ON public.work_order_capture_reports;
CREATE POLICY "wo_capture_reports_insert_own" ON public.work_order_capture_reports
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

DROP POLICY IF EXISTS "wo_capture_reports_update_own" ON public.work_order_capture_reports;
CREATE POLICY "wo_capture_reports_update_own" ON public.work_order_capture_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id AND wo.assigned_technician = auth.uid()
  ));

-- Sin DELETE de campo, igual que en wo_detail_*: un informe enviado solo lo
-- borra la oficina (o el ON DELETE CASCADE de la orden).

-- 2) capture_plans — el campo necesita LEER el catálogo ───────────────────────
-- Solo definiciones de formulario: ni datos de cliente, ni de orden, ni precios.
-- Se enumeran los portales en vez de abrir a `authenticated` a secas para que
-- quede escrito quién lo lee y por qué.

DROP POLICY IF EXISTS "capture_plans_select_portal" ON public.capture_plans;
CREATE POLICY "capture_plans_select_portal" ON public.capture_plans
  FOR SELECT TO authenticated
  USING (
    public.has_permission('portal.tech.access')
    OR public.has_permission('portal.contractor.access')
  );

-- 3) capture-examples — las fotos de ejemplo son PARA el campo ────────────────
-- 053 las cerró a `work_orders.view`, justo el permiso que no tiene quien las
-- necesita. Escritura y borrado siguen siendo solo de `settings.manage_capture_plans`.

DROP POLICY IF EXISTS "storage_capture_examples_read_portal" ON storage.objects;
CREATE POLICY "storage_capture_examples_read_portal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'capture-examples'
    AND (
      public.has_permission('portal.tech.access')
      OR public.has_permission('portal.contractor.access')
    )
  );
