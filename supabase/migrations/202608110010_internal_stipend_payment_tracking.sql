-- Internal stipend payment tracking. This migration does not integrate a
-- payment gateway and never performs an external financial transaction.

alter table public.payment_records
  drop constraint payment_records_status_check,
  drop constraint payment_records_amount_check,
  add constraint payment_records_amount_check check (amount >= 0),
  add column approved_by uuid references public.users(id) on delete restrict,
  add column approved_at timestamptz,
  add column held_by uuid references public.users(id) on delete restrict,
  add column held_at timestamptz,
  add column hold_reason text,
  add column payment_date date,
  add column payment_reference text,
  add column notes text;

-- Preserve and best-effort backfill records created under the earlier generic
-- lifecycle. Temporarily disable the prior lifecycle validator because its old
-- transitions and origin checks do not understand the normalized tracking states.
alter table public.payment_records disable trigger payment_records_validate;

update public.payment_records
set status = case status
    when 'scheduled' then 'approved'
    when 'processing' then 'approved'
    when 'failed' then 'held'
    when 'cancelled' then 'held'
    when 'reversed' then 'held'
    else status
  end,
  approved_by = case when status in ('scheduled', 'processing', 'paid')
    then coalesce(processed_by, created_by) else approved_by end,
  approved_at = case when status in ('scheduled', 'processing', 'paid')
    then coalesce(processed_at, paid_at, created_at) else approved_at end,
  held_by = case when status in ('failed', 'cancelled', 'reversed')
    then coalesce(processed_by, created_by) else held_by end,
  held_at = case when status in ('failed', 'cancelled', 'reversed')
    then coalesce(failed_at, reversed_at, processed_at, created_at) else held_at end,
  hold_reason = case when status in ('failed', 'cancelled', 'reversed')
    then coalesce(nullif(failure_message, ''), 'Migrated from legacy payment status') else hold_reason end,
  payment_date = case when status = 'paid'
    then coalesce(paid_at::date, processed_at::date, created_at::date) else payment_date end,
  payment_reference = case when status = 'paid'
    then coalesce(nullif(provider_reference, ''), nullif(receipt_reference, ''), idempotency_key) else payment_reference end;

alter table public.payment_records enable trigger payment_records_validate;

alter table public.payment_records
  add constraint payment_records_status_check
    check (status in ('pending', 'approved', 'paid', 'held')) not valid,
  add constraint payment_records_text_lengths_check check (
    char_length(coalesce(payment_reference, '')) <= 240
    and char_length(coalesce(notes, '')) <= 5000
    and char_length(coalesce(hold_reason, '')) <= 5000
  ),
  add constraint payment_records_approval_metadata_check check (
    (status = 'pending' and approved_by is null and approved_at is null)
    or (status in ('approved', 'paid') and approved_by is not null and approved_at is not null)
    or status = 'held'
  ) not valid,
  add constraint payment_records_hold_metadata_check check (
    status <> 'held'
    or (held_by is not null and held_at is not null and coalesce(btrim(hold_reason), '') <> '')
  ) not valid,
  add constraint payment_records_paid_metadata_check check (
    status <> 'paid'
    or (
      processed_by is not null and processed_at is not null and paid_at is not null
      and payment_date is not null and coalesce(btrim(payment_reference), '') <> ''
    )
  ) not valid;

create unique index payment_records_one_tracking_record_uidx
  on public.payment_records (stipend_recommendation_id)
  where idempotency_key like 'stipend-tracking:%';
create index payment_records_tracking_status_idx
  on public.payment_records (status, department_id, created_at desc);

-- Sensitive writes are server-only RPC operations.
drop policy if exists "Admins can create payments" on public.payment_records;
drop policy if exists "Admins can process payments" on public.payment_records;

drop policy if exists "Employees can read own payments" on public.payment_records;
create policy "Employees and managers can read stipend payment tracking"
  on public.payment_records for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      employee_id = auth.uid()
      or public.evaluation_is_admin()
      or public.evaluation_can_manage_department(department_id)
    )
  );

create or replace function public.validate_payment_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  evaluation_row public.employee_evaluations%rowtype;
  recommendation_row public.stipend_recommendations%rowtype;
  approval_row public.evaluation_approvals%rowtype;
begin
  select * into evaluation_row from public.employee_evaluations where id = new.evaluation_id;
  select * into recommendation_row from public.stipend_recommendations where id = new.stipend_recommendation_id;
  select * into approval_row from public.evaluation_approvals where id = new.approval_id;

  if evaluation_row.status not in ('approved', 'finalized')
    or evaluation_row.current_approval_status <> 'approved' then
    raise exception 'Payment tracking requires an approved employee evaluation.';
  end if;
  if new.review_round_id is null
    or evaluation_row.approved_review_round_id is distinct from new.review_round_id then
    raise exception 'Payment tracking must use the evaluation approved review round.';
  end if;
  if approval_row.id is distinct from evaluation_row.final_approval_id
    or approval_row.evaluation_id is distinct from new.evaluation_id
    or approval_row.review_round_id is distinct from new.review_round_id
    or approval_row.status <> 'approved' then
    raise exception 'Payment tracking must reference the evaluation final human approval.';
  end if;
  if evaluation_row.approved_stipend_recommendation_id is distinct from recommendation_row.id
    or recommendation_row.evaluation_id is distinct from new.evaluation_id
    or recommendation_row.review_round_id is distinct from new.review_round_id
    or recommendation_row.status <> 'approved'
    or recommendation_row.final_approved_amount is null
    or recommendation_row.approved_by is null then
    raise exception 'Payment tracking requires a separately approved stipend recommendation.';
  end if;

  new.employee_id := evaluation_row.employee_id;
  new.department_id := evaluation_row.department_id;
  new.currency := upper(new.currency);
  if new.currency <> recommendation_row.currency
    or new.amount <> recommendation_row.final_approved_amount then
    raise exception 'Tracked payment amount and currency must match the approved stipend recommendation.';
  end if;

  if tg_op = 'UPDATE' then
    if new.evaluation_id is distinct from old.evaluation_id
      or new.review_round_id is distinct from old.review_round_id
      or new.stipend_recommendation_id is distinct from old.stipend_recommendation_id
      or new.approval_id is distinct from old.approval_id
      or new.employee_id is distinct from old.employee_id
      or new.department_id is distinct from old.department_id
      or new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.idempotency_key is distinct from old.idempotency_key then
      raise exception 'Payment ownership and approved financial terms are immutable.';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'pending' and new.status in ('approved', 'held'))
      or (old.status = 'approved' and new.status in ('paid', 'held'))
      or (old.status = 'held' and new.status in ('pending', 'approved'))
    ) then
      raise exception 'Invalid internal payment status transition: % to %.', old.status, new.status;
    end if;
    if old.status = 'paid' and to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception 'Paid stipend tracking records are immutable.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_stipend_payment_tracking(
  p_stipend_recommendation_id uuid,
  p_actor_id uuid,
  p_notes text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.stipend_recommendations%rowtype;
  evaluation_row public.employee_evaluations%rowtype;
  actor_role text;
  actor_status text;
  payment_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor identity does not match the authenticated principal.';
  end if;
  select role, status into actor_role, actor_status from public.users where id = p_actor_id;
  if actor_status is distinct from 'active' or actor_role <> 'admin' then
    raise exception 'Only an active administrator may create payment tracking records.';
  end if;
  select * into recommendation_row from public.stipend_recommendations
  where id = p_stipend_recommendation_id for update;
  if not found or recommendation_row.status <> 'approved'
    or recommendation_row.final_approved_amount is null then
    raise exception 'An approved stipend recommendation is required.';
  end if;
  select * into evaluation_row from public.employee_evaluations
  where id = recommendation_row.evaluation_id for update;
  if evaluation_row.employee_id = p_actor_id then
    raise exception 'Employees cannot create their own payment tracking record.';
  end if;
  if char_length(coalesce(p_notes, '')) > 5000 then
    raise exception 'Payment notes must be 5000 characters or fewer.';
  end if;

  perform set_config('app.actor_user_id', p_actor_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, gen_random_uuid())::text, true);
  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_notes), ''), 'Payment tracking record created'), true);

  insert into public.payment_records (
    evaluation_id, review_round_id, stipend_recommendation_id, approval_id,
    employee_id, department_id, amount, currency, status,
    idempotency_key, notes, created_by
  ) values (
    evaluation_row.id, evaluation_row.approved_review_round_id,
    recommendation_row.id, evaluation_row.final_approval_id,
    evaluation_row.employee_id, evaluation_row.department_id,
    recommendation_row.final_approved_amount, recommendation_row.currency,
    'pending', 'stipend-tracking:' || recommendation_row.id::text,
    nullif(btrim(p_notes), ''), p_actor_id
  ) returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.update_stipend_payment_tracking(
  p_payment_id uuid,
  p_action text,
  p_actor_id uuid,
  p_payment_date date default null,
  p_payment_reference text default null,
  p_notes text default null,
  p_reason text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payment_records%rowtype;
  actor_role text;
  actor_status text;
begin
  if p_action not in ('approve', 'hold', 'paid', 'release') then
    raise exception 'Payment action must be approve, hold, paid, or release.';
  end if;
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor identity does not match the authenticated principal.';
  end if;
  select role, status into actor_role, actor_status from public.users where id = p_actor_id;
  if actor_status is distinct from 'active' or actor_role <> 'admin' then
    raise exception 'Only an active administrator may change official payment status.';
  end if;
  select * into payment_row from public.payment_records where id = p_payment_id for update;
  if not found then raise exception 'Payment tracking record was not found.'; end if;
  if payment_row.employee_id = p_actor_id then
    raise exception 'Employees cannot approve, hold, or mark their own stipend as paid.';
  end if;
  if char_length(coalesce(p_notes, '')) > 5000
    or char_length(coalesce(p_reason, '')) > 5000 then
    raise exception 'Payment notes and reasons must be 5000 characters or fewer.';
  end if;

  perform set_config('app.actor_user_id', p_actor_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, gen_random_uuid())::text, true);
  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_reason), ''), nullif(btrim(p_notes), ''), p_action), true);

  if p_action = 'approve' then
    if payment_row.status not in ('pending', 'held') then
      raise exception 'Only pending or held records may be approved.';
    end if;
    update public.payment_records
    set status = 'approved', approved_by = p_actor_id, approved_at = now(),
      held_by = null, held_at = null, hold_reason = null,
      notes = coalesce(nullif(btrim(p_notes), ''), notes), updated_at = now()
    where id = payment_row.id;
  elsif p_action = 'hold' then
    if payment_row.status not in ('pending', 'approved') then
      raise exception 'Only pending or approved records may be held.';
    end if;
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'A reason is required when placing a payment on hold.';
    end if;
    update public.payment_records
    set status = 'held', held_by = p_actor_id, held_at = now(),
      hold_reason = btrim(p_reason),
      notes = coalesce(nullif(btrim(p_notes), ''), notes), updated_at = now()
    where id = payment_row.id;
  elsif p_action = 'release' then
    if payment_row.status <> 'held' then raise exception 'Only held records may be released.'; end if;
    update public.payment_records
    set status = 'pending', approved_by = null, approved_at = null,
      held_by = null, held_at = null, hold_reason = null,
      notes = coalesce(nullif(btrim(p_notes), ''), notes), updated_at = now()
    where id = payment_row.id;
  else
    if payment_row.status <> 'approved' then
      raise exception 'Payment must be approved before it can be marked paid.';
    end if;
    if p_payment_date is null then raise exception 'Payment date is required.'; end if;
    if p_payment_date > current_date then raise exception 'Payment date cannot be in the future.'; end if;
    if coalesce(btrim(p_payment_reference), '') = '' then
      raise exception 'Payment reference is required.';
    end if;
    if char_length(btrim(p_payment_reference)) > 240 then
      raise exception 'Payment reference must be 240 characters or fewer.';
    end if;
    update public.payment_records
    set status = 'paid', payment_date = p_payment_date,
      payment_reference = btrim(p_payment_reference),
      processed_by = p_actor_id, processed_at = now(),
      paid_at = p_payment_date::timestamptz,
      notes = coalesce(nullif(btrim(p_notes), ''), notes), updated_at = now()
    where id = payment_row.id;
  end if;
  return payment_row.id;
end;
$$;

revoke all on function public.create_stipend_payment_tracking(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_stipend_payment_tracking(uuid, uuid, text, uuid)
  to service_role;
revoke all on function public.update_stipend_payment_tracking(uuid, text, uuid, date, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_stipend_payment_tracking(uuid, text, uuid, date, text, text, text, uuid)
  to service_role;

comment on table public.payment_records is
  'Internal stipend payment tracking only. Records originate from approved evaluations and approved stipend recommendations; no gateway execution occurs.';
comment on column public.payment_records.payment_reference is
  'Internal or external accounting reference entered by an authorized human when recording payment.';
