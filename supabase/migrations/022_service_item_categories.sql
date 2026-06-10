-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Service item categories + NE4 rate card seed
-- Depends on: 021_team_pins.sql
-- Purpose:
--   1. Add a `category` TEXT column to public.service_items (nullable, no default).
--   2. Recreate service_items_public view to include the new column.
--   3. Seed the full NE4 rate card (~55 items) idempotently.
--      INSERT is skipped for codes that already exist; UPDATE sets category
--      where it is still NULL (so re-running is safe).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_items ADD COLUMN IF NOT EXISTS category TEXT;

-- Recreate non-priced view with the new column.
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
WHERE si.active = true;

GRANT SELECT ON public.service_items_public TO authenticated;

-- ── NE4 rate card seed ────────────────────────────────────────────────────────
-- Rows are inserted only when the code does not yet exist.
-- A second CTE pass backfills category where it is still NULL.

WITH new_items (code, description_de, unit, unit_price, category, detail_form, operator_code, client_code, display_order) AS (
  VALUES
    -- NE4 > ONT / Aktivierung (display_order 100–135)
    ('NAS_DGF_ACT_003'::text, 'HÜP-GFTA-ONT, Fusion + Bohrung'::text,                          'Units'::text,  184.00::numeric(10,2), 'NE4 > ONT / Aktivierung'::text,                                    'alta'::text, 'DGF'::text,         NULL::text, 100::int),
    ('NAS_DGF_ACT_004',       'HÜP-GFTA-ONT, Activation Part',                                  'Units',          46.00,               'NE4 > ONT / Aktivierung',                                         'alta',       'DGF',               NULL,       105),
    ('WESTC_MDU_200',         'ONT Montage als Zusatzleistung',                                  'Stück',          18.00,               'NE4 > ONT / Aktivierung',                                         NULL,         'WESTC',             NULL,       110),
    ('WESTC_MDU_210',         'ONT Montage als Einzelmaßnahme',                                  'Stück',          30.00,               'NE4 > ONT / Aktivierung',                                         'alta',       'WESTC',             NULL,       115),
    ('Vancom 200',            'ONT-Montage Zusatzleistung zu Pos. 100/150',                      'Stk',            24.75,               'NE4 > ONT / Aktivierung',                                         NULL,         NULL,                'VANCOM',   120),
    ('Vancom 210',            'ONT-Montage Einzelmaßnahme',                                      'Stk',            41.25,               'NE4 > ONT / Aktivierung',                                         'alta',       NULL,                'VANCOM',   125),
    ('Vancom 220',            'CPE-Konfiguration + Aktivierung Zusatzleistung',                  'Stk',            41.25,               'NE4 > ONT / Aktivierung',                                         NULL,         NULL,                'VANCOM',   130),
    ('Vancom 230',            'CPE-Konfiguration + Aktivierung Einzelmaßnahme',                  'Stk',            57.75,               'NE4 > ONT / Aktivierung',                                         'alta',       NULL,                'VANCOM',   135),

    -- NE4 > Hausanschluss / NAS / acometida cliente (display_order 200–260)
    ('NAS_DGF_GB_001',        'Hausanschluss',                                                   'Units',         290.00,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       200),
    ('NAS_DGF_HBG_001',       'Hausbegehung + Termin Hausbegehung + Dokumentation',              'Units',          60.00,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       205),
    ('NAS_DGF_TERM_001',      'Hausanschluss Termin',                                            'Units',           5.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    NULL,         'DGF',               NULL,       210),
    ('NAS Paket 1',           'ACT_001 + HBG + GB + Termin + OTDR',                             'Psch.',         589.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       215),
    ('NAS Paket 2',           'ACT_003 + Termin + OTDR',                                         'Psch.',         193.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       220),
    ('NAS Paket 3',           'ACT_004 + Termin + OTDR',                                         'Psch.',          55.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       225),
    ('NAS Paket 4',           'HBG + Termin + OTDR + ACT_001',                                  'Psch.',         299.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       230),
    ('NAS Paket 5',           'HBG + GB + Termin + OTDR + ACT_003',                             'Psch.',         543.80,               'NE4 > Hausanschluss / NAS / acometida cliente',                    'alta',       'DGF',               NULL,       235),

    -- NE4 > Altas cliente Deutsche Glasfaser / UGG (display_order 300–350)
    ('DG HAS 0',              'Alta cliente hasta HÜP/ONT, apertura/reposición hueco, pasamuros, HÜP/ONT y fusionado', 'UD', 100.00,   'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'DGF',               NULL,       300),
    ('DG HAS 1',              'Alta cliente con activación y subida en APPEE/Bauinterface',      'UD',            160.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'DGF',               NULL,       305),
    ('DG HAS 2',              'Alta cliente adicional, sólo ONT/GFTA + activación',              'UD',             75.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'DGF',               NULL,       310),
    ('DG PRE HAS 1',          'Alta sin activación del POP, requiere segunda visita',            'UD',            150.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'DGF',               NULL,       315),
    ('UGG HAS 0',             'Alta cliente hasta OTB',                                          'UD',            100.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'UGG',               NULL,       320),
    ('UGG HAS 1',             'Alta cliente con activación y subida en APP UGG',                 'UD',            160.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'UGG',               NULL,       325),
    ('UGG HAS 2',             'Alta cliente adicional, sólo ONT + activación UGG',               'UD',             75.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'UGG',               NULL,       330),
    ('UGG PRE HAS 1',         'Alta sin activación del POP',                                     'UD',            150.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'UGG',               NULL,       335),
    ('UGG 1.1',               'Alta de cliente UGG completo',                                    'GLB',           170.00,               'NE4 > Altas cliente Deutsche Glasfaser / UGG',                    'alta',       'UGG',               NULL,       340),

    -- NE4 > Replanteo / citas / activaciones posteriores (display_order 400–445)
    ('DG HAUSBEGEHUNG',       'Replanteo vivienda según DGF + subida APPEE',                     'UD',             30.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'DGF',               NULL,       400),
    ('DG AKTIVIERUNG',        'Activación posterior, segunda visita por problema ajeno a EC',    'UD',             30.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'DGF',               NULL,       405),
    ('DG CITA HAUSBEGEHUNG',  'Cita telefónica para replanteo',                                  'UD',              1.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'DGF',               NULL,       410),
    ('DG CITA ALTA',          'Cita telefónica para alta',                                       'UD',              2.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'DGF',               NULL,       415),
    ('UGG HAUSBEGEHUNG',      'Replanteo vivienda UGG',                                          'UD',             30.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'UGG',               NULL,       420),
    ('UGG AKTIVIERUNG',       'Activación posterior',                                             'UD',             30.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'UGG',               NULL,       425),
    ('UGG CITA HAUSBEGEHUNG', 'Cita telefónica para replanteo',                                  'UD',              1.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'UGG',               NULL,       430),
    ('UGG CITA ALTA',         'Cita telefónica para alta',                                       'UD',              2.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'UGG',               NULL,       435),
    ('UGG 1.5',               'Replanteo de vivienda con subida APP',                            'h',              50.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'UGG',               NULL,       440),
    ('UGG 1.6',               'Activación posterior de servicio',                                'h',              60.00,               'NE4 > Replanteo / citas / activaciones posteriores',              'alta',       'UGG',               NULL,       441),
    ('UGG 1.8',               'Cita telefónica replanteo',                                       'UD',              1.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'UGG',               NULL,       442),
    ('UGG 1.9',               'Cita telefónica activaciones',                                    'UD',              2.50,               'NE4 > Replanteo / citas / activaciones posteriores',              NULL,         'UGG',               NULL,       443),

    -- NE4 > Suplementos / Mehraufwand (display_order 500–560)
    ('WESTC_MDU_130',         'Mehraufwand Raumhöhe über 2,65 m',                                'Stück',          21.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'WESTC',             NULL,       500),
    ('WESTC_MDU_ST_120',      'Mehraufwand Kabellänge innerhalb der WE',                         'Meter',           5.40,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'WESTC',             NULL,       505),
    ('WESTC_MDU_ST_180',      'Mehraufwand Brandschutzmaßnahmen',                                'Meter',           9.60,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'WESTC',             NULL,       510),
    ('Vancom 110',            'Mehraufwand Außenmontage / Fassadensteiger ab 3. Etage',           'Stk/WE',        115.50,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   515),
    ('Vancom 120',            'Mehraufwand Kabellänge innerhalb der WE',                         'Meter',           7.43,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   520),
    ('Vancom 130',            'Mehraufwand Raumhöhe über 2,65 m',                                'Stk',            28.88,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   525),
    ('Vancom 140',            'Mehraufwand Fußbodenheizung',                                     'Stk',            33.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   530),
    ('Vancom 150',            'Integration bestehender NE4, Messung und Dokumentation',          'Stk/WE',         66.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   535),
    ('Vancom 160',            'Denkmalschutz',                                                    'Stk',   NULL::numeric(10,2),          'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   540),
    ('Vancom 170',            'Individuallösung, Industrie/Büro',                                'LE',    NULL::numeric(10,2),          'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   545),
    ('Vancom 180',            'Brandschutz, Stahlkabelkanal I 30/60/90',                         'Meter',          13.20,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   550),
    ('Vancom 185',            'Brandschutz, Kabelkanal EI 30/60/90',                             'Meter',          22.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         NULL,                'VANCOM',   555),
    ('UGG SUPL. CABLE',       'Suplemento extensión cableado OTB-ONT, 1 extra/10 m',             'UD',              9.75,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'UGG',               NULL,       556),
    ('UGG SUPL. ROUTER',      'Instalación adicional de router',                                 'UD',             13.80,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'UGG',               NULL,       557),
    ('NAS_DGF_CW_013',        'Mehrmeter ab 18 m',                                               'ML',             19.60,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'DGF',               NULL,       558),
    ('NAS_DGF_CW_013_PFL',    'Mehrmeter ab 18 m, Pflaster',                                    'ML',             38.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'DGF',               NULL,       559),
    ('NAS extra',             'Mehrmeter ab 18 m, Beton',                                        'ML',             48.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'DGF',               NULL,       560),
    ('NAS_DGF_BAUM',          'Handschachtung Bäume',                                            'ML',             72.00,               'NE4 > Suplementos / Mehraufwand',                                 NULL,         'DGF',               NULL,       565)
)
INSERT INTO public.service_items
  (code, description_de, unit, unit_price, category, detail_form, operator_id, client_id, display_order, active)
SELECT
  ni.code,
  ni.description_de,
  ni.unit,
  ni.unit_price,
  ni.category,
  ni.detail_form::text,
  o.id,
  c.id,
  ni.display_order,
  true
FROM new_items ni
LEFT JOIN public.operators o ON o.code = ni.operator_code
LEFT JOIN public.clients   c ON c.code = ni.client_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_items si WHERE si.code = ni.code
);

-- Backfill category for any rows that were inserted before this migration
-- and still have category IS NULL.
WITH cats (code, category) AS (
  VALUES
    ('NAS_DGF_ACT_003'::text,     'NE4 > ONT / Aktivierung'::text),
    ('NAS_DGF_ACT_004',           'NE4 > ONT / Aktivierung'),
    ('WESTC_MDU_200',             'NE4 > ONT / Aktivierung'),
    ('WESTC_MDU_210',             'NE4 > ONT / Aktivierung'),
    ('Vancom 200',                'NE4 > ONT / Aktivierung'),
    ('Vancom 210',                'NE4 > ONT / Aktivierung'),
    ('Vancom 220',                'NE4 > ONT / Aktivierung'),
    ('Vancom 230',                'NE4 > ONT / Aktivierung'),
    ('NAS_DGF_GB_001',            'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS_DGF_HBG_001',          'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS_DGF_TERM_001',         'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS Paket 1',               'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS Paket 2',               'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS Paket 3',               'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS Paket 4',               'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('NAS Paket 5',               'NE4 > Hausanschluss / NAS / acometida cliente'),
    ('DG HAS 0',                  'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('DG HAS 1',                  'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('DG HAS 2',                  'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('DG PRE HAS 1',              'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('UGG HAS 0',                 'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('UGG HAS 1',                 'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('UGG HAS 2',                 'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('UGG PRE HAS 1',             'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('UGG 1.1',                   'NE4 > Altas cliente Deutsche Glasfaser / UGG'),
    ('DG HAUSBEGEHUNG',           'NE4 > Replanteo / citas / activaciones posteriores'),
    ('DG AKTIVIERUNG',            'NE4 > Replanteo / citas / activaciones posteriores'),
    ('DG CITA HAUSBEGEHUNG',      'NE4 > Replanteo / citas / activaciones posteriores'),
    ('DG CITA ALTA',              'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG HAUSBEGEHUNG',          'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG AKTIVIERUNG',           'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG CITA HAUSBEGEHUNG',     'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG CITA ALTA',             'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG 1.5',                   'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG 1.6',                   'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG 1.8',                   'NE4 > Replanteo / citas / activaciones posteriores'),
    ('UGG 1.9',                   'NE4 > Replanteo / citas / activaciones posteriores'),
    ('WESTC_MDU_130',             'NE4 > Suplementos / Mehraufwand'),
    ('WESTC_MDU_ST_120',          'NE4 > Suplementos / Mehraufwand'),
    ('WESTC_MDU_ST_180',          'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 110',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 120',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 130',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 140',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 150',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 160',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 170',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 180',                'NE4 > Suplementos / Mehraufwand'),
    ('Vancom 185',                'NE4 > Suplementos / Mehraufwand'),
    ('UGG SUPL. CABLE',           'NE4 > Suplementos / Mehraufwand'),
    ('UGG SUPL. ROUTER',          'NE4 > Suplementos / Mehraufwand'),
    ('NAS_DGF_CW_013',            'NE4 > Suplementos / Mehraufwand'),
    ('NAS_DGF_CW_013_PFL',        'NE4 > Suplementos / Mehraufwand'),
    ('NAS extra',                 'NE4 > Suplementos / Mehraufwand'),
    ('NAS_DGF_BAUM',              'NE4 > Suplementos / Mehraufwand')
)
UPDATE public.service_items si
SET    category = cats.category
FROM   cats
WHERE  si.code = cats.code
  AND  si.category IS NULL;
