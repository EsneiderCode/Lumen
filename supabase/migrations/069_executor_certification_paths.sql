-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 069 — Executor-driven certification paths
-- Depends on: 068_client_first_work_order_routing.sql
-- Purpose:
--   - Preserve the complete v1 transition graph and direct-order invoice path.
--   - Send v2 own-team work directly to the client.
--   - Require Nexus internal certification before client send for v2 external
--     contractor work.
--   - Make every certification-sensitive v2 transition available only through
--     a checked, atomic RPC (lock → validate → update → history).
-- Apply manually in Supabase SQL Editor.
-- Rollback notes:
--   - Unbind enforce_work_order_status_transition before restoring prior logic.
--   - Restore the migration 016 certification/invoicing RPC bodies and grants.
--   - Keep operator_id/line nullable; migration 068's relaxation stays.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- SECURITY DEFINER RPCs set this transaction-local marker immediately before
-- their UPDATE. Direct table updates cannot perform sensitive v2 transitions.
CREATE OR REPLACE FUNCTION public.certification_rpc_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('lumen.certification_rpc', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION public.assert_work_order_rpc_permission(
  p_changed_by UUID,
  p_permission TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR p_changed_by IS DISTINCT FROM auth.uid()
     OR NOT public.has_permission(p_permission) THEN
    RAISE EXCEPTION
      'checked work-order RPC requires % for the authenticated actor',
      p_permission
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_work_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  is_direct BOOLEAN := (NEW.client_id IS NULL);
  is_sensitive_v2 BOOLEAN;
  allowed_transition BOOLEAN;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- The v1 branch is intentionally the migration-005 graph verbatim, including
  -- internally_certified → invoiced for direct orders.
  IF NEW.flow_version = 1 THEN
    allowed_transition :=
      (OLD.status = 'created'              AND NEW.status IN ('assigned', 'cancelled')) OR
      (OLD.status = 'assigned'             AND NEW.status IN ('in_progress', 'cancelled')) OR
      (OLD.status = 'in_progress'          AND NEW.status IN ('executed', 'cancelled')) OR
      (OLD.status = 'executed'             AND NEW.status IN ('rueckmeldung_pending', 'cancelled')) OR
      (OLD.status = 'rueckmeldung_pending' AND NEW.status IN ('rueckmeldung_sent', 'cancelled')) OR
      (OLD.status = 'rueckmeldung_sent'    AND NEW.status IN ('internally_certified', 'returned', 'cancelled')) OR
      (OLD.status = 'internally_certified' AND (
        NEW.status = 'sent_to_client'
        OR NEW.status = 'cancelled'
        OR (is_direct AND NEW.status = 'invoiced')
      )) OR
      (OLD.status = 'sent_to_client'       AND NEW.status IN ('client_accepted', 'client_rejected')) OR
      (OLD.status = 'client_accepted'      AND NEW.status = 'invoiced') OR
      (OLD.status = 'client_rejected'      AND NEW.status = 'internally_certified') OR
      (OLD.status = 'invoiced'             AND NEW.status = 'paid') OR
      (OLD.status = 'returned'             AND NEW.status = 'rueckmeldung_pending');
  ELSE
    is_sensitive_v2 :=
      (OLD.status = 'rueckmeldung_sent' AND NEW.status IN ('internally_certified', 'sent_to_client'))
      OR (OLD.status = 'internally_certified' AND NEW.status = 'sent_to_client')
      OR (OLD.status = 'sent_to_client' AND NEW.status IN ('client_accepted', 'client_rejected'))
      OR (OLD.status = 'client_rejected' AND NEW.status = 'rueckmeldung_pending')
      OR (OLD.status = 'client_accepted' AND NEW.status = 'invoiced');

    IF is_sensitive_v2 AND NOT public.certification_rpc_authorized() THEN
      RAISE EXCEPTION
        'v2 certification-sensitive status transitions require a checked RPC'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    allowed_transition :=
      (OLD.status = 'created'              AND NEW.status IN ('assigned', 'cancelled')) OR
      (OLD.status = 'assigned'             AND NEW.status IN ('in_progress', 'cancelled')) OR
      (OLD.status = 'in_progress'          AND NEW.status IN ('executed', 'cancelled')) OR
      (OLD.status = 'executed'             AND NEW.status IN ('rueckmeldung_pending', 'cancelled')) OR
      (OLD.status = 'rueckmeldung_pending' AND NEW.status IN ('rueckmeldung_sent', 'cancelled')) OR
      (OLD.status = 'rueckmeldung_sent' AND (
        NEW.status IN ('returned', 'cancelled')
        OR (NEW.executor_type = 'own_team' AND NEW.status = 'sent_to_client')
        OR (NEW.executor_type = 'external_contractor' AND NEW.status = 'internally_certified')
      )) OR
      (OLD.status = 'internally_certified'
        AND NEW.executor_type = 'external_contractor'
        AND NEW.status IN ('sent_to_client', 'cancelled')) OR
      (OLD.status = 'sent_to_client'       AND NEW.status IN ('client_accepted', 'client_rejected')) OR
      (OLD.status = 'client_accepted'      AND NEW.status = 'invoiced') OR
      (OLD.status = 'client_rejected'      AND NEW.status IN ('rueckmeldung_pending', 'cancelled')) OR
      (OLD.status = 'invoiced'             AND NEW.status = 'paid') OR
      (OLD.status = 'returned'             AND NEW.status = 'rueckmeldung_pending');
  END IF;

  IF NOT allowed_transition THEN
    RAISE EXCEPTION
      'invalid work-order status transition: % -> % (order %, flow %, executor %)',
      OLD.status, NEW.status, OLD.id, NEW.flow_version, NEW.executor_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Migration 005 defined the function but never bound it to work_orders. Bind it
-- now so v1 compatibility and v2 branching are both enforced by PostgreSQL.
DROP TRIGGER IF EXISTS enforce_work_order_status_transition ON public.work_orders;
CREATE TRIGGER enforce_work_order_status_transition
  BEFORE UPDATE OF status ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_work_order_status_transition();

CREATE OR REPLACE FUNCTION public.certify_work_order_internal(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_data_hash TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
  aptitude_level TEXT;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.certify_internal'
  );

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF order_row.status <> 'rueckmeldung_sent' THEN
    RAISE EXCEPTION
      'internal certification requires rueckmeldung_sent status'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_data_hash IS NULL OR NOT (length(trim(p_data_hash)) > 0) THEN
    RAISE EXCEPTION
      'internal certification requires non-empty data hash'
      USING ERRCODE = 'check_violation';
  END IF;

  IF order_row.flow_version = 2 THEN
    IF order_row.executor_type <> 'external_contractor' THEN
      RAISE EXCEPTION
        'v2 internal certification is only valid for external_contractor work'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT aptitude.level INTO aptitude_level
    FROM public.compute_entity_aptitude(
      order_row.executor_entity_id,
      order_row.project_id
    ) aptitude;

    IF aptitude_level = 'red'
       AND NOT (
         order_row.compliance_override
         AND nullif(btrim(order_row.compliance_override_reason), '') IS NOT NULL
         AND order_row.compliance_override_by IS NOT NULL
       ) THEN
      RAISE EXCEPTION
        'internal certification blocked: external contractor is not compliant for the project'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM public.assert_work_order_rueckmeldung_complete(p_work_order_id);

  INSERT INTO public.certification_audits (
    work_order_id, cert_type, certified_by, data_hash, notes
  )
  VALUES (
    p_work_order_id, 'internal', p_changed_by, p_data_hash, p_notes
  );

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'internally_certified', updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'internally_certified', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_work_order_to_client_checked(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
  latest_submission_at TIMESTAMPTZ;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.accept_client'
  );

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF order_row.client_id IS NULL THEN
    RAISE EXCEPTION
      'direct orders cannot be sent to a client'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.assert_work_order_rueckmeldung_complete(p_work_order_id);

  IF order_row.flow_version = 1 THEN
    IF order_row.status <> 'internally_certified'
       OR NOT EXISTS (
         SELECT 1 FROM public.certification_audits audit
         WHERE audit.work_order_id = p_work_order_id
           AND audit.cert_type = 'internal'
       ) THEN
      RAISE EXCEPTION
        'v1 client send requires internally_certified status and internal audit'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF order_row.executor_type = 'own_team' THEN
    IF order_row.status <> 'rueckmeldung_sent' THEN
      RAISE EXCEPTION
        'own_team client send requires rueckmeldung_sent status'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF order_row.status <> 'internally_certified' THEN
      RAISE EXCEPTION
        'external_contractor client send requires internally_certified status'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT max(history.created_at) INTO latest_submission_at
    FROM public.work_order_state_history history
    WHERE history.work_order_id = p_work_order_id
      AND history.to_status = 'rueckmeldung_sent';

    IF NOT EXISTS (
      SELECT 1
      FROM public.certification_audits audit
      WHERE audit.work_order_id = p_work_order_id
        AND audit.cert_type = 'internal'
        AND (
          latest_submission_at IS NULL
          OR audit.certified_at >= latest_submission_at
        )
    ) THEN
      RAISE EXCEPTION
        'external_contractor client send requires an internal audit after the latest Rückmeldung'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'sent_to_client', updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'sent_to_client', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_work_order_client(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_data_hash TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.accept_client'
  );

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF order_row.client_id IS NULL THEN
    RAISE EXCEPTION
      'direct orders cannot be client accepted'
      USING ERRCODE = 'check_violation';
  END IF;
  IF order_row.status <> 'sent_to_client' THEN
    RAISE EXCEPTION
      'client acceptance requires sent_to_client status'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_data_hash IS NULL OR NOT (length(trim(p_data_hash)) > 0) THEN
    RAISE EXCEPTION
      'client acceptance requires non-empty data hash'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.certification_audits (
    work_order_id, cert_type, certified_by, data_hash, notes
  )
  VALUES (
    p_work_order_id, 'client', p_changed_by, p_data_hash, p_notes
  );

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'client_accepted', updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'client_accepted', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_work_order_client_checked(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_notes TEXT
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.accept_client'
  );

  IF nullif(btrim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION
      'client rejection requires a reason'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF order_row.status <> 'sent_to_client' THEN
    RAISE EXCEPTION
      'client rejection requires sent_to_client status'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'client_rejected', updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'client_rejected', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_rejected_work_order_checked(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.accept_client'
  );

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF order_row.flow_version <> 2 OR order_row.status <> 'client_rejected' THEN
    RAISE EXCEPTION
      'v2 correction reopening requires client_rejected status'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'rueckmeldung_pending', updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'rueckmeldung_pending', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_work_order_checked(
  p_work_order_id UUID,
  p_changed_by UUID,
  p_billing_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_row public.work_orders%ROWTYPE;
  updated_order public.work_orders;
BEGIN
  PERFORM public.assert_work_order_rpc_permission(
    p_changed_by,
    'certification.invoice'
  );

  SELECT * INTO order_row
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work order not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF order_row.flow_version = 1 AND order_row.client_id IS NULL THEN
    IF order_row.status <> 'internally_certified'
       OR NOT EXISTS (
         SELECT 1 FROM public.certification_audits audit
         WHERE audit.work_order_id = p_work_order_id
           AND audit.cert_type = 'internal'
       ) THEN
      RAISE EXCEPTION
        'direct invoice requires internally_certified status and internal audit'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF order_row.status <> 'client_accepted'
       OR NOT EXISTS (
         SELECT 1 FROM public.certification_audits audit
         WHERE audit.work_order_id = p_work_order_id
           AND audit.cert_type = 'client'
       ) THEN
      RAISE EXCEPTION
        'client invoice requires client_accepted status and client audit'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM set_config('lumen.certification_rpc', 'on', true);
  UPDATE public.work_orders
  SET status = 'invoiced',
      billing_reference = p_billing_reference,
      updated_at = now()
  WHERE id = p_work_order_id
  RETURNING * INTO updated_order;

  INSERT INTO public.work_order_state_history (
    work_order_id, from_status, to_status, changed_by, notes
  )
  VALUES (
    p_work_order_id, order_row.status, 'invoiced', p_changed_by, p_notes
  );

  RETURN updated_order;
END;
$$;

-- Revoke the implicit PUBLIC execute privilege. Authenticated application calls
-- receive only the checked RPC entry points; trigger helpers are never exposed.
REVOKE ALL ON FUNCTION public.certification_rpc_authorized()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_work_order_rpc_permission(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_work_order_status_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.certify_work_order_internal(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_work_order_to_client_checked(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_work_order_client(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_work_order_client_checked(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reopen_rejected_work_order_checked(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_work_order_checked(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.certify_work_order_internal(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_work_order_to_client_checked(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_work_order_client(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_work_order_client_checked(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_rejected_work_order_checked(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_work_order_checked(UUID, UUID, TEXT, TEXT)
  TO authenticated;

COMMIT;
