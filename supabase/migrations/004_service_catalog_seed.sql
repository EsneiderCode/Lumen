-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Service catalog: table + RLS + seed data
-- Source: UMTELKOMD GmbH Resumen de Contratos – Precios Vigentes (PDF)
--   · Insyte Deutschland GmbH NE3 (Rev 6 – 12.08.2025) — 16 price positions
--   · Insyte Deutschland GmbH NE4 MDU (v0 – 24.06.2025) — 21 price positions
--   · Vancom IT GmbH NE4 Rahmenvertrag — 2 price positions
-- Run manually in Supabase SQL Editor.
-- NOTE: Uses pure SQL (CTE-based INSERT) — no PL/pgSQL, works in all contexts.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. TABLE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL,
  description_de TEXT       NOT NULL,
  description_es TEXT,
  unit          TEXT,
  unit_price    NUMERIC(10,2),
  operator_id   UUID        REFERENCES public.operators(id),
  client_id     UUID        REFERENCES public.clients(id),
  detail_form   TEXT CHECK (detail_form IN (
                  'soplado','fusion_ap','fusion_dp','alta','nt','patchkabel','pop'
                )),
  display_order INTEGER     NOT NULL DEFAULT 0,
  active        BOOLEAN     NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_active        ON public.service_items (active);
CREATE INDEX IF NOT EXISTS idx_si_operator      ON public.service_items (operator_id);
CREATE INDEX IF NOT EXISTS idx_si_client        ON public.service_items (client_id);
CREATE INDEX IF NOT EXISTS idx_si_display_order ON public.service_items (display_order);

CREATE TRIGGER handle_si_updated_at
  BEFORE UPDATE ON public.service_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_admin_all" ON public.service_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "si_read_active" ON public.service_items
  FOR SELECT TO authenticated
  USING (
    active = true
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── 3. REFERENCE ROWS ───────────────────────────────────────────────────────
INSERT INTO public.clients (name, code) VALUES
  ('Insyte Deutschland GmbH', 'INSYTE'),
  ('Vancom IT GmbH',          'VANCOM')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.operators (name, code) VALUES
  ('Deutsche Glasfaser',  'DGF'),
  ('Meranet',             'MER'),
  ('GlasfaserPlus',       'GFPLUS'),
  ('GlasfaserNord-West',  'GFNW'),
  ('GVG Glasfaser',       'GVG'),
  ('Westconnect',         'WESTC')
ON CONFLICT (code) DO NOTHING;

-- ─── 4. SEED DATA ────────────────────────────────────────────────────────────
-- Pure-SQL approach: raw data CTE joins operators/clients by code to resolve UUIDs.
-- The WHERE NOT EXISTS guard makes this idempotent (skips if any rows exist).
-- ─────────────────────────────────────────────────────────────────────────────
WITH
  ops AS (
    SELECT code, id FROM public.operators
    WHERE code IN ('DGF','MER','GFPLUS','GFNW','GVG','WESTC')
  ),
  cls AS (
    SELECT code, id FROM public.clients
    WHERE code IN ('INSYTE','VANCOM')
  ),
  raw (code, description_de, description_es, unit, unit_price,
       op_code, cl_code, detail_form, display_order, notes) AS (
    VALUES
    -- ═══ INSYTE NE3 · Rev 6 – 12.08.2025 · display_order 10-99 ═══════════════

    -- ACT — HÜP-GFTA-ONT activation
    ('DGF_ACT_001'::TEXT,    'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung'::TEXT, 'HÜP-GFTA-ONT, Fusión + Activación + Perforación'::TEXT, 'UDS'::TEXT, 230.00::NUMERIC, 'DGF'::TEXT,    'INSYTE'::TEXT, 'alta'::TEXT,      10::INT, NULL::TEXT),
    ('MER_ACT_001',          'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung',       'HÜP-GFTA-ONT, Fusión + Activación + Perforación',       'UDS',       230.00,           'MER',           'INSYTE',        'alta',             10,        NULL),
    ('GFPLUS_ACT_001',       'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung',       'HÜP-GFTA-ONT, Fusión + Activación + Perforación',       'UDS',       230.00,           'GFPLUS',        'INSYTE',        'alta',             10,        NULL),
    ('GFNW_ACT_001',         'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung',       'HÜP-GFTA-ONT, Fusión + Activación + Perforación',       'UDS',       230.00,           'GFNW',          'INSYTE',        'alta',             10,        NULL),
    ('GVG_ACT_001',          'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung',       'HÜP-GFTA-ONT, Fusión + Activación + Perforación',       'UDS',       230.00,           'GVG',           'INSYTE',        'alta',             10,        NULL),

    ('DGF_ACT_003',          'HÜP-GFTA-ONT, Fusion + Bohrung',                     'HÜP-GFTA-ONT, Fusión + Perforación',                     'UDS',       184.00,           'DGF',           'INSYTE',        'alta',             11,        NULL),
    ('MER_ACT_003',          'HÜP-GFTA-ONT, Fusion + Bohrung',                     'HÜP-GFTA-ONT, Fusión + Perforación',                     'UDS',       184.00,           'MER',           'INSYTE',        'alta',             11,        NULL),
    ('GFPLUS_ACT_003',       'HÜP-GFTA-ONT, Fusion + Bohrung',                     'HÜP-GFTA-ONT, Fusión + Perforación',                     'UDS',       184.00,           'GFPLUS',        'INSYTE',        'alta',             11,        NULL),
    ('GFNW_ACT_003',         'HÜP-GFTA-ONT, Fusion + Bohrung',                     'HÜP-GFTA-ONT, Fusión + Perforación',                     'UDS',       184.00,           'GFNW',          'INSYTE',        'alta',             11,        NULL),
    ('GVG_ACT_003',          'HÜP-GFTA-ONT, Fusion + Bohrung',                     'HÜP-GFTA-ONT, Fusión + Perforación',                     'UDS',       184.00,           'GVG',           'INSYTE',        'alta',             11,        NULL),

    ('DGF_ACT_004',          'HÜP-GFTA-ONT, Aktivierungsteil',                     'HÜP-GFTA-ONT, Parte de activación',                      'UDS',        46.00,           'DGF',           'INSYTE',        'alta',             12,        NULL),
    ('MER_ACT_004',          'HÜP-GFTA-ONT, Aktivierungsteil',                     'HÜP-GFTA-ONT, Parte de activación',                      'UDS',        46.00,           'MER',           'INSYTE',        'alta',             12,        NULL),
    ('GFPLUS_ACT_004',       'HÜP-GFTA-ONT, Aktivierungsteil',                     'HÜP-GFTA-ONT, Parte de activación',                      'UDS',        46.00,           'GFPLUS',        'INSYTE',        'alta',             12,        NULL),
    ('GFNW_ACT_004',         'HÜP-GFTA-ONT, Aktivierungsteil',                     'HÜP-GFTA-ONT, Parte de activación',                      'UDS',        46.00,           'GFNW',          'INSYTE',        'alta',             12,        NULL),
    ('GVG_ACT_004',          'HÜP-GFTA-ONT, Aktivierungsteil',                     'HÜP-GFTA-ONT, Parte de activación',                      'UDS',        46.00,           'GVG',           'INSYTE',        'alta',             12,        NULL),

    -- BLOW_001 — Einblasen 6/12/24 Glasfaserkabel (RD) €0.43/ML
    ('DGF_BLOW_001',         'Einblasen 6/12/24 Glasfaserkabel (RD)',               'Soplado cable 6/12/24 fibras (RD)',                       'ML',          0.43,           'DGF',           'INSYTE',        'soplado',          20,        NULL),
    ('MER_BLOW_001',         'Einblasen 6/12/24 Glasfaserkabel (RD)',               'Soplado cable 6/12/24 fibras (RD)',                       'ML',          0.43,           'MER',           'INSYTE',        'soplado',          20,        NULL),
    ('GFPLUS_BLOW_001',      'Einblasen 6/12/24 Glasfaserkabel (RD)',               'Soplado cable 6/12/24 fibras (RD)',                       'ML',          0.43,           'GFPLUS',        'INSYTE',        'soplado',          20,        NULL),
    ('GFNW_BLOW_001',        'Einblasen 6/12/24 Glasfaserkabel (RD)',               'Soplado cable 6/12/24 fibras (RD)',                       'ML',          0.43,           'GFNW',          'INSYTE',        'soplado',          20,        NULL),
    ('GVG_BLOW_001',         'Einblasen 6/12/24 Glasfaserkabel (RD)',               'Soplado cable 6/12/24 fibras (RD)',                       'ML',          0.43,           'GVG',           'INSYTE',        'soplado',          20,        NULL),

    -- BLOW_002 — Einblasen 48/96/144 Glasfaserkabel (RA) €0.62/ML
    ('DGF_BLOW_002',         'Einblasen 48/96/144 Glasfaserkabel (RA)',             'Soplado cable 48/96/144 fibras (RA)',                     'ML',          0.62,           'DGF',           'INSYTE',        'soplado',          21,        NULL),
    ('MER_BLOW_002',         'Einblasen 48/96/144 Glasfaserkabel (RA)',             'Soplado cable 48/96/144 fibras (RA)',                     'ML',          0.62,           'MER',           'INSYTE',        'soplado',          21,        NULL),
    ('GFPLUS_BLOW_002',      'Einblasen 48/96/144 Glasfaserkabel (RA)',             'Soplado cable 48/96/144 fibras (RA)',                     'ML',          0.62,           'GFPLUS',        'INSYTE',        'soplado',          21,        NULL),
    ('GFNW_BLOW_002',        'Einblasen 48/96/144 Glasfaserkabel (RA)',             'Soplado cable 48/96/144 fibras (RA)',                     'ML',          0.62,           'GFNW',          'INSYTE',        'soplado',          21,        NULL),
    ('GVG_BLOW_002',         'Einblasen 48/96/144 Glasfaserkabel (RA)',             'Soplado cable 48/96/144 fibras (RA)',                     'ML',          0.62,           'GVG',           'INSYTE',        'soplado',          21,        NULL),

    -- BLOW_003 — DP-Installation €705/UDS
    ('DGF_BLOW_003',         'DP-Installation (Tray, Routing-Rohre inkl.)',         'Instalación DP (bandeja, tubos incluidos)',                'UDS',        705.00,           'DGF',           'INSYTE',        'fusion_dp',        22,        NULL),
    ('MER_BLOW_003',         'DP-Installation (Tray, Routing-Rohre inkl.)',         'Instalación DP (bandeja, tubos incluidos)',                'UDS',        705.00,           'MER',           'INSYTE',        'fusion_dp',        22,        NULL),
    ('GFPLUS_BLOW_003',      'DP-Installation (Tray, Routing-Rohre inkl.)',         'Instalación DP (bandeja, tubos incluidos)',                'UDS',        705.00,           'GFPLUS',        'INSYTE',        'fusion_dp',        22,        NULL),
    ('GFNW_BLOW_003',        'DP-Installation (Tray, Routing-Rohre inkl.)',         'Instalación DP (bandeja, tubos incluidos)',                'UDS',        705.00,           'GFNW',          'INSYTE',        'fusion_dp',        22,        NULL),
    ('GVG_BLOW_003',         'DP-Installation (Tray, Routing-Rohre inkl.)',         'Instalación DP (bandeja, tubos incluidos)',                'UDS',        705.00,           'GVG',           'INSYTE',        'fusion_dp',        22,        NULL),

    -- BLOW_004 — POP-Installation €1300/UDS (DGF, MER, GFPLUS, GVG — not GFNW)
    ('DGF_BLOW_004',         'POP-Installation + Connecting Trays',                 'Instalación POP + bandejas de conexión',                  'UDS',       1300.00,           'DGF',           'INSYTE',        'pop',              23,        NULL),
    ('MER_BLOW_004',         'POP-Installation + Connecting Trays',                 'Instalación POP + bandejas de conexión',                  'UDS',       1300.00,           'MER',           'INSYTE',        'pop',              23,        NULL),
    ('GFPLUS_BLOW_004',      'POP-Installation + Connecting Trays',                 'Instalación POP + bandejas de conexión',                  'UDS',       1300.00,           'GFPLUS',        'INSYTE',        'pop',              23,        NULL),
    ('GVG_BLOW_004',         'POP-Installation + Connecting Trays',                 'Instalación POP + bandejas de conexión',                  'UDS',       1300.00,           'GVG',           'INSYTE',        'pop',              23,        NULL),

    -- BLOW_204 — POP-Installation GFNW Sonderpreis €2500/UDS
    ('GFNW_BLOW_204',        'POP-Installation + Connecting Trays (GFNW)',          'Instalación POP + bandejas de conexión (GFNW)',           'UDS',       2500.00,           'GFNW',          'INSYTE',        'pop',              23,        'Precio diferenciado GFNW — código BLOW_204'),

    -- CW_204 — Kopflöcher Einblasen (UB) €78/M³
    ('DGF_CW_204',           'Zusätzliche Kopflöcher Einblasen (UB)',               'Pozos de cabeza adicionales soplado (UB)',                 'M3',         78.00,           'DGF',           'INSYTE',        NULL,               30,        NULL),
    ('MER_CW_204',           'Zusätzliche Kopflöcher Einblasen (UB)',               'Pozos de cabeza adicionales soplado (UB)',                 'M3',         78.00,           'MER',           'INSYTE',        NULL,               30,        NULL),
    ('GFPLUS_CW_204',        'Zusätzliche Kopflöcher Einblasen (UB)',               'Pozos de cabeza adicionales soplado (UB)',                 'M3',         78.00,           'GFPLUS',        'INSYTE',        NULL,               30,        NULL),
    ('GFNW_CW_204',          'Zusätzliche Kopflöcher Einblasen (UB)',               'Pozos de cabeza adicionales soplado (UB)',                 'M3',         78.00,           'GFNW',          'INSYTE',        NULL,               30,        NULL),
    ('GVG_CW_204',           'Zusätzliche Kopflöcher Einblasen (UB)',               'Pozos de cabeza adicionales soplado (UB)',                 'M3',         78.00,           'GVG',           'INSYTE',        NULL,               30,        NULL),

    -- CW_205 — Kopflöcher Einblasen (Pflaster) €110/M³
    ('DGF_CW_205',           'Zusätzliche Kopflöcher Einblasen (Pflaster)',         'Pozos de cabeza adicionales soplado (adoquin)',            'M3',        110.00,           'DGF',           'INSYTE',        NULL,               31,        NULL),
    ('MER_CW_205',           'Zusätzliche Kopflöcher Einblasen (Pflaster)',         'Pozos de cabeza adicionales soplado (adoquin)',            'M3',        110.00,           'MER',           'INSYTE',        NULL,               31,        NULL),
    ('GFPLUS_CW_205',        'Zusätzliche Kopflöcher Einblasen (Pflaster)',         'Pozos de cabeza adicionales soplado (adoquin)',            'M3',        110.00,           'GFPLUS',        'INSYTE',        NULL,               31,        NULL),
    ('GFNW_CW_205',          'Zusätzliche Kopflöcher Einblasen (Pflaster)',         'Pozos de cabeza adicionales soplado (adoquin)',            'M3',        110.00,           'GFNW',          'INSYTE',        NULL,               31,        NULL),
    ('GVG_CW_205',           'Zusätzliche Kopflöcher Einblasen (Pflaster)',         'Pozos de cabeza adicionales soplado (adoquin)',            'M3',        110.00,           'GVG',           'INSYTE',        NULL,               31,        NULL),

    -- CW_206 — Kopflöcher Einblasen (Asphalt) €136/M³
    ('DGF_CW_206',           'Zusätzliche Kopflöcher Einblasen (Asphalt)',          'Pozos de cabeza adicionales soplado (asfalto)',            'M3',        136.00,           'DGF',           'INSYTE',        NULL,               32,        NULL),
    ('MER_CW_206',           'Zusätzliche Kopflöcher Einblasen (Asphalt)',          'Pozos de cabeza adicionales soplado (asfalto)',            'M3',        136.00,           'MER',           'INSYTE',        NULL,               32,        NULL),
    ('GFPLUS_CW_206',        'Zusätzliche Kopflöcher Einblasen (Asphalt)',          'Pozos de cabeza adicionales soplado (asfalto)',            'M3',        136.00,           'GFPLUS',        'INSYTE',        NULL,               32,        NULL),
    ('GFNW_CW_206',          'Zusätzliche Kopflöcher Einblasen (Asphalt)',          'Pozos de cabeza adicionales soplado (asfalto)',            'M3',        136.00,           'GFNW',          'INSYTE',        NULL,               32,        NULL),
    ('GVG_CW_206',           'Zusätzliche Kopflöcher Einblasen (Asphalt)',          'Pozos de cabeza adicionales soplado (asfalto)',            'M3',        136.00,           'GVG',           'INSYTE',        NULL,               32,        NULL),

    -- ING_FIX_003 — Hausbegehung individueller POP (global) €36
    ('ING_FIX_003',          'Hausbegehung individueller POP-Bereich',              'Visita domiciliaria zona POP individual',                  'Units',      36.00,           NULL,            'INSYTE',        NULL,               40,        'Codigo compartido DGF/MER/GFPLUS/GFNW/GVG'),

    -- ING_FIX_010 — Hausanschluss Termin (global) €2.60
    ('ING_FIX_010',          'Hausanschluss Termin',                                'Cita conexion domiciliaria',                              'Termin',      2.60,           NULL,            'INSYTE',        NULL,               41,        'Codigo compartido DGF/MER/GFPLUS/GFNW/GVG'),

    -- ING_FIX_011 — POP Komplett-Paket 35-45 €21 (NOT GFPLUS — 4 operators)
    ('ING_FIX_011',          'Hausbegehung POP-Gebiet Komplett-Paket 35-45',        'Visita zona POP paquete completo 35-45',                  'Termin',     21.00,           'DGF',           'INSYTE',        NULL,               42,        NULL),
    ('ING_FIX_011',          'Hausbegehung POP-Gebiet Komplett-Paket 35-45',        'Visita zona POP paquete completo 35-45',                  'Termin',     21.00,           'MER',           'INSYTE',        NULL,               42,        NULL),
    ('ING_FIX_011',          'Hausbegehung POP-Gebiet Komplett-Paket 35-45',        'Visita zona POP paquete completo 35-45',                  'Termin',     21.00,           'GFNW',          'INSYTE',        NULL,               42,        NULL),
    ('ING_FIX_011',          'Hausbegehung POP-Gebiet Komplett-Paket 35-45',        'Visita zona POP paquete completo 35-45',                  'Termin',     21.00,           'GVG',           'INSYTE',        NULL,               42,        NULL),

    -- ING_FIX_012 — Klausel Schutz Überschreitung +45% (global) €33
    ('ING_FIX_012',          'Klausel Schutz Ueberschreitung +45% HBG',            'Clausula proteccion exceso +45% HBG',                     'Termin',     33.00,           NULL,            'INSYTE',        NULL,               43,        'Codigo compartido DGF/MER/GFPLUS/GFNW/GVG'),

    -- ING_FIX_015 — POP Komplett-Paket 35-45 GF+ €26 (GFPLUS only)
    ('ING_FIX_015',          'Hausbegehung POP-Gebiet Komplett-Paket 35-45 GF+',   'Visita zona POP paquete completo 35-45 GF+',              'Termin',     26.00,           'GFPLUS',        'INSYTE',        NULL,               43,        NULL),

    -- ═══ INSYTE NE4 MDU · v0 – 24.06.2025 · display_order 100-199 ════════════
    -- Operators: WESTC (Westconnect) and GFPLUS (GlasfaserPlus) — same prices

    -- MDU_100 — Standard-Ausbau WE €255
    ('WESTC_MDU_100',        'Standard-Ausbau einer Wohn-/Geschaeftseinheit',       'Instalacion estandar de una unidad habitacional',         'Stk',        255.00,           'WESTC',         'INSYTE',        'alta',            100,        NULL),
    ('GFPLUS_MDU_100',       'Standard-Ausbau einer Wohn-/Geschaeftseinheit',       'Instalacion estandar de una unidad habitacional',         'Stk',        255.00,           'GFPLUS',        'INSYTE',        'alta',            100,        NULL),

    -- MDU_101 — Nachträglicher Ausbau €330
    ('WESTC_MDU_101',        'Nachtraeglicher Ausbau einer Wohn-/Geschaeftseinheit','Instalacion posterior de una unidad habitacional',        'Stk',        330.00,           'WESTC',         'INSYTE',        'alta',            101,        NULL),
    ('GFPLUS_MDU_101',       'Nachtraeglicher Ausbau einer Wohn-/Geschaeftseinheit','Instalacion posterior de una unidad habitacional',        'Stk',        330.00,           'GFPLUS',        'INSYTE',        'alta',            101,        NULL),

    -- MDU_110 — Außenmontage / Fassadensteiger €84
    ('WESTC_MDU_110',        'Zusatz Aussenmontage / Fassadensteiger',               'Adicional montaje exterior / escalador de fachada',       'Stk',         84.00,           'WESTC',         'INSYTE',        NULL,              102,        NULL),
    ('GFPLUS_MDU_110',       'Zusatz Aussenmontage / Fassadensteiger',               'Adicional montaje exterior / escalador de fachada',       'Stk',         84.00,           'GFPLUS',        'INSYTE',        NULL,              102,        NULL),

    -- MDU_ST_120 / MDU_120 — Mehraufwand Kabellänge €5.40/M
    ('WESTC_MDU_ST_120',     'Mehraufwand Kabellaenge innerhalb der WE',             'Suplemento longitud de cable dentro de la UH',            'M',           5.40,           'WESTC',         'INSYTE',        NULL,              103,        NULL),
    ('GFPLUS_MDU_120',       'Mehraufwand Kabellaenge innerhalb der WE',             'Suplemento longitud de cable dentro de la UH',            'M',           5.40,           'GFPLUS',        'INSYTE',        NULL,              103,        NULL),

    -- MDU_130 — Mehraufwand Raumhöhe €21
    ('WESTC_MDU_130',        'Mehraufwand Raumhoehe',                               'Suplemento altura de habitacion',                         'Stk',         21.00,           'WESTC',         'INSYTE',        NULL,              104,        NULL),
    ('GFPLUS_MDU_130',       'Mehraufwand Raumhoehe',                               'Suplemento altura de habitacion',                         'Stk',         21.00,           'GFPLUS',        'INSYTE',        NULL,              104,        NULL),

    -- MDU_140 — Mehraufwand Fussbodenheizung €24
    ('WESTC_MDU_140',        'Mehraufwand Fussbodenheizung',                        'Suplemento suelo radiante',                               'Stk',         24.00,           'WESTC',         'INSYTE',        NULL,              105,        NULL),
    ('GFPLUS_MDU_140',       'Mehraufwand Fussbodenheizung',                        'Suplemento suelo radiante',                               'Stk',         24.00,           'GFPLUS',        'INSYTE',        NULL,              105,        NULL),

    -- MDU_150 — Integration bestehender MDU €48
    ('WESTC_MDU_150',        'Integration bestehender MDU',                         'Integracion MDU existente',                               'Stk',         48.00,           'WESTC',         'INSYTE',        NULL,              106,        NULL),
    ('GFPLUS_MDU_150',       'Integration bestehender MDU',                         'Integracion MDU existente',                               'Stk',         48.00,           'GFPLUS',        'INSYTE',        NULL,              106,        NULL),

    -- MDU_160 — Denkmalschutz (nach Angebot)
    ('WESTC_MDU_160',        'Denkmalschutz',                                       'Proteccion de monumento historico',                       'Stk',          NULL,           'WESTC',         'INSYTE',        NULL,              107,        'Preis nach Angebot'),
    ('GFPLUS_MDU_160',       'Denkmalschutz',                                       'Proteccion de monumento historico',                       'Stk',          NULL,           'GFPLUS',        'INSYTE',        NULL,              107,        'Preis nach Angebot'),

    -- MDU_170 — Individuallösung (nach Angebot)
    ('WESTC_MDU_170',        'Individualloesung',                                   'Solucion individual',                                     'LE',           NULL,           'WESTC',         'INSYTE',        NULL,              108,        'Preis nach Angebot'),
    ('GFPLUS_MDU_170',       'Individualloesung',                                   'Solucion individual',                                     'LE',           NULL,           'GFPLUS',        'INSYTE',        NULL,              108,        'Preis nach Angebot'),

    -- MDU_ST_180 / MDU_180 — Brandschutz Stahlkabelkanal €9.60/M
    ('WESTC_MDU_ST_180',     'Mehraufwand Brandschutz (Stahlkabelkanal I 30/60/90)','Suplemento proteccion contra incendios (Stahlkanal)',      'M',           9.60,           'WESTC',         'INSYTE',        NULL,              109,        NULL),
    ('GFPLUS_MDU_180',       'Mehraufwand Brandschutz (Stahlkabelkanal I 30/60/90)','Suplemento proteccion contra incendios (Stahlkanal)',      'M',           9.60,           'GFPLUS',        'INSYTE',        NULL,              109,        NULL),

    -- MDU_ST_185 / MDU_185 — Brandschutz Kabelkanal EI €16/M
    ('WESTC_MDU_ST_185',     'Mehraufwand Brandschutz (Kabelkanal EI 30/60/90)',    'Suplemento proteccion contra incendios (EI-Kanal)',        'M',          16.00,           'WESTC',         'INSYTE',        NULL,              110,        NULL),
    ('GFPLUS_MDU_185',       'Mehraufwand Brandschutz (Kabelkanal EI 30/60/90)',    'Suplemento proteccion contra incendios (EI-Kanal)',        'M',          16.00,           'GFPLUS',        'INSYTE',        NULL,              110,        NULL),

    -- MDU_350 — Erstbegehung ohne MDU-Ausbau €45
    ('WESTC_MDU_350',        'Erstbegehung ohne kuenftigen MDU-Ausbau',             'Primera visita sin futura instalacion MDU',               'Stk',         45.00,           'WESTC',         'INSYTE',        NULL,              111,        NULL),
    ('GFPLUS_MDU_350',       'Erstbegehung ohne kuenftigen MDU-Ausbau',             'Primera visita sin futura instalacion MDU',               'Stk',         45.00,           'GFPLUS',        'INSYTE',        NULL,              111,        NULL),

    -- MDU_200 — ONT-Montage als Zusatzleistung €18
    ('WESTC_MDU_200',        'ONT-Montage als Zusatzleistung',                      'Instalacion ONT como servicio adicional',                 'Stk',         18.00,           'WESTC',         'INSYTE',        'nt',              120,        NULL),
    ('GFPLUS_MDU_200',       'ONT-Montage als Zusatzleistung',                      'Instalacion ONT como servicio adicional',                 'Stk',         18.00,           'GFPLUS',        'INSYTE',        'nt',              120,        NULL),

    -- MDU_210 — ONT-Montage als Einzelmaßnahme €30
    ('WESTC_MDU_210',        'ONT-Montage als Einzelmassnahme',                     'Instalacion ONT como medida individual',                  'Stk',         30.00,           'WESTC',         'INSYTE',        'nt',              121,        NULL),
    ('GFPLUS_MDU_210',       'ONT-Montage als Einzelmassnahme',                     'Instalacion ONT como medida individual',                  'Stk',         30.00,           'GFPLUS',        'INSYTE',        'nt',              121,        NULL),

    -- MDU_220 — CPE-Montage als Zusatzleistung €30
    ('WESTC_MDU_220',        'CPE-Montage als Zusatzleistung',                      'Instalacion CPE como servicio adicional',                 'Stk',         30.00,           'WESTC',         'INSYTE',        'nt',              122,        NULL),
    ('GFPLUS_MDU_220',       'CPE-Montage als Zusatzleistung',                      'Instalacion CPE como servicio adicional',                 'Stk',         30.00,           'GFPLUS',        'INSYTE',        'nt',              122,        NULL),

    -- MDU_230 — CPE-Montage als Einzelmaßnahme €42
    ('WESTC_MDU_230',        'CPE-Montage als Einzelmassnahme',                     'Instalacion CPE como medida individual',                  'Stk',         42.00,           'WESTC',         'INSYTE',        'nt',              123,        NULL),
    ('GFPLUS_MDU_230',       'CPE-Montage als Einzelmassnahme',                     'Instalacion CPE como medida individual',                  'Stk',         42.00,           'GFPLUS',        'INSYTE',        'nt',              123,        NULL),

    -- MDU_300 — Inbound technische Beratung €150
    ('WESTC_MDU_300',        'Inbound - telefonische technische Beratung',           'Consultoria tecnica telefonica inbound',                  'Stk',        150.00,           'WESTC',         'INSYTE',        NULL,              130,        NULL),
    ('GFPLUS_MDU_300',       'Inbound - telefonische technische Beratung',           'Consultoria tecnica telefonica inbound',                  'Stk',        150.00,           'GFPLUS',        'INSYTE',        NULL,              130,        NULL),

    -- MDU_310 — Zusatzbegehung GEE €114
    ('WESTC_MDU_310',        'Zusatzbegehung bei ausstehender GEE',                 'Visita adicional por GEE pendiente',                      'Stk',        114.00,           'WESTC',         'INSYTE',        NULL,              131,        NULL),
    ('GFPLUS_MDU_310',       'Zusatzbegehung bei ausstehender GEE',                 'Visita adicional por GEE pendiente',                      'Stk',        114.00,           'GFPLUS',        'INSYTE',        NULL,              131,        NULL),

    -- MDU_320 — Informationsveranstaltung €330
    ('WESTC_MDU_320',        'Informationsveranstaltung',                            'Jornada informativa',                                     'Stk',        330.00,           'WESTC',         'INSYTE',        NULL,              132,        NULL),
    ('GFPLUS_MDU_320',       'Informationsveranstaltung',                            'Jornada informativa',                                     'Stk',        330.00,           'GFPLUS',        'INSYTE',        NULL,              132,        NULL),

    -- MDU_330 — Werbeaktivitäten €6
    ('WESTC_MDU_330',        'Werbeaktivitaeten',                                    'Actividades de publicidad',                               'Stk',          6.00,           'WESTC',         'INSYTE',        NULL,              133,        NULL),
    ('GFPLUS_MDU_330',       'Werbeaktivitaeten',                                    'Actividades de publicidad',                               'Stk',          6.00,           'GFPLUS',        'INSYTE',        NULL,              133,        NULL),

    -- MDU_340 — Zusatzanfahrt €66
    ('WESTC_MDU_340',        'Zusatzanfahrt',                                        'Desplazamiento adicional',                                'Stk',         66.00,           'WESTC',         'INSYTE',        NULL,              134,        NULL),
    ('GFPLUS_MDU_340',       'Zusatzanfahrt',                                        'Desplazamiento adicional',                                'Stk',         66.00,           'GFPLUS',        'INSYTE',        NULL,              134,        NULL),

    -- ═══ VANCOM IT GmbH NE4 · Rahmenvertrag · display_order 200-299 ═══════════

    -- Pauschale pro installierter WE €295
    ('VANCOM_NE4_WE',
     'Pauschale pro installierter Wohneinheit (HUeP-GFTA-Spleiss-Dokumentation)',
     'Tarifa plana por unidad habitacional instalada (HUeP-GFTA-Empalme-Documentacion)',
     'WE', 295.00, NULL, 'VANCOM', 'alta', 200,
     'Incluye: contacto y cita, desplazamiento, montaje GFTA, tendido HUeP-GFTA incl. empalmes, etiquetado, documentacion completa. Material de red suministrado por Vancom.'),

    -- Pauschale pro NT €15
    ('VANCOM_NE4_NT',
     'Pauschale pro NT (Netzabschluss)',
     'Tarifa plana por NT instalado (terminacion de red)',
     'NT', 15.00, NULL, 'VANCOM', 'nt', 201,
     'Vergutung por cada NT instalado en cliente final.')
  )
INSERT INTO public.service_items
  (code, description_de, description_es, unit, unit_price,
   operator_id, client_id, detail_form, display_order, notes)
SELECT
  r.code,
  r.description_de,
  r.description_es,
  r.unit,
  r.unit_price,
  ops.id   AS operator_id,
  cls.id   AS client_id,
  r.detail_form,
  r.display_order,
  r.notes
FROM raw r
LEFT JOIN ops ON ops.code = r.op_code
JOIN      cls ON cls.code = r.cl_code
WHERE NOT EXISTS (SELECT 1 FROM public.service_items LIMIT 1);
