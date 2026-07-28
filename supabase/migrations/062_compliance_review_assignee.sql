-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 062 — Encargado de revisión documental + aviso al entrar a revisión
-- Depends on: 042_compliance_core.sql, 048_compliance_notifications.sql
-- Purpose:
--   Hasta hoy, cuando una empresa o un autónomo subía documentación desde el
--   portal, el slot pasaba a `in_review` y ahí se quedaba: la bandeja de
--   Administración → Cumplimiento no avisaba a nadie. Los únicos correos del
--   módulo eran el resultado de la revisión (al dueño) y el digest diario de
--   vencimientos. Esta migración cierra ese hueco:
--
--     1) public.compliance_settings — tabla de una sola fila con el
--        `review_assignee_id`: el administrador encargado de la documentación,
--        que se elige en Administración → Configuración. Revisar puede seguir
--        haciéndolo cualquier administrador con `compliance.review`; el
--        encargado es solo el destinatario del correo de «hay documentación
--        nueva».
--
--     2) Un trigger sobre entity_documents que, al entrar un documento en
--        `in_review`, escribe la notificación in-app (campana) para TODOS los
--        revisores activos — coherente con que cualquiera pueda revisarlo.
--        El correo, que va solo al encargado, lo manda la Edge Function
--        compliance-upload (no puede salir de SQL sin pg_net por petición).
--
--   El trigger es idempotente por `dedupe_key = 'submitted:'||version_id`: subir
--   dos veces la misma versión no duplica la fila; una versión nueva sí genera
--   aviso nuevo aunque el slot ya estuviera en revisión.
--
--   PASOS MANUALES para Alejandro tras aplicar:
--     - Regenerar database.types.ts (compliance_settings es nueva).
--     - Elegir el encargado en Administración → Configuración. Mientras esté
--       vacío, compliance-upload manda el correo a todos los admin activos para
--       que ningún envío se pierda en silencio.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Ajustes del módulo de cumplimiento (fila única) ──────────────────────────
-- El PK booleano con CHECK (id) fuerza el singleton: solo cabe la fila `true`.
CREATE TABLE IF NOT EXISTS public.compliance_settings (
  id                 BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  -- Administrador encargado de revisar la documentación entrante. ON DELETE SET
  -- NULL: si se borra su perfil, el aviso pasa a todos los admin (ver EF).
  review_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID REFERENCES public.profiles(id)
);

INSERT INTO public.compliance_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;

-- Leer: cualquiera que vea el módulo (la bandeja muestra quién es el encargado).
DROP POLICY IF EXISTS "compliance_settings_select" ON public.compliance_settings;
CREATE POLICY "compliance_settings_select" ON public.compliance_settings
  FOR SELECT TO authenticated
  USING (
    public.has_permission('compliance.view')
    OR public.has_permission('compliance.review')
  );

-- Escribir: solo quien configura el módulo. No hay INSERT ni DELETE: la fila
-- única la crea esta migración y nadie debe poder quitarla.
DROP POLICY IF EXISTS "compliance_settings_update" ON public.compliance_settings;
CREATE POLICY "compliance_settings_update" ON public.compliance_settings
  FOR UPDATE TO authenticated
  USING (public.has_permission('compliance.configure_matrix'))
  WITH CHECK (public.has_permission('compliance.configure_matrix'));

-- 2) Aviso in-app a los revisores cuando entra documentación ──────────────────
CREATE OR REPLACE FUNCTION public.notify_reviewers_on_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_name TEXT;
  v_doc_code    TEXT;
  v_doc_name    JSONB;
BEGIN
  -- Sin versión no hay nada que revisar (no debería ocurrir: compliance-upload
  -- escribe current_version_id y status en el mismo PATCH).
  IF NEW.current_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.display_name, dt.code, dt.name_i18n
    INTO v_entity_name, v_doc_code, v_doc_name
  FROM public.compliance_entities e
  JOIN public.document_types dt ON dt.id = NEW.document_type_id
  WHERE e.id = NEW.entity_id;

  INSERT INTO public.notifications (recipient_id, category, level, payload, dedupe_key)
  SELECT
    pr.id,
    'doc_submitted',
    'info',
    jsonb_build_object(
      'entity_id', NEW.entity_id,
      'entity_document_id', NEW.id,
      'entity_name', v_entity_name,
      'doc_type_code', v_doc_code,
      'doc_type_name', v_doc_name,
      'version_id', NEW.current_version_id,
      'status', 'in_review'
    ),
    'submitted:' || NEW.current_version_id
  FROM public.profiles pr
  WHERE pr.is_active
    AND public.user_has_permission(pr.id, 'compliance.review')
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Dispara al entrar en `in_review` y también cuando, estando ya en revisión,
-- llega una versión nueva (resubida tras un rechazo, corrección del proveedor…).
DROP TRIGGER IF EXISTS entity_documents_notify_submission ON public.entity_documents;
CREATE TRIGGER entity_documents_notify_submission
  AFTER UPDATE ON public.entity_documents
  FOR EACH ROW
  WHEN (
    NEW.status = 'in_review'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.current_version_id IS DISTINCT FROM NEW.current_version_id
    )
  )
  EXECUTE FUNCTION public.notify_reviewers_on_submission();
