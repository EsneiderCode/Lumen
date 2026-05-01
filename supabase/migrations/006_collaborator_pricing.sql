-- ─────────────────────────────────────────────────────────────────────────
-- Migration 006 — Collaborator Pricing + External Certification Type
--
-- Depends on:
--   · 004_service_catalog_seed.sql (service_items table)
--   · 002_cert_audit.sql            (certification_audits + cert_type CHECK)
--
-- Adds the data foundation for distinguishing internal-collaborator orders
-- (executed by an UMTELKOMD employee — `profiles.role = 'technician'`) from
-- external-collaborator orders (executed by a subcontractor — `profiles.role
-- = 'contractor'`):
--
--   · service_items.unit_price KEEPS its meaning ("price billed to client")
--     but is now documented explicitly via COMMENT.
--   · service_items.unit_price_external — NEW nullable column for the price
--     paid to external collaborators when they execute that catalog item.
--   · certification_audits.cert_type CHECK extended from
--     ('internal','client') to ('internal','client','external').
--     'external' rows are the document that triggers payment to the
--     subcontractor — does NOT block the work-order state machine, lives
--     in parallel.
--
-- Run manually in Supabase SQL Editor AFTER migration 004 has been applied.
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. service_items: document existing price + add external price ───────
COMMENT ON COLUMN public.service_items.unit_price IS
  'Price billed to the external client (Insyte, Vancom, …). NULL = "Nach Angebot" (quote on request).';

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS unit_price_external NUMERIC(10,2);

COMMENT ON COLUMN public.service_items.unit_price_external IS
  'Price paid to the external collaborator (contractor) when they execute this catalog item. NULL = pricing pending OR item only ever executed by internal staff. Nullable on purpose.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_items_unit_price_external_nonneg'
  ) THEN
    ALTER TABLE public.service_items
      ADD CONSTRAINT service_items_unit_price_external_nonneg
      CHECK (unit_price_external IS NULL OR unit_price_external >= 0);
  END IF;
END $$;


-- ── 2. certification_audits: add 'external' as a valid cert_type ─────────
ALTER TABLE public.certification_audits
  DROP CONSTRAINT IF EXISTS certification_audits_cert_type_check;

ALTER TABLE public.certification_audits
  ADD CONSTRAINT certification_audits_cert_type_check
  CHECK (cert_type IN ('internal', 'client', 'external'));

COMMENT ON COLUMN public.certification_audits.cert_type IS
  'Type of certification:
     internal — admin-internal quality seal (SHA-256 audit hash).
     client   — admin → client document, gates invoicing.
     external — admin → external collaborator document, gates payment to subcontractor.';


-- ─────────────────────────────────────────────────────────────────────────
-- DONE. Schema ready for collaborator pricing + external certification.
-- Next: regenerate database.types.ts (`supabase gen types typescript`)
-- once Alejandro applies this in his Supabase.
-- ─────────────────────────────────────────────────────────────────────────
