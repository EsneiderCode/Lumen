-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 073 — Alcance de acceso por orden: un solo responsable
-- Depends on: 072_revoke_anon_assign_work_order.sql
-- Purpose:
--   Regla del dueño: «un técnico solo puede ver lo que pertenece a la orden que
--   se le asignó; y cada orden tiene exactamente UN responsable, el resto del
--   equipo queda solo DOCUMENTADO, para que dos personas no puedan manipular la
--   misma orden». Esto aplica a todos los casos.
--
--   `public.work_orders` ya está bien acotada (`assigned_technician = auth.uid()`
--   en `work_orders_technician_select` / `_update` / `work_orders_contractor_select`,
--   definidas en `supabase/rls_policies.sql`). Lo que NO está acotado es todo lo
--   que cuelga de la orden:
--
--     1. `public.work_order_documents` — la política `tech_read_work_order_documents`
--        (migración 020) abre la lectura a CUALQUIER perfil cuyo `profiles.team`
--        coincida con `work_orders.assigned_team`. Un compañero de equipo ve los
--        planos y las cartas de empalme de una orden que no es suya.
--     2. Bucket `work-order-documents` — `storage_wo_docs_read` (migración 039)
--        replica esa misma rama de equipo sobre `storage.objects`.
--     3. Bucket `work-order-photos` — `storage_photos_auth_read` y
--        `storage_photos_auth_insert` (en `rls_policies.sql`) solo exigen
--        `bucket_id = 'work-order-photos'`: CUALQUIER usuario autenticado lee y
--        escribe TODAS las fotos de TODAS las órdenes. Es la fuga más grande de
--        las tres — direcciones de cliente, instalaciones y firmas.
--
--   Las ramas por equipo nunca fueron una decisión de seguridad: los roles de
--   campo solo tienen permisos `portal.*` (migración 034), así que las políticas
--   basadas en `has_permission()` jamás les aplican, y `assigned_team` quedó
--   funcionando de facto como llave de acceso colectiva. Se elimina esa llave.
--
--   `auth.uid()` en una sesión de campo es el id individual del perfil — la
--   edge function `team-pin-login` firma `sub: profile.id` —, así que acotar por
--   persona es correcto y no rompe el login por PIN.
--
--   Además se añade `work_orders.assigned_team_roster` (JSONB): la cuadrilla que
--   estaba presente en el momento de asignar, guardada como DOCUMENTACIÓN. No es
--   —y nunca debe convertirse en— una llave de acceso. Se reescribe en cada
--   asignación (una reasignación es una asignación: documenta la cuadrilla que
--   tiene la orden AHORA), pero solo la puede tocar quien tenga
--   `work_orders.edit`; un trigger lo impone, porque
--   `work_orders_technician_update` es por fila y no por columna, y sin él el
--   propio técnico documentado podría reescribir el documento que lo describe,
--   incluido el flag `is_responsible`.
--
--   Y un CHECK `NOT VALID` deja escrito que una orden con equipo exige
--   responsable, sin matar el histórico.
--
--   EXCEPCIÓN DEL CHECK — órdenes importadas (`source <> 'lumen'`):
--   el puente NE4 (`ne4-work-manager`, edge function `lumen-bridge`) hace UPSERT
--   contra `work_orders` con `assigned_team: cita.lumen_team` y SIN
--   `assigned_technician`: llegan ya ejecutadas, en `rueckmeldung_sent`, y su
--   equipo es de por sí documental — nadie las «asigna» en LUMEN. `NOT VALID`
--   solo perdona las filas que YA existen; el CHECK sí se aplica a todo INSERT y
--   UPDATE futuro, así que un CHECK sin excepción rompería cada sincronización
--   del puente en cuanto se aplique esta migración. Por eso la regla se acota a
--   `source = 'lumen'` (columna de la migración 025: TEXT NOT NULL DEFAULT
--   'lumen' CHECK (source IN ('lumen','ne4'))), que es exactamente el universo de
--   órdenes que LUMEN sí asigna.
--
--   SEGUIMIENTO ENTRE REPOS (no entra en esta migración): el puente debería
--   pasar a poblar `assigned_team_roster` en vez de `assigned_team`, y dejar
--   `assigned_team` en NULL para las órdenes importadas. Eso vive en
--   `ne4-work-manager/supabase/functions/lumen-bridge/index.ts` y necesita su
--   propio cambio y despliegue; hasta entonces la excepción de arriba es lo que
--   mantiene el puente vivo.
--
--   `assigned_team` NO se borra ni se renombra: la migración 068 lo lee (corte
--   corto de la lista de ejecutores y las reglas de coherencia) y la 072 vuelve a
--   declarar `assign_work_order_checked` con parámetro `p_team`.
--
--   Se cierra además un agujero anterior que este cambio vuelve explotable:
--   `public.assign_work_order_checked` (migración 016) es SECURITY DEFINER, la
--   072 se la dejó a `authenticated`, y su cuerpo no comprueba identidad ni
--   permisos. Cualquier técnico autenticado podía llamarla para ponerse a sí
--   mismo como `assigned_technician` de una orden arbitraria; con las políticas
--   de fotos y documentos por propiedad que introduce esta migración, eso ya no
--   es solo un cambio de datos: le compra los archivos de esa orden. Se le añade
--   la misma aserción que la 069 puso en sus hermanas, sin tocar la firma, para
--   que el REVOKE/GRANT de la 072 siga siendo válido.
--
--   OJO — `supabase/rls_policies.sql` es la SEGUNDA fuente DDL aplicada a mano
--   (convención documentada en README.md → «Standards»). Las políticas de
--   `work_orders` y TODAS las del bucket `work-order-photos` viven allí, no en
--   migraciones. Este archivo hace `DROP POLICY IF EXISTS` por esos nombres
--   exactos y las recrea; `rls_policies.sql` se actualizó en el mismo cambio
--   para que el script idempotente siga coherente, incluidas las políticas de
--   documentos (020/039) que antes solo existían en migraciones.
--
-- Rollback notes:
--   Ejecutables tal cual, en este orden, dentro de una transacción.
--
--   -- 1. Documentos: la migración 020 trae un CREATE POLICY pelado, sin DROP
--   --    previo, así que reaplicar su bloque falla con «policy already exists».
--   --    Estas son las sentencias que sí funcionan:
--   --  DROP POLICY IF EXISTS "tech_read_work_order_documents" ON public.work_order_documents;
--   --  CREATE POLICY "tech_read_work_order_documents"
--   --    ON public.work_order_documents FOR SELECT TO authenticated
--   --    USING (
--   --      EXISTS (
--   --        SELECT 1 FROM public.work_orders wo
--   --        WHERE wo.id = work_order_id
--   --          AND (
--   --            wo.assigned_technician = auth.uid()
--   --            OR wo.assigned_team IN (
--   --              SELECT team FROM public.profiles WHERE id = auth.uid()
--   --            )
--   --          )
--   --      )
--   --    );
--   --
--   -- 2. Bucket work-order-documents:
--   --  DROP POLICY IF EXISTS "storage_wo_docs_read" ON storage.objects;
--   --  CREATE POLICY "storage_wo_docs_read"
--   --    ON storage.objects FOR SELECT TO authenticated
--   --    USING (
--   --      bucket_id = 'work-order-documents'
--   --      AND (
--   --        public.has_permission('work_orders.view')
--   --        OR EXISTS (
--   --          SELECT 1 FROM public.work_orders wo
--   --          WHERE wo.id::text = (storage.foldername(name))[1]
--   --            AND (
--   --              wo.assigned_technician = auth.uid()
--   --              OR wo.assigned_team IN (
--   --                SELECT team FROM public.profiles WHERE id = auth.uid()
--   --              )
--   --            )
--   --        )
--   --      )
--   --    );
--   --
--   -- 3. Bucket work-order-photos (vuelve a quedar ABIERTO a todo autenticado —
--   --    es el estado previo, no un estado deseable):
--   --  DROP POLICY IF EXISTS "storage_photos_auth_read"   ON storage.objects;
--   --  DROP POLICY IF EXISTS "storage_photos_auth_insert" ON storage.objects;
--   --  DROP POLICY IF EXISTS "storage_photos_owner_delete" ON storage.objects;
--   --  CREATE POLICY "storage_photos_auth_read"   ON storage.objects FOR SELECT TO authenticated
--   --    USING (bucket_id = 'work-order-photos');
--   --  CREATE POLICY "storage_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated
--   --    WITH CHECK (bucket_id = 'work-order-photos');
--   --  CREATE POLICY "storage_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
--   --    USING (bucket_id = 'work-order-photos' AND auth.uid() = owner);
--   --
--   -- 4. Trigger del roster:
--   --  DROP TRIGGER IF EXISTS guard_assigned_team_roster ON public.work_orders;
--   --  DROP FUNCTION IF EXISTS public.guard_assigned_team_roster();
--   --
--   -- 5. Constraint:
--   --  ALTER TABLE public.work_orders
--   --    DROP CONSTRAINT IF EXISTS work_orders_team_requires_technician;
--   --
--   -- 6. Columna (destruye la documentación de cuadrilla ya capturada —
--   --    exportarla antes si importa):
--   --  ALTER TABLE public.work_orders DROP COLUMN IF EXISTS assigned_team_roster;
--   --
--   -- 7. `assign_work_order_checked` vuelve a su cuerpo de la 016 reaplicando el
--   --    CREATE OR REPLACE de esa migración (es idempotente y conserva los ACL,
--   --    así que el REVOKE/GRANT de la 072 sigue en pie). NO recomendado: eso
--   --    reabre la escalada de privilegios descrita arriba.
--   --
--   - No hay DML: esta migración no escribe ni una fila, solo DDL y avisos. Por
--     eso los recuentos van con RAISE NOTICE y no con GET DIAGNOSTICS ROW_COUNT.
--
-- NO aplicar desde la máquina de Jarl. Alejandro la aplica en Supabase.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Documentos de orden: solo el responsable ─────────────────────────────
-- Se sustituye la política de la migración 020. Las políticas por permiso de la
-- migración 035 (`wo_documents_select_perm`, `wo_documents_write_perm`) quedan
-- intactas: son las de oficina y siguen dando acceso a quien tiene el permiso.

DROP POLICY IF EXISTS "tech_read_work_order_documents" ON public.work_order_documents;

CREATE POLICY "tech_read_work_order_documents"
  ON public.work_order_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.assigned_technician = auth.uid()
    )
  );

COMMENT ON POLICY "tech_read_work_order_documents" ON public.work_order_documents IS
  'Solo el responsable de la orden (assigned_technician). La rama por assigned_team se retiró en la migración 073: el equipo es documentación, no llave de acceso.';

-- ─── 2. Bucket work-order-documents: misma regla sobre storage.objects ───────
-- Rutas: work-order-documents/<work_order_id>/<timestamp>-<archivo>, así que la
-- llave sigue siendo (storage.foldername(name))[1].

DROP POLICY IF EXISTS "storage_wo_docs_read" ON storage.objects;

CREATE POLICY "storage_wo_docs_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-documents'
    AND (
      public.has_permission('work_orders.view')
      OR EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.id::text = (storage.foldername(name))[1]
          AND wo.assigned_technician = auth.uid()
      )
    )
  );

-- `storage_wo_docs_insert` y `storage_wo_docs_delete` (migración 039) no se
-- tocan: ya exigen `work_orders.manage_documents`, que ningún rol de campo tiene.

-- ─── 3. Bucket work-order-photos: acotarlo por orden ────────────────────────
-- Antes: `bucket_id = 'work-order-photos'` a secas para SELECT e INSERT — todo
-- usuario autenticado leía y escribía todas las fotos de todas las órdenes.
--
-- Las dos rutas de subida que existen en la app empiezan por el id de la orden,
-- verificado en el código:
--   - src/services/capturePlanService.ts  → `<workOrderId>/<section>/<slot>/<archivo>`
--   - src/services/workOrderService.ts    → `<workOrderId>/<photoType>/<archivo>`  (legado)
-- Por eso (storage.foldername(name))[1] es el id de la orden en ambos casos.

DROP POLICY IF EXISTS "storage_photos_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_owner_delete" ON storage.objects;

CREATE POLICY "storage_photos_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      public.has_permission('work_orders.view')
      OR EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.id::text = (storage.foldername(name))[1]
          AND wo.assigned_technician = auth.uid()
      )
    )
  );

CREATE POLICY "storage_photos_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND (
      public.has_permission('work_orders.view')
      OR EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.id::text = (storage.foldername(name))[1]
          AND wo.assigned_technician = auth.uid()
      )
    )
  );

-- Borrado: oficina con permiso, o el dueño del objeto (quien la subió), para que
-- un técnico pueda deshacer su propia subida errónea sin tocar las ajenas.
CREATE POLICY "storage_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      public.has_permission('work_orders.view')
      OR auth.uid() = owner
    )
  );

-- El bucket `capture-examples` (migración 058) queda fuera de este cambio: son
-- fotos de ejemplo del plan de captura, no material de una orden concreta.

-- Aviso: objetos cuya primera carpeta no resuelve a una orden existente. No los
-- borra nadie aquí — pero a partir de ahora solo los ve la oficina.
DO $$
DECLARE
  orphan_objects BIGINT;
BEGIN
  SELECT count(*) INTO orphan_objects
  FROM storage.objects o
  WHERE o.bucket_id = 'work-order-photos'
    AND NOT EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id::text = (storage.foldername(o.name))[1]
    );

  RAISE NOTICE
    'work-order-photos: % objetos sin orden resoluble en la primera carpeta (solo visibles con work_orders.view)',
    orphan_objects;
END;
$$;

-- ─── 4. Cuadrilla documentada (no es llave de acceso) ───────────────────────

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS assigned_team_roster JSONB;

COMMENT ON COLUMN public.work_orders.assigned_team_roster IS
  'DOCUMENTACIÓN, NUNCA CONTROL DE ACCESO. Instantánea de la cuadrilla presente al asignar la orden: [{profile_id, full_name, role, is_responsible}]. Se reescribe entera en cada asignación —una reasignación es una asignación— para que documente la cuadrilla que tiene la orden ahora; fuera de esa escritura no se recalcula, y solo la puede modificar quien tenga work_orders.edit (trigger guard_assigned_team_roster). El único responsable de la orden es work_orders.assigned_technician, y ese es el ÚNICO campo que las políticas RLS pueden mirar. Ninguna política, vista ni RPC puede usar assigned_team_roster (ni assigned_team) para conceder acceso. No contiene ningún dato monetario: los precios no son visibles para técnicos ni contratistas.';

-- El roster documenta al técnico; sin esto el técnico documentado podría
-- reescribirlo. `work_orders_technician_update` acota la FILA (assigned_technician
-- = auth.uid()) pero no las COLUMNAS, así que el asignado puede escribir cualquier
-- campo de su propia orden, `assigned_team_roster` incluido — y con él el flag
-- `is_responsible` que dice quién manda.
CREATE OR REPLACE FUNCTION public.guard_assigned_team_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assigned_team_roster IS DISTINCT FROM OLD.assigned_team_roster THEN
    -- auth.uid() nulo = service_role / cron / edge function: credencial de
    -- servidor, que además ya se salta el RLS entero. El puente NE4 entra por
    -- aquí y no toca el roster, pero no se le puede exigir un permiso de usuario.
    IF auth.uid() IS NOT NULL AND NOT public.has_permission('work_orders.edit') THEN
      RAISE EXCEPTION
        'assigned_team_roster is documentation: only work_orders.edit may change it'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_assigned_team_roster ON public.work_orders;
CREATE TRIGGER guard_assigned_team_roster
  BEFORE UPDATE OF assigned_team_roster ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_assigned_team_roster();

-- ─── 5. Un equipo exige un responsable (solo en órdenes de LUMEN) ───────────
-- NOT VALID a propósito: las filas históricas con equipo y sin técnico no se
-- pueden reparar automáticamente sin inventarse un responsable. Quedan como
-- están; toda escritura futura sí pasa por el CHECK — y ese «toda escritura
-- futura» es justo lo que obliga a excluir las órdenes importadas: el puente NE4
-- inserta con equipo y sin técnico en cada sincronización. Ver la cabecera.

DO $$
DECLARE
  violating_orders BIGINT;
  exempt_orders BIGINT;
BEGIN
  SELECT count(*) INTO violating_orders
  FROM public.work_orders
  WHERE source = 'lumen'
    AND assigned_team IS NOT NULL
    AND assigned_technician IS NULL;

  SELECT count(*) INTO exempt_orders
  FROM public.work_orders
  WHERE source <> 'lumen'
    AND assigned_team IS NOT NULL
    AND assigned_technician IS NULL;

  RAISE NOTICE
    'work_orders de LUMEN con equipo y sin responsable (sobreviven por NOT VALID, reasignarlas a una persona): %',
    violating_orders;
  RAISE NOTICE
    'work_orders importadas (source <> lumen) con equipo y sin responsable, exentas del CHECK por diseño: %',
    exempt_orders;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_orders_team_requires_technician'
      AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_team_requires_technician
      CHECK (source <> 'lumen' OR assigned_team IS NULL OR assigned_technician IS NOT NULL)
      NOT VALID;
  END IF;
END;
$$;

COMMENT ON CONSTRAINT work_orders_team_requires_technician ON public.work_orders IS
  'Una orden de LUMEN con equipo tiene que tener un responsable individual. Las órdenes importadas (source <> lumen) están exentas: el puente NE4 hace UPSERT con assigned_team y sin assigned_technician, y llegan ya ejecutadas en rueckmeldung_sent — su equipo es documental y nadie las asigna en LUMEN, así que un CHECK sin esta excepción rompería cada sincronización. NOT VALID: el histórico anterior a la migración 073 se conserva sin tocar; validar a mano con VALIDATE CONSTRAINT solo después de reasignar esas filas.';

-- `assigned_team` se conserva: la migración 068 lo lee y la 072 vuelve a
-- declarar `assign_work_order_checked(p_team ...)`. Cambia su significado, no su
-- existencia.
COMMENT ON COLUMN public.work_orders.assigned_team IS
  'Cuadrilla a la que pertenece la orden. Desde la migración 073 es SOLO organizativo/documental: no concede acceso a nada. Quien puede trabajar y ver la orden es work_orders.assigned_technician, y solo esa persona.';

-- ─── 6. Cerrar la escalada por `assign_work_order_checked` ──────────────────
-- La 016 la creó SECURITY DEFINER y sin ninguna comprobación de identidad; la
-- 072 le quitó `anon` pero dejó el cuerpo intacto a propósito. Con `authenticated`
-- todavía dentro, cualquier técnico podía llamarla y ponerse como
-- `assigned_technician` de una orden cualquiera. Antes eso «solo» falseaba la
-- asignación; con las políticas de esta migración, ser el asignado ES el permiso
-- de lectura sobre las fotos y los documentos de esa orden — así que el agujero
-- pasa a ser una vía de acceso a archivos y hay que cerrarlo aquí.
--
-- Misma aserción que la 069 puso en `certify_work_order_internal` y compañía.
-- La FIRMA NO CAMBIA: el REVOKE/GRANT de la 072 se declara sobre ella y tiene
-- que seguir cuadrando. CREATE OR REPLACE conserva los ACL, pero se reafirman
-- abajo para que este archivo sea autosuficiente si alguien lo ejecuta suelto.

CREATE OR REPLACE FUNCTION public.assign_work_order_checked(
  p_work_order_id uuid,
  p_team public.team_color,
  p_assignee_id uuid,
  p_assigned_date date,
  p_changed_by uuid,
  p_notes text default null
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  previous_status public.work_order_status;
  updated_order public.work_orders;
begin
  -- Añadido en la 073. Exige que quien llama sea el actor que dice ser y que
  -- tenga permiso de asignación; sin esto la función era una escalada directa.
  perform public.assert_work_order_rpc_permission(p_changed_by, 'work_orders.assign');

  select status into previous_status
  from public.work_orders
  where id = p_work_order_id
  for update;

  if previous_status is null then
    raise exception 'work order not found' using errcode = 'no_data_found';
  end if;

  if previous_status not in ('created', 'assigned') then
    raise exception 'invalid assignment status: %', previous_status using errcode = 'check_violation';
  end if;

  -- Regla de la 073: una orden de LUMEN con equipo exige un responsable. Se
  -- comprueba aquí además del CHECK para que el error sea legible.
  if p_assignee_id is null then
    raise exception 'assignment requires a responsible technician'
      using errcode = 'check_violation';
  end if;

  update public.work_orders
  set assigned_team = p_team,
      assigned_technician = p_assignee_id,
      assigned_date = p_assigned_date,
      status = 'assigned',
      updated_at = now()
  where id = p_work_order_id
  returning * into updated_order;

  insert into public.work_order_state_history(work_order_id, from_status, to_status, changed_by, notes)
  values (p_work_order_id, previous_status, 'assigned', p_changed_by, coalesce(p_notes, 'Assigned through checked RPC'));

  return updated_order;
end;
$$;

-- Reafirmar el endurecimiento de la 072 sobre la firma intacta.
--
-- NOTA sobre `service_role`: `assert_work_order_rpc_permission` exige
-- `auth.uid() IS NOT NULL` y `p_changed_by = auth.uid()`, así que a partir de
-- aquí esta RPC es solo para sesiones de usuario — igual que sus hermanas desde
-- la 069, que ya viven con esa misma restricción. El GRANT a `service_role` se
-- conserva por coherencia con la 072, pero es vestigial. Verificado antes de
-- endurecerla: no la llama ninguna edge function de LUMEN ni el repo
-- `ne4-work-manager` (el puente hace UPSERT REST directo sobre `work_orders`,
-- no pasa por esta función). Si algún día un proceso de servidor la necesita,
-- hay que darle su propia vía, no aflojar la aserción.
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

COMMIT;
