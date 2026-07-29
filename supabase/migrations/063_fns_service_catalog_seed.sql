-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 063 — Catálogo de servicios FNS (LV Gernsheim GSW-SUB) + posiciones
--                 a coste real
-- Depends on: 061_client_fns_operator_telekom.sql, 062_compliance_review_assignee.sql
-- Purpose:
--   1) Marca las posiciones que se liquidan a coste real (`is_pass_through`) y
--      las saca del catálogo que ve el técnico.
--   2) Carga las 48 posiciones contratadas con FNS Infrastruktur GmbH (cliente
--      'FNS', migración 061) en public.service_items.
--
--   Fuente: lista de precios firmada del LV Gernsheim GSW-SUB («GERNSHEIM ·
--   GSW-SUB — Einzelpreise FTTx (NU)», Bassendorf, 27.07.2026). Precios netos
--   en EUR, cotejados uno a uno contra el documento firmado: 48/48 correctos.
--
--   ── Por qué hace falta `is_pass_through` ──────────────────────────────────
--   El LV marca 8 posiciones como `LE` (Leistungseinheit): durchlaufende
--   Positionen que se liquidan «nach tatsächlichem Aufwand» y por tanto NO
--   llevan precio unitario. Inventar o interpolar un precio está prohibido por
--   el contrato, así que `unit_price` queda NULL.
--
--   Pero un ítem del catálogo con `unit_price NULL` BLOQUEA la certificación
--   interna: si el técnico lo reporta en una Rückmeldung de alta,
--   buildBillingDraftsFromReportedItems lo descarta por no tener precio y la
--   certificación se corta con «… haben keinen internen Preis», sin decir
--   siquiera cuál es. Con 8 posiciones así en un cliente con obra real, eso
--   pasa el primer día.
--
--   Regla: las posiciones a coste real se liquidan desde administración, no se
--   reportan desde campo. Un dictamen geotécnico o una tasa municipal salen de
--   una factura de terceros, no de la Rückmeldung del técnico. Por eso quedan
--   fuera de `service_items_public` — la vista sin precios que alimenta el
--   catálogo de campo — y nunca llegan al selector del técnico.
--
--   ── Estructura del seed ───────────────────────────────────────────────────
--   category = grupo del LV ('FNS > Gr. 01 Planung' … 'FNS > Gr. 14 Tiefbau –
--   Steuerbare Horizontalbohrung (HDD)'), display_order 1000–1235 (rango propio
--   de FNS, por encima del catálogo NE4 existente que termina en 565).
--
--   Las descripciones alemanas van literales como en el LV: son las que ve el
--   técnico al elegir la posición y las que hay que reconciliar contra las
--   facturas de FNS (mismo criterio que la 004 con los códigos).
--
--   detail_form solo se asigna donde el mapeo a un formulario de captura
--   existente es inequívoco (Einblasarbeiten → soplado, Gf-Hausanschluss →
--   alta). El resto queda NULL (posición suplementaria / obra civil sin
--   formulario propio todavía), igual que las Zulagen del seed de la 022.
--
--   Material y Entsorgung los aporta el Auftraggeber (FNS) y no se facturan ni
--   se descuentan, por eso las posiciones son solo mano de obra/equipo.
--
--   Idempotente: service_items.code no tiene UNIQUE, así que el seed se protege
--   con WHERE NOT EXISTS sobre (code, client_id) — re-ejecutar no duplica filas.
--
--   PASO MANUAL tras aplicar: regenerar database.types.ts (is_pass_through es
--   columna nueva y la vista service_items_public cambia).
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 0. Guard ────────────────────────────────────────────────────────────────
-- Sin el cliente o el operador, el INSERT de abajo insertaría 0 filas EN
-- SILENCIO (el CROSS JOIN se queda sin filas). Mejor abortar que aplicar a
-- medias. Va dentro de la transacción para que el guard proteja de verdad.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE code = 'FNS') THEN
    RAISE EXCEPTION 'Falta el cliente FNS: aplica antes la migración 061';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE code = 'TELEKOM') THEN
    RAISE EXCEPTION 'Falta el operador TELEKOM: aplica antes la migración 061';
  END IF;
END $$;

-- ─── 1. Posiciones a coste real ──────────────────────────────────────────────
ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS is_pass_through BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.service_items.is_pass_through IS
  'Durchlaufende Position (LE): se liquida a coste real, no lleva precio unitario y no se reporta desde campo. Queda fuera de service_items_public.';

-- Una posición a coste real con precio unitario es una contradicción: o el
-- precio está pactado, o se liquida por el importe real. Las dos cosas a la vez
-- significa que alguien interpoló un precio que el contrato no da.
ALTER TABLE public.service_items
  DROP CONSTRAINT IF EXISTS si_pass_through_has_no_price;
ALTER TABLE public.service_items
  ADD CONSTRAINT si_pass_through_has_no_price
  CHECK (NOT is_pass_through OR unit_price IS NULL);

-- ─── 2. Vista sin precios: fuera las posiciones a coste real ─────────────────
-- Es la vista que leen los caminos de campo (Rückmeldung). Excluyéndolas aquí,
-- el técnico no puede elegirlas por construcción, no por disciplina de la UI.
DROP VIEW IF EXISTS public.service_items_public;
CREATE VIEW public.service_items_public AS
SELECT
  si.id,
  si.code,
  si.description_de,
  si.description_es,
  si.unit,
  si.category,
  si.operator_id,
  si.client_id,
  si.detail_form,
  si.display_order,
  si.active,
  si.is_pass_through,
  si.notes,
  si.created_at,
  si.updated_at,
  op.code  AS operator_code,
  op.name  AS operator_name,
  cl.code  AS client_code,
  cl.name  AS client_name
FROM public.service_items si
LEFT JOIN public.operators op ON op.id = si.operator_id
LEFT JOIN public.clients   cl ON cl.id = si.client_id
WHERE si.active = true
  AND si.is_pass_through = false;

GRANT SELECT ON public.service_items_public TO authenticated;

-- ─── 3. Seed del tarifario FNS ───────────────────────────────────────────────
WITH fns AS (
  SELECT id FROM public.clients WHERE code = 'FNS'
),
telekom AS (
  SELECT id FROM public.operators WHERE code = 'TELEKOM'
),
new_items (code, description_de, description_es, unit, unit_price, category, detail_form, display_order, is_pass_through, notes) AS (
  VALUES
    -- Gruppe 01 — Planung
    ('10030200'::text, 'Projektierung und Planung'::text, 'Proyección y planificación'::text, 'm'::text, 2.07::numeric(10,2), 'FNS > Gr. 01 Planung'::text, NULL::text, 1000::int, false, NULL::text),

    -- Gruppe 02 — Dokumentation
    ('10030210', 'Dokumentation in IT-Systemen', 'Documentación en sistemas informáticos', 'm', 0.49, 'FNS > Gr. 02 Dokumentation', NULL, 1005, false, NULL),

    -- Gruppe 03 — Tiefbau (Graben)
    ('10030300', 'Tiefbauarbeiten',                          'Obra civil (zanja)',                      'm',     23.28,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1010, false, NULL),
    ('10030302', 'Oberfläche aus Pflaster/Platten',          'Superficie de adoquín/losas',             'm',     26.35,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1015, false, NULL),
    ('10030303', 'Oberfläche aus Asphalt/Beton',             'Superficie de asfalto/hormigón',          'm',     50.90,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1020, false, NULL),
    ('10030304', 'Oberfläche aus Kopfstein-/Mosaikpflaster', 'Superficie de adoquín de piedra/mosaico', 'm',     28.19,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1025, false, NULL),
    ('10030320', 'Aufbau Gehäuse',                           'Montaje de armario (Gehäuse)',            'Stück', 564.03, 'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1030, false, NULL),

    -- Gruppe 04 — Kabelzug / Kabeleinblasung
    ('10030340', 'Einzieh- und Einblasarbeiten für SNR(V)',  'Tendido y soplado de SNR(V)',      'm', 1.88, 'FNS > Gr. 04 Kabelzug / Kabeleinblasung', 'soplado', 1035, false, NULL),
    ('10030341', 'Glasfaserkabel einblasen',                 'Soplado de cable de fibra óptica', 'm', 0.77, 'FNS > Gr. 04 Kabelzug / Kabeleinblasung', 'soplado', 1040, false, NULL),

    -- Gruppe 05 — Glasfaser-Montage
    ('10030348', 'Montage von Glasfaser-Komponenten', 'Montaje de componentes de fibra óptica', 'Stück', 3.66, 'FNS > Gr. 05 Glasfaser-Montage', NULL, 1045, false, NULL),

    -- Gruppe 06 — FTTH – Hausanschluss
    ('10030360', 'Gf-Hausanschluss komplett herstellen',   'Acometida de fibra completa',                'Stück', 388.75, 'FNS > Gr. 06 FTTH – Hausanschluss', 'alta', 1050, false, NULL),
    ('10030362', 'Gf-Hausanschluss nur SNR',               'Acometida de fibra solo SNR',                'Stück', 228.06, 'FNS > Gr. 06 FTTH – Hausanschluss', 'alta', 1055, false, NULL),
    ('10030364', 'Zulage Hausanschluss >1 m',              'Suplemento acometida >1 m',                  'm',     33.07,  'FNS > Gr. 06 FTTH – Hausanschluss', NULL,   1060, false, NULL),
    ('10030366', 'Gf-Hausanschluss für Grenzbebauung',     'Acometida de fibra en edificación en linde', 'Stück', 399.19, 'FNS > Gr. 06 FTTH – Hausanschluss', 'alta', 1065, false, NULL),
    ('10030368', 'Gf-Hausanschl. einblasen und montieren', 'Acometida: soplado y montaje',               'Stück', 218.45, 'FNS > Gr. 06 FTTH – Hausanschluss', 'alta', 1070, false, NULL),
    ('10030370', 'HP-Plus initial i. Rollout',             'HP-Plus inicial en rollout',                 'Stück', 44.63,  'FNS > Gr. 06 FTTH – Hausanschluss', NULL,   1075, false, NULL),

    -- Gruppe 07 — NE4 – Gebäudeverkabelung
    ('10030100', 'NE4 – Sternverkabelung',                        'NE4 – cableado en estrella',                         'Stück', 141.42, 'FNS > Gr. 07 NE4 – Gebäudeverkabelung', NULL, 1080, false, NULL),
    ('10030103', 'NE4 – Verkabelung mit Gf-Konzentrationspunkt',  'NE4 – cableado con punto de concentración de fibra', 'Stück', 89.22,  'FNS > Gr. 07 NE4 – Gebäudeverkabelung', NULL, 1085, false, NULL),
    ('10030105', 'Zulage Montage Gf-TA (Glasfaserdose)',          'Suplemento montaje de roseta óptica (Gf-TA)',        'Stück', 100.11, 'FNS > Gr. 07 NE4 – Gebäudeverkabelung', NULL, 1090, false, NULL),
    ('10030107', 'Zusätzliche Gf-Spleiße (Mehrfamilienhäuser)',   'Empalmes de fibra adicionales (plurifamiliar)',      'Stück', 8.26,   'FNS > Gr. 07 NE4 – Gebäudeverkabelung', NULL, 1095, false, NULL),
    ('10034243', 'Erweiterte Trasse mit Gf-TA (Einfamilienhaus)', 'Traza ampliada con Gf-TA (unifamiliar)',             'Stück', 21.01,  'FNS > Gr. 07 NE4 – Gebäudeverkabelung', NULL, 1100, false, NULL),

    -- Gruppe 08 — Tiefbau E1 (Zulagen)
    ('10030325', 'Reststreifen/Mehrbreite Pflaster/Platten', 'Franja restante/sobreancho adoquín/losas',          'm²', 23.63, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1105, false, NULL),
    ('10030326', 'Reststreifen/Mehrbreite Asphalt/Beton',    'Franja restante/sobreancho asfalto/hormigón',       'm²', 51.00, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1110, false, NULL),
    ('10030327', 'Reststreifen/Mehrbr. Kopfst.-Mosaikpfl.',  'Franja restante/sobreancho adoquín piedra/mosaico', 'm²', 49.69, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1115, false, NULL),
    ('10030330', 'Mehrtiefe je 15 cm bei Tiefbauarbeiten',   'Sobreprofundidad por cada 15 cm en obra civil',     'm',  3.60,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1120, false, NULL),
    ('10030332', 'Mehrbreite je 15 cm bei Tiefbauarbeiten',  'Sobreancho por cada 15 cm en obra civil',           'm',  3.70,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1125, false, NULL),
    ('10030335', 'Mehrdicke Asphalt/Beton je 4 cm',          'Sobreespesor asfalto/hormigón por cada 4 cm',       'm²', 9.08,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1130, false, NULL),
    ('10030337', 'Gebundene Tragschicht f. Gräben',          'Capa portante ligada para zanjas',                  'm',  13.66, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1135, false, NULL),
    ('10030339', 'Tiefbaukosten in Bdkl 7',                  'Obra civil en clase de suelo 7',                    'm',  7.26,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1140, false, NULL),

    -- Gruppe 09 — Kabelzug / Kabeleinblasung E1
    ('10030344', 'Rohrschäden instandsetzen', 'Reparación de daños en tubos', 'Stück', 466.47, 'FNS > Gr. 09 Kabelzug / Kabeleinblasung E1', NULL, 1145, false, NULL),

    -- Gruppe 10 — Tiefbau E2 (Verkehrssicherung)
    ('10081334', 'Einsatz Saugbagger',            'Empleo de excavadora de succión',             'LE',    NULL::numeric(10,2), 'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1150, true,  'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10014083', 'Lichtsignalanlage betreiben',   'Operación de semáforo provisional',           'Stück', 45.13,  'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1155, false, NULL),
    ('10014094', 'Lichtsignalanlage Typ A bis C', 'Semáforo provisional tipo A a C',             'Stück', 162.38, 'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1160, false, NULL),
    ('10014096', 'Lichtsignalanlage Typ D',       'Semáforo provisional tipo D',                 'LE',    NULL,   'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1165, true,  'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10014103', 'Zulage Lichtsignalanlage',      'Suplemento semáforo provisional',             'LE',    NULL,   'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1170, true,  'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10044100', 'Gf-Innenkabel fixieren/verlegen', 'Fijación/tendido de cable interior de fibra', 'm',   1.76,   'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)', NULL, 1175, false, NULL),

    -- Gruppe 11 — Gebührenumlage (durchlaufende Posten) — todas a coste real
    ('10099923', 'Verrechnung geotechnisches Gutachten',              'Liquidación de dictamen geotécnico',                 'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1180, true, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099925', 'Verrechnung Entsorgung kontaminierter Materialien', 'Liquidación de eliminación de material contaminado', 'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1185, true, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099927', 'Verrechnung angeordnete Probenahme',                'Liquidación de toma de muestras ordenada',           'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1190, true, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099955', 'Verrechnung Kampfmittelsondierung',                 'Liquidación de sondeo de municiones (Kampfmittel)',  'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1195, true, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099980', 'Verrechnung Gebührenbescheide',                     'Liquidación de resoluciones de tasas',               'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1200, true, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),

    -- Gruppe 12 — Dokumentation E1
    ('10030211', 'Nachträgliche Dokumentation Hausanschluss in IT-Systemen', 'Documentación posterior de acometida en sistemas IT', 'Stück', 17.27, 'FNS > Gr. 12 Dokumentation E1', NULL, 1205, false, NULL),
    ('10028256', 'Fotodokumentation (MBfD)',                                'Documentación fotográfica (MBfD)',                   'Stück', 7.01,  'FNS > Gr. 12 Dokumentation E1', NULL, 1210, false, NULL),

    -- Gruppe 13 — FTTH – Hausanschluss E1
    ('10030372', 'Tiefbau für Hausanschluss nachträglich', 'Obra civil para acometida posterior', 'Stück', 334.79, 'FNS > Gr. 13 FTTH – Hausanschluss E1', NULL, 1215, false, NULL),

    -- Gruppe 14 — Tiefbau – Steuerbare Horizontalbohrung (HDD)
    ('10010713', 'Vorhaltung HDD-Bohrgerät (steuerbare Horizontalbohrung)', 'Disponibilidad de perforadora HDD',          'Stück', 289.19, 'FNS > Gr. 14 Tiefbau – Steuerbare Horizontalbohrung (HDD)', NULL, 1220, false, NULL),
    ('10010776', 'Steuerbare Horizontalbohrung (HDD) < 125 mm',             'Perforación horizontal dirigida <125 mm',    'm',     26.21,  'FNS > Gr. 14 Tiefbau – Steuerbare Horizontalbohrung (HDD)', NULL, 1225, false, NULL),
    ('10010786', 'Steuerbare Horizontalbohrung (HDD) < 65 mm',              'Perforación horizontal dirigida <65 mm',     'm',     32.90,  'FNS > Gr. 14 Tiefbau – Steuerbare Horizontalbohrung (HDD)', NULL, 1230, false, NULL),
    ('10010806', 'Zulage Bohrung kurze Strecke (< 30 m)',                   'Suplemento perforación tramo corto (<30 m)', 'm',     17.31,  'FNS > Gr. 14 Tiefbau – Steuerbare Horizontalbohrung (HDD)', NULL, 1235, false, NULL)
)
INSERT INTO public.service_items
  (code, description_de, description_es, unit, unit_price, category, detail_form, operator_id, client_id, display_order, active, is_pass_through, notes)
SELECT
  ni.code,
  ni.description_de,
  ni.description_es,
  ni.unit,
  ni.unit_price,
  ni.category,
  ni.detail_form,
  telekom.id,
  fns.id,
  ni.display_order,
  true,
  ni.is_pass_through,
  ni.notes
FROM new_items ni
CROSS JOIN fns
CROSS JOIN telekom
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_items existing
  WHERE existing.code = ni.code
    AND existing.client_id = fns.id
);

COMMIT;
