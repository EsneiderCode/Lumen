-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018 — Fix missing external price snapshot on billing lines
-- Depends on: 005_direct_orders_and_billing.sql, 009_billing_flow_extensions.sql
-- Purpose:
--   work_order_billing_lines was first created by migration 005 WITHOUT the
--   unit_price_external_snapshot column. Migration 009 re-declared the table
--   with the column using CREATE TABLE IF NOT EXISTS, which is a no-op against
--   the already-existing table — so the column was never actually added to the
--   live schema.
--
--   The application writes this column on every external-collaborator billing
--   save (src/services/workOrderService.ts), so every such save currently fails
--   at runtime with: column "unit_price_external_snapshot" does not exist.
--
--   This migration adds the column idempotently, matching the type and CHECK
--   intended by migration 009. qty/subtotal precision is intentionally left at
--   the 005 definition: subtotal is already stored as NUMERIC(_,2) and qty being
--   wider (NUMERIC(12,3)) is harmless, so narrowing live columns is avoided.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.work_order_billing_lines
  ADD COLUMN IF NOT EXISTS unit_price_external_snapshot NUMERIC(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_order_billing_lines_unit_price_external_nonneg'
  ) THEN
    ALTER TABLE public.work_order_billing_lines
      ADD CONSTRAINT work_order_billing_lines_unit_price_external_nonneg
      CHECK (unit_price_external_snapshot IS NULL OR unit_price_external_snapshot >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.work_order_billing_lines.unit_price_external_snapshot IS
  'Snapshot of the external collaborator price at billing time. NULL when the line was not executed by an external collaborator. Added in migration 018 because 005 created the table without it and 009 CREATE TABLE IF NOT EXISTS was a no-op.';
