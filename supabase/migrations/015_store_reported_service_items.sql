-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Store field-reported service items without pricing
-- Depends on: 014_lock_down_service_pricing.sql
-- Purpose:
--   Technicians need to report executed Alta service items, but pricing and
--   billing snapshots must remain admin-only. Store the field report on the
--   existing Rückmeldung detail row protected by wo_detail_alta RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.wo_detail_alta
  ADD COLUMN IF NOT EXISTS reported_service_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.wo_detail_alta
  DROP CONSTRAINT IF EXISTS wo_detail_alta_reported_service_items_array;

ALTER TABLE public.wo_detail_alta
  ADD CONSTRAINT wo_detail_alta_reported_service_items_array
  CHECK (jsonb_typeof(reported_service_items) = 'array');
