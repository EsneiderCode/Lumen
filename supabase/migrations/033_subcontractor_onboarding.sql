-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 033 — Subunternehmer-Onboarding & extended compliance documents
-- Depends on: 011_contractor_documents.sql, 016_mvp_business_logic_hardening.sql
-- Purpose:
--   - Extend contractor_documents from 6 → 10 required compliance document types
--     to match the UMTELKOMD Subunternehmer-Onboarding checklist.
--   - Store the onboarding header (company data), the A1 worker roster, and the
--     verification / confirmation block that are NOT per-document.
--
-- ⚠ BEHAVIORAL NOTE — external certification gate:
--   contractor_required_document_types() now returns 10 types. The existing
--   trigger block_external_cert_without_valid_docs() will therefore require ALL
--   10 documents to be approved & valid before an external certification is
--   allowed (previously 6). Contractors that were compliant under the old set
--   must upload the 4 new documents (A1, Mindestlohn-Meldung GZD, USt-IdNr.
--   Reverse-Charge, Zusatzvereinbarung Mindestlohn) to stay unblocked.
--
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Extend the allowed document_type set on contractor_documents ──────────────
ALTER TABLE public.contractor_documents
  DROP CONSTRAINT IF EXISTS contractor_documents_document_type_check;

ALTER TABLE public.contractor_documents
  ADD CONSTRAINT contractor_documents_document_type_check
  CHECK (document_type IN (
    'a1_bescheinigung',
    'unbedenklichkeit_finanzamt',
    'mindestlohn_meldung_gzd',
    'unbedenklichkeit_sozialkasse',
    'ust_id_reverse_charge',
    'gewerbeanmeldung',
    'haftpflichtversicherung',
    'id_passport',
    'zusatzvereinbarung_mindestlohn',
    'subcontractor_agreement'
  ));

-- 2) Update the required-types function to the full UMTELKOMD checklist ─────────
CREATE OR REPLACE FUNCTION public.contractor_required_document_types()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'a1_bescheinigung',
    'unbedenklichkeit_finanzamt',
    'mindestlohn_meldung_gzd',
    'unbedenklichkeit_sozialkasse',
    'ust_id_reverse_charge',
    'gewerbeanmeldung',
    'haftpflichtversicherung',
    'id_passport',
    'zusatzvereinbarung_mindestlohn',
    'subcontractor_agreement'
  ]::TEXT[];
$$;

-- 3) Onboarding header / roster / verification record ──────────────────────────
--    One row per contractor (subcontractor company).
CREATE TABLE IF NOT EXISTS public.subcontractor_onboarding (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- §1 Angaben zum Subunternehmer / Datos del subcontratista
  company_name      TEXT,
  ust_id_es         TEXT,   -- USt-IdNr. (ES) / NIF-IVA
  address           TEXT,
  tax_number_de     TEXT,   -- Steuernummer (DE, falls vorhanden)
  contact_person    TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  project_site      TEXT,   -- Projekt / Baustelle
  deployment_period TEXT,   -- Einsatzzeitraum / Periodo de trabajo

  -- §3 Eingesetzte Mitarbeiter (A1) / Trabajadores desplazados
  --    [{ "name": string, "a1_valid_until": "YYYY-MM-DD"|null, "id_number": string }]
  a1_workers        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- §4 Prüfung & Bestätigung / Verificación y confirmación
  checked_48b       BOOLEAN NOT NULL DEFAULT false,   -- § 48b im EIBE-Portal geprüft
  withhold_bauabzug BOOLEAN NOT NULL DEFAULT false,   -- 15 % Bauabzugsteuer einbehalten
  ust_id_confirmed  BOOLEAN NOT NULL DEFAULT false,   -- USt-IdNr. beim BZSt bestätigt / § 13b
  place_date        TEXT,   -- Ort, Datum / Lugar, fecha
  verified_by       TEXT,   -- Geprüft durch (Name) / Verificado por
  notes             TEXT,

  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_onboarding_contractor
  ON public.subcontractor_onboarding (contractor_id);

DROP TRIGGER IF EXISTS handle_subcontractor_onboarding_updated_at ON public.subcontractor_onboarding;
CREATE TRIGGER handle_subcontractor_onboarding_updated_at
  BEFORE UPDATE ON public.subcontractor_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.subcontractor_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subcontractor_onboarding_admin_all" ON public.subcontractor_onboarding;
CREATE POLICY "subcontractor_onboarding_admin_all" ON public.subcontractor_onboarding
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "subcontractor_onboarding_own_select" ON public.subcontractor_onboarding;
CREATE POLICY "subcontractor_onboarding_own_select" ON public.subcontractor_onboarding
  FOR SELECT TO authenticated
  USING (contractor_id = auth.uid());
