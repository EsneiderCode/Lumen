-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 063 — Seed del catálogo de servicios FNS (LV Gernsheim GSW-SUB)
-- Depends on: 062_compliance_review_assignee.sql
-- Purpose:
--   Carga las 48 posiciones contratadas con FNS Infrastruktur GmbH (cliente
--   'FNS', migración 061) en public.service_items. Fuente: lista de precios
--   firmada del LV Gernsheim GSW-SUB (27.07.2026), precios netos en EUR.
--
--   Reglas del contrato:
--   * Posiciones 'LE' (Leistungseinheit) son durchlaufende Positionen: se
--     liquidan a coste real (nach tatsächlichem Aufwand) y NO llevan precio
--     unitario — unit_price queda NULL y la nota lo documenta. Nunca inventar
--     ni interpolar precios (regla dura del spec de catálogo por cliente).
--   * Material y Entsorgung los aporta el Auftraggeber (FNS), por eso las
--     posiciones son solo mano de obra/equipo.
--
--   Estructura: category = grupo del LV Telekom ('FNS > Gr. 01 Planung' …
--   'FNS > Gr. 14 Tiefbau HDD'), display_order 1000–1235 (rango propio de FNS,
--   por encima del catálogo NE4 existente que termina en 565).
--
--   detail_form solo se asigna donde el mapeo a un formulario de captura
--   existente es inequívoco (Einblasarbeiten → soplado, Gf-Hausanschluss →
--   alta). El resto queda NULL (posición suplementaria / obra civil sin
--   formulario propio todavía), igual que las Zulagen del seed de la 022.
--
--   Idempotente: service_items.code no tiene UNIQUE, así que se protege con
--   WHERE NOT EXISTS sobre (code, client_id) — re-ejecutar no duplica filas.
-- ─────────────────────────────────────────────────────────────────────────────

WITH fns AS (
  SELECT id FROM public.clients WHERE code = 'FNS'
),
telekom AS (
  SELECT id FROM public.operators WHERE code = 'TELEKOM'
),
new_items (code, description_de, description_es, unit, unit_price, category, detail_form, display_order, notes) AS (
  VALUES
    -- Gr. 01 — Planung
    ('10030200'::text, 'Projektierung und Planung'::text, 'Proyección y planificación'::text, 'm'::text, 2.07::numeric(10,2), 'FNS > Gr. 01 Planung'::text, NULL::text, 1000::int, NULL::text),

    -- Gr. 02 — Dokumentation
    ('10030210', 'Dokumentation in IT-Systemen', 'Documentación en sistemas informáticos', 'm', 0.49, 'FNS > Gr. 02 Dokumentation', NULL, 1005, NULL),

    -- Gr. 03 — Tiefbau (Graben)
    ('10030300', 'Tiefbauarbeiten',                            'Obra civil (zanja)',                          'm',     23.28,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1010, NULL),
    ('10030302', 'Oberfläche aus Pflaster/Platten',            'Superficie de adoquín/losas',                 'm',     26.35,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1015, NULL),
    ('10030303', 'Oberfläche aus Asphalt/Beton',               'Superficie de asfalto/hormigón',              'm',     50.90,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1020, NULL),
    ('10030304', 'Oberfläche aus Kopfstein-/Mosaikpflaster',   'Superficie de adoquín de piedra/mosaico',     'm',     28.19,  'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1025, NULL),
    ('10030320', 'Aufbau Gehäuse',                             'Montaje de armario (Gehäuse)',                'Stück', 564.03, 'FNS > Gr. 03 Tiefbau (Graben)', NULL, 1030, NULL),

    -- Gr. 04 — Kabelzug/Einblasung
    ('10030340', 'Einzieh- und Einblasarbeiten für SNR(V)',    'Tendido y soplado de SNR(V)',                 'm',     1.88,   'FNS > Gr. 04 Kabelzug/Einblasung', 'soplado', 1035, NULL),
    ('10030341', 'Einblasarbeiten für Gf-Kabel',               'Soplado de cable de fibra óptica',            'm',     0.77,   'FNS > Gr. 04 Kabelzug/Einblasung', 'soplado', 1040, NULL),

    -- Gr. 05 — Gf-Montage
    ('10030348', 'Montagearbeiten an Glasfaserkomponenten',    'Trabajos de montaje en componentes de fibra', 'Stück', 3.66,   'FNS > Gr. 05 Gf-Montage', NULL, 1045, NULL),

    -- Gr. 06 — FTTH Hausanschluss
    ('10030360', 'Gf-Hausanschluss komplett herstellen',       'Acometida de fibra completa',                 'Stück', 388.75, 'FNS > Gr. 06 FTTH Hausanschluss', 'alta', 1050, NULL),
    ('10030362', 'Gf-Hausanschluss nur SNR',                   'Acometida de fibra solo SNR',                 'Stück', 228.06, 'FNS > Gr. 06 FTTH Hausanschluss', 'alta', 1055, NULL),
    ('10030364', 'Zulage Hausanschluss >1 m',                  'Suplemento acometida >1 m',                   'm',     33.07,  'FNS > Gr. 06 FTTH Hausanschluss', NULL,   1060, NULL),
    ('10030366', 'Gf-Hausanschluss für Grenzbebauung',         'Acometida de fibra en edificación en linde',  'Stück', 399.19, 'FNS > Gr. 06 FTTH Hausanschluss', 'alta', 1065, NULL),
    ('10030368', 'Gf-Hausanschl. einblasen und montieren',     'Acometida: soplado y montaje',                'Stück', 218.45, 'FNS > Gr. 06 FTTH Hausanschluss', 'alta', 1070, NULL),
    ('10030370', 'HP-Plus initial im Rollout',                 'HP-Plus inicial en rollout',                  'Stück', 44.63,  'FNS > Gr. 06 FTTH Hausanschluss', NULL,   1075, NULL),

    -- Gr. 07 — NE4 Gebäudeverkabelung
    ('10030100', 'NE4 – Sternverkabelung',                     'NE4 – cableado en estrella',                          'Stück', 141.42, 'FNS > Gr. 07 NE4 Gebäudeverkabelung', NULL, 1080, NULL),
    ('10030103', 'NE4 – Verkabelung mit Gf-Konzentrationspunkt', 'NE4 – cableado con punto de concentración de fibra', 'Stück', 89.22,  'FNS > Gr. 07 NE4 Gebäudeverkabelung', NULL, 1085, NULL),
    ('10030105', 'Zulage Montage Gf-TA',                       'Suplemento montaje de roseta óptica (Gf-TA)',         'Stück', 100.11, 'FNS > Gr. 07 NE4 Gebäudeverkabelung', NULL, 1090, NULL),
    ('10030107', 'Zusätzliche Gf-Spleiße (MFH)',               'Empalmes de fibra adicionales (MFH)',                 'Stück', 8.26,   'FNS > Gr. 07 NE4 Gebäudeverkabelung', NULL, 1095, NULL),
    ('10034243', 'Erweiterte Trasse mit Gf-TA (EFH)',          'Traza ampliada con Gf-TA (EFH)',                      'Stück', 21.01,  'FNS > Gr. 07 NE4 Gebäudeverkabelung', NULL, 1100, NULL),

    -- Gr. 08 — Tiefbau E1 (Zulagen)
    ('10030325', 'Reststreifen/Mehrbreite Pflaster/Platten',   'Franja restante/sobreancho adoquín/losas',            'm²', 23.63, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1105, NULL),
    ('10030326', 'Reststreifen/Mehrbreite Asphalt/Beton',      'Franja restante/sobreancho asfalto/hormigón',         'm²', 51.00, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1110, NULL),
    ('10030327', 'Reststreifen/Mehrbr. Kopfstein-/Mosaikpfl.', 'Franja restante/sobreancho adoquín piedra/mosaico',   'm²', 49.69, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1115, NULL),
    ('10030330', 'Mehrtiefe je 15 cm',                         'Sobreprofundidad por cada 15 cm',                     'm',  3.60,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1120, NULL),
    ('10030332', 'Mehrbreite je 15 cm',                        'Sobreancho por cada 15 cm',                           'm',  3.70,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1125, NULL),
    ('10030335', 'Mehrdicke Asphalt/Beton je 4 cm',            'Sobreespesor asfalto/hormigón por cada 4 cm',         'm²', 9.08,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1130, NULL),
    ('10030337', 'Gebundene Tragschicht für Gräben',           'Capa portante ligada para zanjas',                    'm',  13.66, 'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1135, NULL),
    ('10030339', 'Tiefbaukosten in Bdkl 7',                    'Obra civil en clase de suelo 7',                      'm',  7.26,  'FNS > Gr. 08 Tiefbau E1 (Zulagen)', NULL, 1140, NULL),

    -- Gr. 09 — Einblasung E1
    ('10030344', 'Rohrschäden instandsetzen',                  'Reparación de daños en tubos',                        'Stück', 466.47, 'FNS > Gr. 09 Einblasung E1', NULL, 1145, NULL),

    -- Gr. 10 — Verkehrssicherung
    ('10081334', 'Einsatz Saugbagger',                         'Empleo de excavadora de succión',                     'LE',    NULL::numeric(10,2), 'FNS > Gr. 10 Verkehrssicherung', NULL, 1150, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10014083', 'Lichtsignalanlage betreiben',                'Operación de semáforo provisional',                   'Stück', 45.13,  'FNS > Gr. 10 Verkehrssicherung', NULL, 1155, NULL),
    ('10014094', 'Lichtsignalanlage Typ A bis C',              'Semáforo provisional tipo A a C',                     'Stück', 162.38, 'FNS > Gr. 10 Verkehrssicherung', NULL, 1160, NULL),
    ('10014096', 'Lichtsignalanlage Typ D',                    'Semáforo provisional tipo D',                         'LE',    NULL,   'FNS > Gr. 10 Verkehrssicherung', NULL, 1165, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10014103', 'Zulage Lichtsignalanlage',                   'Suplemento semáforo provisional',                     'LE',    NULL,   'FNS > Gr. 10 Verkehrssicherung', NULL, 1170, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10044100', 'Gf-Innenkabel fixieren/verlegen',            'Fijación/tendido de cable interior de fibra',         'm',     1.76,   'FNS > Gr. 10 Verkehrssicherung', NULL, 1175, NULL),

    -- Gr. 11 — Gebührenumlage (todas LE — coste real)
    ('10099923', 'Verrechnung geotechn. Gutachten',            'Liquidación de dictamen geotécnico',                  'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1180, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099925', 'Verrechnung Entsorgung kontam. Material',    'Liquidación de eliminación de material contaminado',  'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1185, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099927', 'Verrechnung angeordnete Probenahme',         'Liquidación de toma de muestras ordenada',            'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1190, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099955', 'Verrechnung Kampfmittelsondierung',          'Liquidación de sondeo de municiones (Kampfmittel)',   'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1195, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),
    ('10099980', 'Verrechnung Gebührenbescheide',              'Liquidación de resoluciones de tasas',                'LE', NULL, 'FNS > Gr. 11 Gebührenumlage', NULL, 1200, 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand'),

    -- Gr. 12 — Dokumentation E1
    ('10030211', 'Nachträgl. Hausanschluss-Doku in IT-Systemen', 'Documentación posterior de acometida en sistemas IT', 'Stück', 17.27, 'FNS > Gr. 12 Dokumentation E1', NULL, 1205, NULL),
    ('10028256', 'Fotodokumentation (MBfD)',                   'Documentación fotográfica (MBfD)',                    'Stück', 7.01,  'FNS > Gr. 12 Dokumentation E1', NULL, 1210, NULL),

    -- Gr. 13 — FTTH HA E1
    ('10030372', 'Tiefbau für Hausanschluss nachträglich',     'Obra civil para acometida posterior',                 'Stück', 334.79, 'FNS > Gr. 13 FTTH HA E1', NULL, 1215, NULL),

    -- Gr. 14 — Tiefbau HDD
    ('10010713', 'Vorhaltung HDD-Bohrgerät',                   'Disponibilidad de perforadora HDD',                   'Stück', 289.19, 'FNS > Gr. 14 Tiefbau HDD', NULL, 1220, NULL),
    ('10010776', 'Steuerbare Horizontalbohrung <125 mm',       'Perforación horizontal dirigida <125 mm',             'm',     26.21,  'FNS > Gr. 14 Tiefbau HDD', NULL, 1225, NULL),
    ('10010786', 'Steuerbare Horizontalbohrung <65 mm',        'Perforación horizontal dirigida <65 mm',              'm',     32.90,  'FNS > Gr. 14 Tiefbau HDD', NULL, 1230, NULL),
    ('10010806', 'Zulage Bohrung Kurzstrecke (<30 m)',         'Suplemento perforación tramo corto (<30 m)',          'm',     17.31,  'FNS > Gr. 14 Tiefbau HDD', NULL, 1235, NULL)
)
INSERT INTO public.service_items
  (code, description_de, description_es, unit, unit_price, category, detail_form, operator_id, client_id, display_order, active, notes)
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
  ni.notes
FROM new_items ni
CROSS JOIN fns
LEFT JOIN telekom ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_items existing
  WHERE existing.code = ni.code
    AND existing.client_id = fns.id
);
