-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016 — MVP business logic hardening
-- Depends on: 015_store_reported_service_items.sql
-- Purpose:
--   - Block assignment to non-compliant external contractors.
--   - Provide atomic RPC boundaries for assignment, internal certification,
--     client acceptance, and invoicing.
--   - Document canonical direct-order semantics: client_id IS NULL.
--   - Add preflight queries for Alejandro before applying hard blockers.
--
-- DO NOT apply from Jarl's machine. Alejandro applies in Supabase after
-- reviewing preflight/remediation output.
-- Rollback notes: drop triggers/functions created in this migration and restore
-- comments if production rollout needs to be reverted.
-- ─────────────────────────────────────────────────────────────────────────────

-- Preflight: orders assigned to contractors whose required documents are invalid.
-- select wo.id, wo.order_number, wo.assigned_technician, f.document_type, f.failure_code
-- from public.work_orders wo
-- join public.profiles p on p.id = wo.assigned_technician and p.role = 'contractor'
-- cross join lateral public.contractor_document_compliance_failures(wo.assigned_technician, coalesce(wo.assigned_date, current_date)) f;
--
-- Preflight: client-backed accepted/invoiced orders without client audit.
-- select wo.id, wo.order_number, wo.status
-- from public.work_orders wo
-- where wo.client_id is not null
--   and wo.status in ('client_accepted', 'invoiced', 'paid')
--   and not exists (
--     select 1 from public.certification_audits ca
--     where ca.work_order_id = wo.id and ca.cert_type = 'client'
--   );
--
-- Preflight: direct orders invoiced/paid without internal audit.
-- select wo.id, wo.order_number, wo.status
-- from public.work_orders wo
-- where wo.client_id is null
--   and wo.status in ('invoiced', 'paid')
--   and not exists (
--     select 1 from public.certification_audits ca
--     where ca.work_order_id = wo.id and ca.cert_type = 'internal'
--   );

comment on column public.work_orders.client_id is
  'Canonical direct-order marker: client_id IS NULL means direct order. Non-null client_id means client-backed order.';

comment on column public.work_orders.assigned_collaborator_id is
  'Assignment/collaborator field only. assigned_collaborator_id does not define direct-order status; client_id IS NULL does.';

create or replace function public.contractor_document_compliance_failures(
  p_contractor_id uuid,
  p_assignment_date date default current_date
)
returns table(document_type text, failure_code text)
language sql
stable
as $$
  with required as (
    select unnest(public.contractor_required_document_types()) as document_type
  ),
  latest as (
    select distinct on (cd.document_type)
      cd.document_type,
      cd.status,
      cd.expires_at
    from public.contractor_documents cd
    where cd.contractor_id = p_contractor_id
    order by cd.document_type, cd.uploaded_at desc
  )
  select
    r.document_type,
    case
      when l.document_type is null then 'contractor_documents_missing'
      when l.status <> 'approved' then 'contractor_documents_unapproved'
      when l.expires_at is not null and l.expires_at < p_assignment_date then 'contractor_documents_expired'
      else null
    end as failure_code
  from required r
  left join latest l using (document_type)
  where l.document_type is null
     or l.status <> 'approved'
     or (l.expires_at is not null and l.expires_at < p_assignment_date);
$$;

create or replace function public.contractor_documents_are_valid(
  p_contractor_id uuid,
  p_assignment_date date default current_date
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.contractor_document_compliance_failures(p_contractor_id, p_assignment_date)
  );
$$;

create or replace function public.block_non_compliant_contractor_assignment()
returns trigger
language plpgsql
as $$
declare
  assignee_role public.user_role;
  assignment_date date;
begin
  if new.assigned_technician is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.assigned_technician is not distinct from old.assigned_technician
     and new.assigned_date is not distinct from old.assigned_date then
    return new;
  end if;

  select role into assignee_role
  from public.profiles
  where id = new.assigned_technician;

  if assignee_role <> 'contractor' then
    return new;
  end if;

  assignment_date := coalesce(new.assigned_date, current_date);

  if not public.contractor_documents_are_valid(new.assigned_technician, assignment_date) then
    raise exception 'contractor assignment blocked: contractor documents are incomplete, unapproved, or expired'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_work_order_assignment_compliance on public.work_orders;
create trigger enforce_work_order_assignment_compliance
  before insert or update of assigned_technician, assigned_date on public.work_orders
  for each row execute function public.block_non_compliant_contractor_assignment();

create or replace function public.enforce_work_order_lifecycle_invariants()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'client_accepted' and new.client_id is not null then
    if not exists (
      select 1 from public.certification_audits ca
      where ca.work_order_id = new.id and ca.cert_type = 'client'
    ) then
      raise exception 'client acceptance requires client certification audit'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'invoiced' and new.client_id is not null then
    if old.status <> 'client_accepted' or not exists (
      select 1 from public.certification_audits ca
      where ca.work_order_id = new.id and ca.cert_type = 'client'
    ) then
      raise exception 'client-backed invoice requires client_accepted status and client audit'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'invoiced' and new.client_id is null then
    if old.status <> 'internally_certified' or not exists (
      select 1 from public.certification_audits ca
      where ca.work_order_id = new.id and ca.cert_type = 'internal'
    ) then
      raise exception 'direct invoice requires internally_certified status and internal audit'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_work_order_lifecycle_invariants on public.work_orders;
create trigger enforce_work_order_lifecycle_invariants
  before update of status on public.work_orders
  for each row execute function public.enforce_work_order_lifecycle_invariants();

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

create or replace function public.assert_work_order_rueckmeldung_complete(
  p_work_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_type public.work_type;
  missing_photo_types text[];
begin
  select work_type into order_type from public.work_orders where id = p_work_order_id;

  if order_type is null then
    raise exception 'work order not found' using errcode = 'check_violation';
  end if;

  if order_type = 'soplado' and not exists (
    select 1 from public.wo_detail_soplado
    where work_order_id = p_work_order_id
      and coalesce(meters, 0) > 0
      and length(trim(coalesce(section, ''))) > 0
      and length(trim(coalesce(tube_diameter, ''))) > 0
      and length(trim(coalesce(result, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for soplado' using errcode = 'check_violation';
  elsif order_type in ('fusion_ap', 'fusion_dp') and not exists (
    select 1 from public.wo_detail_fusion_ap
    where work_order_id = p_work_order_id
      and coalesce(splice_count, 0) > 0
      and length(trim(coalesce(fiber_type, ''))) > 0
      and has_measurement_cert is true
  ) and not exists (
    select 1 from public.wo_detail_fusion_dp
    where work_order_id = p_work_order_id
      and coalesce(splice_count, 0) > 0
      and length(trim(coalesce(fiber_type, ''))) > 0
      and has_measurement_cert is true
  ) then
    raise exception 'Rückmeldung unvollständig for fusion' using errcode = 'check_violation';
  elsif order_type = 'alta' and not exists (
    select 1 from public.wo_detail_alta
    where work_order_id = p_work_order_id
      and length(trim(coalesce(access_type, ''))) > 0
      and length(trim(coalesce(equipment_installed, ''))) > 0
      and client_signature is true
  ) then
    raise exception 'Rückmeldung unvollständig for alta' using errcode = 'check_violation';
  elsif order_type = 'nt_installation' and not exists (
    select 1 from public.wo_detail_nt
    where work_order_id = p_work_order_id
      and length(trim(coalesce(nt_type, ''))) > 0
      and length(trim(coalesce(serial_number, ''))) > 0
      and length(trim(coalesce(location, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for nt_installation' using errcode = 'check_violation';
  elsif order_type = 'patchkabel' and not exists (
    select 1 from public.wo_detail_patchkabel
    where work_order_id = p_work_order_id
      and length(trim(coalesce(connected_section, ''))) > 0
      and coalesce(cable_length, 0) > 0
      and length(trim(coalesce(connector_type, ''))) > 0
      and length(trim(coalesce(test_result, ''))) > 0
  ) then
    raise exception 'Rückmeldung unvollständig for patchkabel' using errcode = 'check_violation';
  end if;

  select array_agg(required_photo)
    into missing_photo_types
  from unnest(array['before', 'during', 'after']) as required_photo
  where not exists (
    select 1 from public.work_order_photos
    where work_order_id = p_work_order_id
      and photo_type = required_photo
  );

  if coalesce(array_length(missing_photo_types, 1), 0) > 0 then
    raise exception 'Fehlende Fotos: %', array_to_string(missing_photo_types, ', ')
      using errcode = 'check_violation';
  end if;
end;
$$;

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
