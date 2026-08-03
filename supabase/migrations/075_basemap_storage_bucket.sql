-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 075 — Bucket del mapa base autoalojado
-- Depends on: 074_fix_validate_client_first_phantom_column.sql
-- Purpose:
--   El mapa de catas leía las teselas de OpenFreeMap: gratis e ilimitado, pero
--   lo lleva una persona con donaciones y declara que no ofrece SLA. Cuando no
--   se puede llegar a ese host, TODAS las teselas fallan y el mapa se queda en
--   un rectángulo de color con los pines flotando encima. Pasó con la orden
--   LUM-20260731-1023 y nada en la app explicaba por qué.
--
--   A partir de ahora el mapa base es nuestro: un único archivo PMTiles en este
--   bucket, servido al navegador por peticiones de rango. Sin API key, sin
--   cuota y sin terceros que puedan tumbarlo.
--
--   Es mucho más barato de lo que parece: `pmtiles extract` recorta un bbox del
--   planeta remoto (128 GB) SIN descargarlo. Roßdorf + Höxter juntos ocupan
--   6,1 MB y tardan 14 segundos. Ver scripts/build-basemap.sh.
--
-- Notes:
--   El bucket es PÚBLICO a propósito. No contiene nada de la empresa: son datos
--   de OpenStreetMap bajo ODbL, los mismos que servía el host anterior sin
--   autenticación ninguna. Y tiene que serlo, porque MapLibre pide los rangos
--   del archivo desde el navegador sin sesión, y la pantalla de login del
--   portal de citas enseña mapa antes de que exista un usuario.
--
--   Escribir sigue siendo cosa del service_role (scripts/build-basemap.sh), que
--   salta RLS: no se crea ninguna política de INSERT/UPDATE/DELETE, de modo que
--   ningún usuario autenticado puede tocar el mapa base.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('basemap', 'basemap', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lectura anónima explícita. El flag `public` del bucket ya la permite a través
-- del endpoint /object/public, pero la política deja la intención escrita y
-- sobrevive a que alguien conmute el flag desde el panel.
DROP POLICY IF EXISTS "storage_basemap_public_read" ON storage.objects;

CREATE POLICY "storage_basemap_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'basemap');
