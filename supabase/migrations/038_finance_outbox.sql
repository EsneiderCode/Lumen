-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 038 — Finance outbox (Lumen → FinControl)
-- Depends on: 037_scheduler_shared_appointments.sql
-- Purpose:
--   Reliable event bus for finance facts. Lumen is the source of production truth;
--   FinControl materializes CXC/CXP. Transport v2 (S5): enqueue here, dispatch
--   via Edge Function to Firestore (or webhook). CSV remains a fallback encoding.
--
-- Events:
--   finance.cxc_draft.v1       — work order client_accepted
--   finance.cxp_from_cycle.v1  — collaborator cycle published (weekly close)
--
-- Run manually in Supabase SQL Editor (after 037). Then regenerate types.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.finance_outbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        TEXT NOT NULL
                    CHECK (event_type IN (
                      'finance.cxc_draft.v1',
                      'finance.cxp_from_cycle.v1'
                    )),
  idempotency_key   TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- One logical event only once (re-publish / re-accept is a no-op at enqueue)
CREATE UNIQUE INDEX IF NOT EXISTS finance_outbox_idempotency_uidx
  ON public.finance_outbox (idempotency_key);

CREATE INDEX IF NOT EXISTS finance_outbox_status_created_idx
  ON public.finance_outbox (status, created_at);

DROP TRIGGER IF EXISTS handle_finance_outbox_updated_at ON public.finance_outbox;
CREATE TRIGGER handle_finance_outbox_updated_at
  BEFORE UPDATE ON public.finance_outbox
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.finance_outbox ENABLE ROW LEVEL SECURITY;

-- Permission-based pattern as in 035: read for cycles.view (outbox panel);
-- insert only for write-scoped actors — enqueue fires on cycle publish
-- (cycles.edit) and on work-order client_accepted (work_orders.edit).
-- Updates/dispatch use service role.
DROP POLICY IF EXISTS finance_outbox_admin_select ON public.finance_outbox;
CREATE POLICY finance_outbox_select_perm ON public.finance_outbox
  FOR SELECT TO authenticated
  USING (public.has_permission('cycles.view'));

DROP POLICY IF EXISTS finance_outbox_admin_insert ON public.finance_outbox;
CREATE POLICY finance_outbox_insert_perm ON public.finance_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('cycles.edit')
    OR public.has_permission('work_orders.edit')
  );

COMMENT ON TABLE public.finance_outbox IS
  'Outbound finance events for FinControl. Consumers mark status=sent. Idempotency by idempotency_key.';
