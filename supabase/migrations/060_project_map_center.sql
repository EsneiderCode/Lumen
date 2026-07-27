-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 060 — Ciudad y centro de mapa del proyecto
-- Depends on: 023_project_defaults.sql, 052_capture_plans.sql
-- Purpose:
--   Dónde abre el mapa cuando una cata todavía no tiene posición.
--
--   Desde que las fotos se suben de la galería (y no se hacen en el momento),
--   muchas llegan sin EXIF y el técnico tiene que poner el pin a mano. Hasta
--   ahora ese mapa arrancaba sobre el centro de Alemania, así que cada cata
--   empezaba buscando el pueblo. Un proyecto SIEMPRE ocurre en la misma
--   localidad — QFF es Roßdorf —, así que la localidad es del proyecto, se
--   pone una vez y sirve para todas sus órdenes.
--
--   Se guardan las coordenadas, no solo el nombre: geocodificar exigiría un
--   servicio externo (y su cuota, y su disponibilidad) para resolver algo que
--   se sabe de antemano. El administrador coloca el pin una vez en la ficha del
--   proyecto; `city` es solo la etiqueta legible que se enseña al lado.
--
--   Ninguna columna es obligatoria: un proyecto sin centro no rompe nada, el
--   mapa simplemente sigue abriendo sobre el centro de Alemania.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION;

-- Media coordenada no sirve para centrar nada, y una fuera de rango tampoco.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_center_complete;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_center_complete CHECK (
    (center_lat IS NULL AND center_lng IS NULL)
    OR (center_lat BETWEEN -90 AND 90 AND center_lng BETWEEN -180 AND 180)
  );

COMMENT ON COLUMN public.projects.city IS
  'Localidad del proyecto (QFF → Roßdorf). Etiqueta legible del centro de mapa.';
COMMENT ON COLUMN public.projects.center_lat IS
  'Centro del mapa para las órdenes del proyecto. NULL = centro de Alemania.';
COMMENT ON COLUMN public.projects.center_lng IS
  'Pareja de center_lat; las dos o ninguna (projects_center_complete).';

-- QFF, el único que está confirmado. El resto los rellena el administrador
-- desde la ficha del proyecto arrastrando el pin; nada depende de ello.
-- Roßdorf del distrito de Darmstadt-Dieburg (Hesse). Si el proyecto fuera el
-- otro Roßdorf, se corrige arrastrando el pin una vez.
UPDATE public.projects
   SET city       = COALESCE(city, 'Roßdorf'),
       center_lat = COALESCE(center_lat, 49.8614),
       center_lng = COALESCE(center_lng, 8.7625)
 WHERE code = 'QFF';
