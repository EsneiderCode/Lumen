-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — Seed: document catalog + initial requirement matrix
-- Depends on: 043_compliance_aptitude.sql
-- Purpose:
--   Preload document_types (i18n es/de/en) and the full requirement matrix:
--     §3.1/3.2 Spanish company posted to Germany (company + worker level)
--     §3.3     Spanish freelancer (Embassy checklist, incl. hires_workers case)
--     §3.4     German company / freelancer (+ their workers)
--     §3.5     Other-EU mirror of the Spanish case
--     §3.6     Third-country entities / non-EU nationals (Vander Elst)
--     §3.7     Internal employees
--   Everything here is DATA — Administration can edit it later from the matrix
--   configurator without touching code.
-- Conventions:
--   - Clearance certificates (corriente de pago) default to 90 days validity
--     from issue date; adjustable per row.
--   - Freistellungsbescheinigung §48b is OPTIONAL (does not block aptitude)
--     but carries on_missing_action = 'notify_billing_withholding' → billing
--     must withhold the 15% Bauabzugsteuer while it is missing/unapproved.
--   - Worker registration with the Zoll is covered by the company-level
--     Meldeportal notification (which includes the worker roster), so it is
--     not a separate worker-level document.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Document catalog ─────────────────────────────────────────────────────────

INSERT INTO public.document_types (code, name_i18n, metadata_schema) VALUES
  ('subcontractor_agreement',      '{"es":"Contrato de subcontratación firmado","de":"Unterschriebener Nachunternehmervertrag","en":"Signed subcontractor agreement"}', '[]'),
  ('rc_insurance',                 '{"es":"Seguro de responsabilidad civil","de":"Betriebshaftpflichtversicherung","en":"Liability insurance"}', '[{"key":"amount","type":"number"},{"key":"reference_number","type":"text"}]'),
  ('ss_clearance_national',        '{"es":"Certificado de corriente de pago de la Seguridad Social (país de origen)","de":"Unbedenklichkeitsbescheinigung der Sozialversicherung (Herkunftsland)","en":"Social security clearance certificate (home country)"}', '[]'),
  ('unbedenklichkeit_finanzamt',   '{"es":"Certificado de aptitud fiscal del Finanzamt (Unb FA)","de":"Unbedenklichkeitsbescheinigung des Finanzamts","en":"German tax office clearance (Unb FA)"}', '[]'),
  ('milog_declaration',            '{"es":"Declaración de cumplimiento del salario mínimo (MiLoG)","de":"MiLoG-Verpflichtungserklärung","en":"MiLoG minimum wage compliance declaration"}', '[]'),
  ('business_registration',        '{"es":"Registro mercantil / alta de actividad","de":"Handelsregisterauszug bzw. Gewerbeanmeldung","en":"Business / commercial registration"}', '[]'),
  ('accident_insurance_clearance', '{"es":"Corriente de pago de la mutua de accidentes","de":"Unbedenklichkeitsbescheinigung der Berufsgenossenschaft","en":"Accident insurance clearance (BG / mutua)"}', '[]'),
  ('site_manager_appointment',     '{"es":"Nombramiento del responsable de obra (formato oficial)","de":"Benennung des Bauleiters (offizielles Formular)","en":"Site manager appointment (official form)"}', '[]'),
  ('zoll_meldeportal_notification','{"es":"Notificación previa en el Meldeportal-Mindestlohn (Zoll), con listado de trabajadores","de":"Anmeldung im Meldeportal-Mindestlohn (Zoll) inkl. Mitarbeiterliste","en":"Meldeportal-Mindestlohn (customs) prior notification incl. worker roster"}', '[]'),
  ('soka_bau_clearance',           '{"es":"SOKA-BAU: alta y corriente de pago","de":"SOKA-BAU Unbedenklichkeitsbescheinigung","en":"SOKA-BAU registration and clearance"}', '[]'),
  ('wage_payment_proof',           '{"es":"Justificantes de pago del salario (bajo demanda)","de":"Lohnzahlungsnachweise (auf Anforderung)","en":"Wage payment proofs (on demand)"}', '[]'),
  ('ust_id_confirmation',          '{"es":"Confirmación USt-IdNr. / Reverse-Charge §13b","de":"USt-IdNr.-Bestätigung / Reverse-Charge §13b","en":"VAT ID confirmation / §13b reverse charge"}', '[]'),
  ('a1_certificate',               '{"es":"Certificado A1","de":"A1-Bescheinigung","en":"A1 certificate"}', '[{"key":"reference_number","type":"text"}]'),
  ('id_document',                  '{"es":"Documento de identidad o pasaporte","de":"Ausweis oder Reisepass","en":"ID document or passport"}', '[]'),
  ('employment_contract',          '{"es":"Contrato laboral","de":"Arbeitsvertrag","en":"Employment contract"}', '[]'),
  ('prl_training',                 '{"es":"Formación en prevención de riesgos laborales (por oficio)","de":"Arbeitsschutz-Unterweisung (gewerkspezifisch)","en":"Occupational safety training (trade-specific)"}', '[]'),
  ('first_aid_course',             '{"es":"Curso de primeros auxilios","de":"Erste-Hilfe-Kurs","en":"First aid course"}', '[]'),
  ('site_risk_training',           '{"es":"Formación/evaluación de riesgos de la obra","de":"Baustellenbezogene Unterweisung","en":"Site-specific risk training"}', '[]'),
  ('s1_certificate',               '{"es":"Formulario S1 (INSS)","de":"S1-Bescheinigung","en":"S1 form"}', '[]'),
  ('ehic_card',                    '{"es":"Tarjeta Sanitaria Europea","de":"Europäische Krankenversicherungskarte (EHIC)","en":"European Health Insurance Card"}', '[]'),
  ('aeat_clearance',               '{"es":"Certificado de corriente de pago AEAT","de":"Unbedenklichkeitsbescheinigung des spanischen Finanzamts (AEAT)","en":"Spanish tax agency (AEAT) clearance"}', '[]'),
  ('freelancer_registration',      '{"es":"Alta censal de autónomo (036/037 o recibo RETA)","de":"Anmeldung als Selbstständiger (Formular 036/037 bzw. RETA-Nachweis)","en":"Freelancer registration (036/037 or RETA receipt)"}', '[]'),
  ('handwerk_recognition',         '{"es":"Reconocimiento de oficio regulado (Handwerkskammer)","de":"Eintragung in die Handwerksrolle bzw. Anerkennung der Handwerkskammer","en":"Regulated trade recognition (Handwerkskammer)"}', '[]'),
  ('residence_registration',       '{"es":"Justificante de trámites de residencia","de":"Meldebescheinigung bzw. Aufenthaltsnachweis","en":"Residence registration proof"}', '[]'),
  ('krankenkasse_s1_submission',   '{"es":"Justificante de presentación del S1 en la Krankenkasse","de":"Nachweis der S1-Vorlage bei der Krankenkasse","en":"Proof of S1 submission to the Krankenkasse"}', '[]'),
  ('freistellung_48b',             '{"es":"Freistellungsbescheinigung §48b EStG","de":"Freistellungsbescheinigung §48b EStG","en":"§48b EStG exemption certificate"}', '[]'),
  ('unbedenklichkeit_krankenkasse','{"es":"Unbedenklichkeitsbescheinigung de la Krankenkasse","de":"Unbedenklichkeitsbescheinigung der Krankenkasse","en":"Health insurance clearance certificate"}', '[]'),
  ('sozialversicherungsausweis',   '{"es":"Alta en la seguridad social alemana (Sozialversicherungsausweis)","de":"Sozialversicherungsausweis","en":"German social insurance card"}', '[]'),
  ('work_permit_vander_elst',      '{"es":"Permiso de trabajo/residencia o visado Vander Elst","de":"Arbeits-/Aufenthaltserlaubnis bzw. Vander-Elst-Visum","en":"Work/residence permit or Vander Elst visa"}', '[]'),
  ('medical_checkup',              '{"es":"Reconocimiento médico laboral","de":"Arbeitsmedizinische Vorsorgeuntersuchung","en":"Occupational medical checkup"}', '[]'),
  ('ppe_record',                   '{"es":"Registro de entrega de EPIs","de":"PSA-Ausgabenachweis","en":"PPE handover record"}', '[]')
ON CONFLICT (code) DO NOTHING;

-- 2) Requirement matrix ───────────────────────────────────────────────────────
-- Column order: code, applies_to, origin, scope, mandatory, conditions,
--               validity_rule, validity_days, min_amount, coverage_confirm,
--               on_missing_action, notes

INSERT INTO public.document_requirements
  (document_type_id, applies_to, origin, scope, is_mandatory, conditions,
   validity_rule, validity_days, min_amount, requires_coverage_confirmation,
   on_missing_action, notes)
SELECT
  dt.id,
  v.applies_to::public.compliance_entity_kind,
  v.origin::public.requirement_origin,
  v.scope::public.requirement_scope,
  v.mandatory,
  v.conditions::jsonb,
  v.validity_rule::public.document_validity_rule,
  v.validity_days,
  v.min_amount,
  v.coverage,
  v.on_missing,
  v.notes
FROM (VALUES
  -- ══ §3.1 COMPANY / ES (empresa española desplazada) ═══════════════════════
  ('rc_insurance',                 'company', 'ES', 'entity',      true,  '{}', 'expiry_required', NULL::int, 200000::numeric, true,  NULL, 'Debe acreditar que cubre obras en Alemania'),
  ('ss_clearance_national',        'company', 'ES', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Corriente de pago TGSS'),
  ('unbedenklichkeit_finanzamt',   'company', 'ES', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('milog_declaration',            'company', 'ES', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Acorde a la categoría profesional; plantilla'),
  ('business_registration',        'company', 'ES', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Registro Mercantil o alta IAE'),
  ('accident_insurance_clearance', 'company', 'ES', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Mutua de accidentes'),
  ('site_manager_appointment',     'company', 'ES', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Formato oficial descargable'),
  ('zoll_meldeportal_notification','company', 'ES', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Por obra y periodo; incluye alta de cada trabajador'),
  ('soka_bau_clearance',           'company', 'ES', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Obligatoria también para empresas desplazadas'),
  ('wage_payment_proof',           'company', 'ES', 'entity',      false, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Disponible a requerimiento'),
  ('subcontractor_agreement',      'company', 'ES', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('ust_id_confirmation',          'company', 'ES', 'entity',      false, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Reverse-Charge §13b'),

  -- ══ §3.5 COMPANY / EU_OTHER (espejo del caso español) ═════════════════════
  ('rc_insurance',                 'company', 'EU_OTHER', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, true,  NULL, 'Debe acreditar que cubre obras en Alemania'),
  ('ss_clearance_national',        'company', 'EU_OTHER', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Seguridad social nacional'),
  ('unbedenklichkeit_finanzamt',   'company', 'EU_OTHER', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('milog_declaration',            'company', 'EU_OTHER', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('business_registration',        'company', 'EU_OTHER', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Registro mercantil / censo de actividad nacional'),
  ('accident_insurance_clearance', 'company', 'EU_OTHER', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('site_manager_appointment',     'company', 'EU_OTHER', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('zoll_meldeportal_notification','company', 'EU_OTHER', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('soka_bau_clearance',           'company', 'EU_OTHER', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('wage_payment_proof',           'company', 'EU_OTHER', 'entity',      false, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Disponible a requerimiento'),
  ('subcontractor_agreement',      'company', 'EU_OTHER', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('ust_id_confirmation',          'company', 'EU_OTHER', 'entity',      false, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),

  -- ══ §3.4 COMPANY / DE ═════════════════════════════════════════════════════
  ('business_registration',        'company', 'DE', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Gewerbeanmeldung o extracto del Handelsregister'),
  ('freistellung_48b',             'company', 'DE', 'entity',      false, '{}', 'expiry_required', NULL, NULL, false, 'notify_billing_withholding', 'Sin ella: retención 15% Bauabzugsteuer'),
  ('unbedenklichkeit_finanzamt',   'company', 'DE', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('unbedenklichkeit_krankenkasse','company', 'DE', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('accident_insurance_clearance', 'company', 'DE', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'BG BAU'),
  ('soka_bau_clearance',           'company', 'DE', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('rc_insurance',                 'company', 'DE', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, false, NULL, 'Betriebshaftpflicht'),
  ('handwerk_recognition',         'company', 'DE', 'entity',      true,  '{"regulated_trade": true}', 'no_expiry', NULL, NULL, false, NULL, 'Handwerkskarte / Handwerksrolle'),
  ('site_manager_appointment',     'company', 'DE', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('subcontractor_agreement',      'company', 'DE', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('wage_payment_proof',           'company', 'DE', 'entity',      false, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Disponible a requerimiento'),

  -- ══ §3.6 COMPANY / NON_EU (revisión manual reforzada) ═════════════════════
  ('rc_insurance',                 'company', 'NON_EU', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, true,  NULL, 'Revisión manual reforzada'),
  ('ss_clearance_national',        'company', 'NON_EU', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Revisión manual reforzada'),
  ('unbedenklichkeit_finanzamt',   'company', 'NON_EU', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('milog_declaration',            'company', 'NON_EU', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('business_registration',        'company', 'NON_EU', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('accident_insurance_clearance', 'company', 'NON_EU', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('site_manager_appointment',     'company', 'NON_EU', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('zoll_meldeportal_notification','company', 'NON_EU', 'per_project', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('soka_bau_clearance',           'company', 'NON_EU', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('subcontractor_agreement',      'company', 'NON_EU', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),

  -- ══ §3.2 COMPANY_WORKER / ES ══════════════════════════════════════════════
  ('a1_certificate',        'company_worker', 'ES', 'entity',      true, '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Fechas vinculadas al contrato y a la asignación a obra'),
  ('id_document',           'company_worker', 'ES', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('employment_contract',   'company_worker', 'ES', 'entity',      true, '{}', 'no_expiry',             NULL, NULL, false, NULL, 'Fechas usadas en la validación del A1'),
  ('prl_training',          'company_worker', 'ES', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('first_aid_course',      'company_worker', 'ES', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('site_risk_training',    'company_worker', 'ES', 'per_project', true, '{}', 'no_expiry',             NULL, NULL, false, NULL, NULL),
  ('s1_certificate',        'company_worker', 'ES', 'entity',      true, '{"short_stay": false}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('ehic_card',             'company_worker', 'ES', 'entity',      true, '{"short_stay": true}',  'expiry_required', NULL, NULL, false, NULL, 'Solo viajes de corta duración'),
  ('work_permit_vander_elst','company_worker','ES', 'entity',      true, '{"non_eu_national": true}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Trabajador extracomunitario de empresa UE'),

  -- ══ §3.5 COMPANY_WORKER / EU_OTHER ════════════════════════════════════════
  ('a1_certificate',        'company_worker', 'EU_OTHER', 'entity',      true, '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'A1 emitido por su país'),
  ('id_document',           'company_worker', 'EU_OTHER', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('employment_contract',   'company_worker', 'EU_OTHER', 'entity',      true, '{}', 'no_expiry',             NULL, NULL, false, NULL, NULL),
  ('prl_training',          'company_worker', 'EU_OTHER', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('first_aid_course',      'company_worker', 'EU_OTHER', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('site_risk_training',    'company_worker', 'EU_OTHER', 'per_project', true, '{}', 'no_expiry',             NULL, NULL, false, NULL, NULL),
  ('s1_certificate',        'company_worker', 'EU_OTHER', 'entity',      true, '{"short_stay": false}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('ehic_card',             'company_worker', 'EU_OTHER', 'entity',      true, '{"short_stay": true}',  'expiry_required', NULL, NULL, false, NULL, NULL),
  ('work_permit_vander_elst','company_worker','EU_OTHER', 'entity',      true, '{"non_eu_national": true}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Vander Elst'),

  -- ══ §3.4 COMPANY_WORKER / DE (sin A1: no hay desplazamiento) ══════════════
  ('id_document',              'company_worker', 'DE', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('sozialversicherungsausweis','company_worker','DE', 'entity',      true, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('employment_contract',      'company_worker', 'DE', 'entity',      true, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('prl_training',             'company_worker', 'DE', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('first_aid_course',         'company_worker', 'DE', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('site_risk_training',       'company_worker', 'DE', 'per_project', true, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),

  -- ══ §3.6 COMPANY_WORKER / NON_EU ══════════════════════════════════════════
  ('work_permit_vander_elst', 'company_worker', 'NON_EU', 'entity',      true, '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Revisión manual reforzada'),
  ('id_document',             'company_worker', 'NON_EU', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('employment_contract',     'company_worker', 'NON_EU', 'entity',      true, '{}', 'no_expiry',             NULL, NULL, false, NULL, NULL),
  ('prl_training',            'company_worker', 'NON_EU', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('first_aid_course',        'company_worker', 'NON_EU', 'entity',      true, '{}', 'expiry_required',       NULL, NULL, false, NULL, NULL),
  ('site_risk_training',      'company_worker', 'NON_EU', 'per_project', true, '{}', 'no_expiry',             NULL, NULL, false, NULL, NULL),

  -- ══ §3.3 FREELANCER / ES (checklist Embajada de España) ═══════════════════
  ('a1_certificate',          'freelancer', 'ES', 'entity',      true,  '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Solicitud TA.300, expedido por TGSS'),
  ('s1_certificate',          'freelancer', 'ES', 'entity',      true,  '{"short_stay": false}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('ehic_card',               'freelancer', 'ES', 'entity',      true,  '{"short_stay": true}',  'expiry_required', NULL, NULL, false, NULL, 'Solo viajes de corta duración'),
  ('aeat_clearance',          'freelancer', 'ES', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('freelancer_registration', 'freelancer', 'ES', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Acredita que es autónomo real'),
  ('handwerk_recognition',    'freelancer', 'ES', 'entity',      true,  '{"regulated_trade": true}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('residence_registration',  'freelancer', 'ES', 'entity',      true,  '{"short_stay": false}', 'no_expiry', NULL, NULL, false, NULL, 'Si la estancia lo exige'),
  ('krankenkasse_s1_submission','freelancer','ES','entity',      true,  '{"short_stay": false}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('freistellung_48b',        'freelancer', 'ES', 'entity',      false, '{}', 'expiry_required', NULL, NULL, false, 'notify_billing_withholding', 'Sin ella: retención 15% Bauabzugsteuer'),
  ('rc_insurance',            'freelancer', 'ES', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, true, NULL, 'Cobertura en Alemania'),
  ('site_manager_appointment','freelancer', 'ES', 'per_project', false, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Responsable de su propio trabajo, si aplica'),
  ('id_document',             'freelancer', 'ES', 'entity',      true,  '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('subcontractor_agreement', 'freelancer', 'ES', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  -- Si contrata trabajadores → requisitos de nivel empresa:
  ('milog_declaration',            'freelancer', 'ES', 'per_project', true, '{"hires_workers": true}', 'no_expiry',       NULL, NULL, false, NULL, 'Aplica por contratar trabajadores'),
  ('accident_insurance_clearance', 'freelancer', 'ES', 'entity',      true, '{"hires_workers": true}', 'days_from_issue', 90,   NULL, false, NULL, 'Mutua/BG por sus trabajadores'),
  ('zoll_meldeportal_notification','freelancer', 'ES', 'per_project', true, '{"hires_workers": true}', 'no_expiry',       NULL, NULL, false, NULL, 'Notificación por sus trabajadores'),
  ('soka_bau_clearance',           'freelancer', 'ES', 'entity',      true, '{"hires_workers": true}', 'days_from_issue', 90,   NULL, false, NULL, NULL),

  -- ══ §3.5 FREELANCER / EU_OTHER ════════════════════════════════════════════
  ('a1_certificate',          'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'A1 emitido por su país'),
  ('s1_certificate',          'freelancer', 'EU_OTHER', 'entity',      true,  '{"short_stay": false}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('ehic_card',               'freelancer', 'EU_OTHER', 'entity',      true,  '{"short_stay": true}',  'expiry_required', NULL, NULL, false, NULL, NULL),
  ('ss_clearance_national',   'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'Seguridad social nacional'),
  ('freelancer_registration', 'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Censo de actividad de su país'),
  ('handwerk_recognition',    'freelancer', 'EU_OTHER', 'entity',      true,  '{"regulated_trade": true}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('residence_registration',  'freelancer', 'EU_OTHER', 'entity',      true,  '{"short_stay": false}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('krankenkasse_s1_submission','freelancer','EU_OTHER','entity',      true,  '{"short_stay": false}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('freistellung_48b',        'freelancer', 'EU_OTHER', 'entity',      false, '{}', 'expiry_required', NULL, NULL, false, 'notify_billing_withholding', NULL),
  ('rc_insurance',            'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, true, NULL, 'Cobertura en Alemania'),
  ('site_manager_appointment','freelancer', 'EU_OTHER', 'per_project', false, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('id_document',             'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('subcontractor_agreement', 'freelancer', 'EU_OTHER', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('milog_declaration',            'freelancer', 'EU_OTHER', 'per_project', true, '{"hires_workers": true}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('accident_insurance_clearance', 'freelancer', 'EU_OTHER', 'entity',      true, '{"hires_workers": true}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('zoll_meldeportal_notification','freelancer', 'EU_OTHER', 'per_project', true, '{"hires_workers": true}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('soka_bau_clearance',           'freelancer', 'EU_OTHER', 'entity',      true, '{"hires_workers": true}', 'days_from_issue', 90,   NULL, false, NULL, NULL),

  -- ══ §3.4 FREELANCER / DE ══════════════════════════════════════════════════
  ('business_registration',   'freelancer', 'DE', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Gewerbeanmeldung o Handelsregister'),
  ('freistellung_48b',        'freelancer', 'DE', 'entity',      false, '{}', 'expiry_required', NULL, NULL, false, 'notify_billing_withholding', 'Vigencia impresa en el documento'),
  ('unbedenklichkeit_finanzamt','freelancer','DE','entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('unbedenklichkeit_krankenkasse','freelancer','DE','entity',   true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('accident_insurance_clearance','freelancer','DE','entity',    true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, 'BG BAU'),
  ('soka_bau_clearance',      'freelancer', 'DE', 'entity',      true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('rc_insurance',            'freelancer', 'DE', 'entity',      true,  '{}', 'expiry_required', NULL, 200000, false, NULL, NULL),
  ('handwerk_recognition',    'freelancer', 'DE', 'entity',      true,  '{"regulated_trade": true}', 'no_expiry', NULL, NULL, false, NULL, 'Handwerkskarte'),
  ('id_document',             'freelancer', 'DE', 'entity',      true,  '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('subcontractor_agreement', 'freelancer', 'DE', 'entity',      true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('site_manager_appointment','freelancer', 'DE', 'per_project', false, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('milog_declaration',            'freelancer', 'DE', 'per_project', true, '{"hires_workers": true}', 'no_expiry', NULL, NULL, false, NULL, NULL),
  ('zoll_meldeportal_notification','freelancer', 'DE', 'per_project', true, '{"hires_workers": true}', 'no_expiry', NULL, NULL, false, NULL, NULL),

  -- ══ §3.6 FREELANCER / NON_EU ══════════════════════════════════════════════
  ('work_permit_vander_elst', 'freelancer', 'NON_EU', 'entity', true,  '{}', 'must_cover_assignment', NULL, NULL, false, NULL, 'Revisión manual reforzada'),
  ('business_registration',   'freelancer', 'NON_EU', 'entity', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('ss_clearance_national',   'freelancer', 'NON_EU', 'entity', true,  '{}', 'days_from_issue', 90,   NULL, false, NULL, NULL),
  ('rc_insurance',            'freelancer', 'NON_EU', 'entity', true,  '{}', 'expiry_required', NULL, 200000, true, NULL, NULL),
  ('id_document',             'freelancer', 'NON_EU', 'entity', true,  '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('subcontractor_agreement', 'freelancer', 'NON_EU', 'entity', true,  '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('freistellung_48b',        'freelancer', 'NON_EU', 'entity', false, '{}', 'expiry_required', NULL, NULL, false, 'notify_billing_withholding', NULL),

  -- ══ §3.7 INTERNAL_EMPLOYEE / ALL ══════════════════════════════════════════
  ('employment_contract', 'internal_employee', 'ALL', 'entity',      true, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('id_document',         'internal_employee', 'ALL', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('prl_training',        'internal_employee', 'ALL', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, 'Por oficio'),
  ('first_aid_course',    'internal_employee', 'ALL', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('medical_checkup',     'internal_employee', 'ALL', 'entity',      true, '{}', 'expiry_required', NULL, NULL, false, NULL, NULL),
  ('site_risk_training',  'internal_employee', 'ALL', 'per_project', true, '{}', 'no_expiry',       NULL, NULL, false, NULL, NULL),
  ('ppe_record',          'internal_employee', 'ALL', 'entity',      true, '{}', 'no_expiry',       NULL, NULL, false, NULL, 'Registro de entrega')
) AS v(code, applies_to, origin, scope, mandatory, conditions, validity_rule,
       validity_days, min_amount, coverage, on_missing, notes)
JOIN public.document_types dt ON dt.code = v.code;
