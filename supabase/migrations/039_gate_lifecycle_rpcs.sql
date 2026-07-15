-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 039 — Gate work-order lifecycle RPCs behind RBAC permissions
-- Depends on: 038_finance_outbox.sql (ordering), 034_rbac_core.sql (has_permission),
--             016_mvp_business_logic_hardening.sql (function bodies re-created here).
-- Purpose:
--   The four lifecycle RPCs from 016 (assign_work_order_checked,
--   certify_work_order_internal, accept_work_order_client,
--   invoice_work_order_checked) are SECURITY DEFINER and were created with the
--   default EXECUTE grant, so ANY authenticated user could call them through
--   PostgREST (/rest/v1/rpc/...) and flip work-order status — bypassing the
--   work_orders UPDATE policy from 035, which requires
--   has_permission('work_orders.edit') for the equivalent direct UPDATE.
--
--   Re-create each function with its 016 body unchanged except for a permission
--   gate at the top:
--     - assign_work_order_checked      → work_orders.assign. Its only caller is
--       WorkOrderAssignPage, whose route is gated on work_orders.assign
--       (ROUTE_PERMISSIONS), and the seeded permission describes exactly this
--       action. Gating on work_orders.edit would break a custom dispatcher
--       role that holds assign without edit.
--     - certify_work_order_internal,
--       accept_work_order_client,
--       invoice_work_order_checked     → work_orders.edit. Callers are the
--       internal office UI only (WorkOrderDetailPage single actions and
--       CertificationPage bulk actions); there is no client/external portal
--       calling accept_work_order_client — office staff record client
--       acceptance on the client's behalf. The adjacent transition in the same
--       flows (sent_to_client) is a direct UPDATE already requiring
--       work_orders.edit via RLS, so this keeps the pipeline consistent.
--
--   Also tighten EXECUTE: revoke from PUBLIC/anon and grant explicitly to
--   authenticated (convention from 003) and service_role. The permission gate
--   is the real barrier — has_permission() is false for anon and for
--   service-key calls (auth.uid() IS NULL) — the ACL is defense in depth.
--
--   assert_work_order_rueckmeldung_complete (016) stays ungated: it mutates
--   nothing (pure validation, raises on incomplete Rückmeldung).
--
-- Run manually in Supabase SQL Editor (after 038).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) assign_work_order_checked — gate on work_orders.assign ───────────────────

create or replace function public.assign_work_order_checked(
  p_work_order_id uuid,
  p_team public.team_color,
  p_assignee_id uuid,
  p_assigned_date date,
  p_changed_by uuid,
  p_notes text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status public.work_order_status;
  updated_order public.work_orders;
begin
  if not public.has_permission('work_orders.assign') then
    raise exception 'permission denied: work_orders.assign required';
  end if;

  select status into previous_status
  from public.work_orders
  where id = p_work_order_id
  for update;

  if previous_status is null then
    raise exception 'work order not found' using errcode = 'no_data_found';
  end if;

  if previous_status not in ('created', 'assigned') then
    raise exception 'invalid assignment status: %', previous_status using errcode = 'check_violation';
  end if;

  update public.work_orders
  set assigned_team = p_team,
      assigned_technician = p_assignee_id,
      assigned_date = p_assigned_date,
      status = 'assigned',
      updated_at = now()
  where id = p_work_order_id
  returning * into updated_order;

  insert into public.work_order_state_history(work_order_id, from_status, to_status, changed_by, notes)
  values (p_work_order_id, previous_status, 'assigned', p_changed_by, coalesce(p_notes, 'Assigned through checked RPC'));

  return updated_order;
end;
$$;

-- 2) certify_work_order_internal — gate on work_orders.edit ───────────────────

create or replace function public.certify_work_order_internal(
  p_work_order_id uuid,
  p_changed_by uuid,
  p_data_hash text,
  p_notes text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status public.work_order_status;
  updated_order public.work_orders;
begin
  if not public.has_permission('work_orders.edit') then
    raise exception 'permission denied: work_orders.edit required';
  end if;

  select status into previous_status from public.work_orders where id = p_work_order_id for update;
  if previous_status <> 'rueckmeldung_sent' then
    raise exception 'internal certification requires rueckmeldung_sent status' using errcode = 'check_violation';
  end if;
  if p_data_hash is null or not (length(trim(p_data_hash)) > 0) then
    raise exception 'internal certification requires non-empty data hash' using errcode = 'check_violation';
  end if;

  perform public.assert_work_order_rueckmeldung_complete(p_work_order_id);

  insert into public.certification_audits(work_order_id, cert_type, certified_by, data_hash, notes)
  values (p_work_order_id, 'internal', p_changed_by, p_data_hash, p_notes);

  update public.work_orders set status = 'internally_certified', updated_at = now()
  where id = p_work_order_id returning * into updated_order;

  insert into public.work_order_state_history(work_order_id, from_status, to_status, changed_by, notes)
  values (p_work_order_id, previous_status, 'internally_certified', p_changed_by, p_notes);

  return updated_order;
end;
$$;

-- 3) accept_work_order_client — gate on work_orders.edit ──────────────────────

create or replace function public.accept_work_order_client(
  p_work_order_id uuid,
  p_changed_by uuid,
  p_data_hash text,
  p_notes text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status public.work_order_status;
  has_client boolean;
  updated_order public.work_orders;
begin
  if not public.has_permission('work_orders.edit') then
    raise exception 'permission denied: work_orders.edit required';
  end if;

  select status, client_id is not null into previous_status, has_client
  from public.work_orders where id = p_work_order_id for update;

  if not has_client then
    raise exception 'direct orders cannot be client accepted' using errcode = 'check_violation';
  end if;
  if previous_status <> 'sent_to_client' then
    raise exception 'client acceptance requires sent_to_client status' using errcode = 'check_violation';
  end if;
  if p_data_hash is null or not (length(trim(p_data_hash)) > 0) then
    raise exception 'client acceptance requires non-empty data hash' using errcode = 'check_violation';
  end if;

  insert into public.certification_audits(work_order_id, cert_type, certified_by, data_hash, notes)
  values (p_work_order_id, 'client', p_changed_by, p_data_hash, p_notes);

  update public.work_orders set status = 'client_accepted', updated_at = now()
  where id = p_work_order_id returning * into updated_order;

  insert into public.work_order_state_history(work_order_id, from_status, to_status, changed_by, notes)
  values (p_work_order_id, previous_status, 'client_accepted', p_changed_by, p_notes);

  return updated_order;
end;
$$;

-- 4) invoice_work_order_checked — gate on work_orders.edit ────────────────────

create or replace function public.invoice_work_order_checked(
  p_work_order_id uuid,
  p_changed_by uuid,
  p_billing_reference text default null,
  p_notes text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status public.work_order_status;
  is_direct boolean;
  updated_order public.work_orders;
begin
  if not public.has_permission('work_orders.edit') then
    raise exception 'permission denied: work_orders.edit required';
  end if;

  select status, client_id is null into previous_status, is_direct
  from public.work_orders where id = p_work_order_id for update;

  if is_direct then
    if previous_status <> 'internally_certified' or not exists (
      select 1 from public.certification_audits where work_order_id = p_work_order_id and cert_type = 'internal'
    ) then
      raise exception 'direct invoice requires internally_certified status and internal audit' using errcode = 'check_violation';
    end if;
  else
    if previous_status <> 'client_accepted' or not exists (
      select 1 from public.certification_audits where work_order_id = p_work_order_id and cert_type = 'client'
    ) then
      raise exception 'client invoice requires client_accepted status and client audit' using errcode = 'check_violation';
    end if;
  end if;

  update public.work_orders
  set status = 'invoiced', billing_reference = p_billing_reference, updated_at = now()
  where id = p_work_order_id returning * into updated_order;

  insert into public.work_order_state_history(work_order_id, from_status, to_status, changed_by, notes)
  values (p_work_order_id, previous_status, 'invoiced', p_changed_by, p_notes);

  return updated_order;
end;
$$;

-- 5) Tighten EXECUTE grants ───────────────────────────────────────────────────
-- Supabase grants EXECUTE on new public functions to PUBLIC/anon/authenticated/
-- service_role by default, so anon currently holds EXECUTE on all four. Revoke
-- PUBLIC and anon; re-grant the roles that legitimately reach PostgREST RPC.

revoke execute on function public.assign_work_order_checked(uuid, public.team_color, uuid, date, uuid, text) from public, anon;
revoke execute on function public.certify_work_order_internal(uuid, uuid, text, text) from public, anon;
revoke execute on function public.accept_work_order_client(uuid, uuid, text, text) from public, anon;
revoke execute on function public.invoice_work_order_checked(uuid, uuid, text, text) from public, anon;

grant execute on function public.assign_work_order_checked(uuid, public.team_color, uuid, date, uuid, text) to authenticated, service_role;
grant execute on function public.certify_work_order_internal(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.accept_work_order_client(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.invoice_work_order_checked(uuid, uuid, text, text) to authenticated, service_role;
