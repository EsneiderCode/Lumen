-- ─────────────────────────────────────────────────────────────────────────
-- Migration 002 — Sprint 7: Certification Review Interface
-- LUM-023: assigned_detail_snapshot for side-by-side comparison
-- LUM-024: certification_audits for tamper-evident audit trail
-- Run manually in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Add assigned_detail_snapshot to work_orders
--    Set once when admin creates the order; never overwritten.
--    Stores the original work-type-specific values the admin assigned.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS assigned_detail_snapshot JSONB;

-- 2. Create certification_audits table
CREATE TABLE IF NOT EXISTS certification_audits (
  id              UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id   UUID         NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  cert_type       TEXT         NOT NULL CHECK (cert_type IN ('internal', 'client')),
  certified_by    UUID         NOT NULL REFERENCES profiles(id),
  certified_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  data_hash       TEXT         NOT NULL,  -- SHA-256 hex of key order data
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_audits_work_order
  ON certification_audits (work_order_id);

-- 3. RLS
ALTER TABLE certification_audits ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admin full access to cert audits" ON certification_audits;
CREATE POLICY "Admin full access to cert audits"
  ON certification_audits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
