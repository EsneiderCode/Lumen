-- ─────────────────────────────────────────────────────────────────────────────
-- Remediación previa a la migración 066 — ING_FIX_011 de Insyte por cuadruplicado
-- Ejecutar ANTES de 066_client_owned_service_catalog.sql, en el SQL Editor.
--
-- QUÉ PASÓ
--   La 066 abortó con su propio guard:
--     duplicate client catalog codes; merge or mark legacy before migration:
--     3c995875-770a-4eb4-9d0c-57b30f7bfb46:ING_FIX_011
--   Es exactamente lo que la cabecera de la 066 pide resolver antes de aplicarla,
--   y como toda la 066 va en BEGIN/COMMIT no quedó nada a medias.
--
-- DIAGNÓSTICO (verificado en producción el 2026-07-30)
--   `ING_FIX_011` («Hausbegehung POP-Gebiet Komplett-Paket 35-45») existe CUATRO
--   veces para Insyte — una por operador: DGF, GFNW, GVG y MER. Las cuatro filas
--   son idénticas en descripción, unidad (Termin) y precio (21,00), y comparten
--   `created_at` al microsegundo: salieron de una misma siembra el 2026-04-19.
--
--   No es un dato legítimo, es un fallo de esa siembra. El resto del catálogo de
--   Insyte lleva el código prefijado por operador (`DGF_ACT_001`, `MER_ACT_001`…)
--   y por eso no colisiona. Los ítems con prefijo `ING_` son los genéricos, los
--   que NO dependen del operador — y sus hermanos `ING_FIX_003`, `ING_FIX_010` e
--   `ING_FIX_012` tienen `operator_id` NULO. El `011` es el único que se sembró
--   con operador, y encima cuatro veces.
--
--   NINGUNA de las cuatro está referenciada. Comprobados los tres únicos caminos
--   de clave ajena hacia `service_items` — `work_orders`,
--   `work_order_billing_lines` y `work_order_line_items` —: cero filas en los
--   tres. No hay historia que preservar aquí.
--
-- QUÉ HACE
--   Deja UNA sola fila seleccionable, con `operator_id` NULO para que quede como
--   sus hermanos `ING_`, y saca las otras tres de los catálogos nuevos marcándolas
--   `legacy_only`. NO se borra nada: `legacy_only = false` lo deshace entero.
--   Cuál sobrevive da igual —son idénticas y el operador desaparece del modelo
--   con la 066—; se conserva la de DGF por ser el operador documentado.
--
--   La columna `legacy_only` se crea aquí porque la 066 no ha llegado a correr.
--   Es la MISMA sentencia `ADD COLUMN IF NOT EXISTS` que usa la 066, así que la
--   066 se la encuentra hecha y sigue sin cambios: este fichero no la parchea.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS legacy_only BOOLEAN NOT NULL DEFAULT false;

-- La superviviente pasa a ser genérica, como el resto de los ING_.
UPDATE public.service_items
SET operator_id = NULL
WHERE id = '0c1234c0-ee55-40be-897e-56916db567a4';

-- Las otras tres salen de los catálogos nuevos sin desaparecer.
UPDATE public.service_items
SET legacy_only = true
WHERE client_id = '3c995875-770a-4eb4-9d0c-57b30f7bfb46'
  AND code = 'ING_FIX_011'
  AND id <> '0c1234c0-ee55-40be-897e-56916db567a4';

-- Mismo criterio que el guard de la 066: si no queda exactamente una fila
-- seleccionable, esto revierte en lugar de dejar el catálogo a medio arreglar.
DO $$
DECLARE
  seleccionables INTEGER;
BEGIN
  SELECT count(*) INTO seleccionables
  FROM public.service_items
  WHERE client_id = '3c995875-770a-4eb4-9d0c-57b30f7bfb46'
    AND code = 'ING_FIX_011'
    AND legacy_only = false;

  IF seleccionables <> 1 THEN
    RAISE EXCEPTION
      'esperaba 1 ING_FIX_011 seleccionable para Insyte, hay %', seleccionables
      USING ERRCODE = 'unique_violation';
  END IF;
END;
$$;

COMMIT;

-- Comprobación después de aplicar (debe devolver 0 filas):
--   SELECT client_id, code, count(*)
--   FROM public.service_items
--   WHERE legacy_only = false AND client_id IS NOT NULL
--   GROUP BY client_id, code HAVING count(*) > 1;
