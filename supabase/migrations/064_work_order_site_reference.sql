-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 064 — Referencia de obra de la orden: tramo (RA/RD), POP y DP
-- Depends on: 025_work_order_source.sql, 063_fns_service_catalog_seed.sql
-- Purpose:
--   Hoy una orden de obra de infraestructura solo se identifica por su número
--   (LUM-20260729-1042) y su tipo (`soplado`). Ninguna de las dos cosas dice de
--   QUÉ trabajo se trata: en la lista de órdenes, en la del técnico y en los
--   avisos de Telegram aparecen veinte «Soplado» seguidos y hay que abrir cada
--   uno para saber cuál es cuál.
--
--   Lo que identifica un soplado en obra es el tramo: de qué POP sale y a qué DP
--   llega. Eso hasta ahora no se guardaba en ninguna parte — el formulario de
--   orden esconde la dirección en la obra de infraestructura (no hay una calle:
--   hay una traza) y el campo `section` del detalle se retiró en la fase 7 del
--   flujo de fotos, precisamente porque el técnico estaba retecleando algo que
--   debía venir en la orden. Esta migración pone ese dato donde toca: en la
--   orden, puesto por administración al crearla.
--
--   Tres columnas:
--
--     segment_kind — el tramo: 'ra' (ramal de alimentación) o 'rd' (ramal de
--       distribución). Es lo que convierte «Soplado» en «Soplado RA», que es la
--       distinción que hoy hay que adivinar. Se guarda como TEXT con CHECK y no
--       como ENUM a propósito: añadir un tramo nuevo debe ser una línea de SQL,
--       no un `ALTER TYPE` que no se puede revertir dentro de una transacción.
--
--     pop_code / dp_code — códigos cortos dentro del proyecto ('001', '021').
--       El proyecto NO se repite dentro de ellos: la etiqueta que se muestra la
--       compone LUMEN como {código de proyecto}{POP}-DP{DP} → «QFF001-DP021».
--       Guardar 'QFF001' aquí duplicaría el proyecto, que ya está en la orden,
--       y rompería el filtrado por POP el día que haga falta.
--
--   Las tres son opcionales: las órdenes que ya existen no tienen estos datos y
--   no se pueden inventar, y las de alta/NT/Patchkabel se siguen identificando
--   por su dirección, que sí tienen.
--
--   PASOS MANUALES para Alejandro tras aplicar:
--     - Regenerar database.types.ts (tres columnas nuevas en work_orders).
--     - Rellenar POP y DP de las órdenes de infraestructura ya abiertas desde
--       Administración → Órdenes → Editar. Sin ellos la lista sigue mostrando
--       solo el tipo, exactamente como hasta hoy.
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS segment_kind TEXT,
  ADD COLUMN IF NOT EXISTS pop_code     TEXT,
  ADD COLUMN IF NOT EXISTS dp_code      TEXT;

-- El CHECK admite NULL (orden sin tramo declarado) pero no la cadena vacía: la
-- UI guarda NULL cuando el selector está sin elegir, y una '' colada por API
-- haría que la etiqueta dijera «Soplado » con un espacio suelto.
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_segment_kind_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_segment_kind_check
  CHECK (segment_kind IS NULL OR segment_kind IN ('ra', 'rd'));

COMMENT ON COLUMN public.work_orders.segment_kind IS
  'Tramo de la obra: ''ra'' (ramal de alimentación, POP→DP) o ''rd'' (ramal de '
  'distribución). Distingue «Soplado RA» de «Soplado RD» en listas y avisos. '
  'NULL = no declarado.';

COMMENT ON COLUMN public.work_orders.pop_code IS
  'Código del POP dentro del proyecto, sin el prefijo del proyecto: ''001''. '
  'La etiqueta visible se compone como {proyecto}{pop}-DP{dp} → QFF001-DP021.';

COMMENT ON COLUMN public.work_orders.dp_code IS
  'Código del DP dentro del proyecto, sin el prefijo ''DP'': ''021''. '
  'Ver el comentario de pop_code para la etiqueta compuesta.';

-- Buscar «QFF001» o «DP021» en la lista de órdenes filtra por estas columnas
-- además de por número y dirección, así que conviene que estén indexadas junto
-- al proyecto, que es como se consultan siempre (un POP 001 solo significa algo
-- dentro de su proyecto).
CREATE INDEX IF NOT EXISTS idx_work_orders_site_ref
  ON public.work_orders (project_id, pop_code, dp_code)
  WHERE pop_code IS NOT NULL OR dp_code IS NOT NULL;
