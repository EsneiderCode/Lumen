-- ─────────────────────────────────────────────────────────────────────────
-- Migration 003 — Atomic order number generation
-- Replaces Math.random() on the client with a server-side sequence.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Create the sequence (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'lumen_order_seq' AND relkind = 'S'
  ) THEN
    CREATE SEQUENCE lumen_order_seq START 1001;
  END IF;
END $$;

-- 2. RPC function callable by authenticated users
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  date_part TEXT;
  seq_val   BIGINT;
BEGIN
  date_part := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD');
  seq_val   := nextval('lumen_order_seq');
  RETURN 'LUM-' || date_part || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- 3. Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION generate_order_number() TO authenticated;
