-- Stipend recommendation management for human-approved employee evaluations.
-- Evaluation results, stipend recommendations, and payment records remain separate.

create table public.stipend_base_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  department_id uuid references public.departments(id) on delete restrict,
  employee_id uuid references public.users(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stipend_base_configs_one_scope_check
    check (not (department_id is not null and employee_id is not null)),
  constraint stipend_base_configs_dates_check
    check (effective_to is null or effective_to >= effective_from)
);

create index stipend_base_configs_resolution_idx
  on public.stipend_base_configs (
    employee_id,
    department_id,
    status,
    effective_from desc,
    effective_to
  );

alter table public.stipend_recommendations
  add column base_config_id uuid references public.stipend_base_configs(id) on delete restrict,
  add column base_stipend_amount numeric(14,2)
    check (base_stipend_amount is null or base_stipend_amount > 0),
  add column formula_recommended_amount numeric(14,2)
    check (formula_recommended_amount is null or formula_recommended_amount >= 0),
  add column final_approved_amount numeric(14,2)
    check (final_approved_amount is null or final_approved_amount >= 0),
  add column amount_adjustment numeric(14,2),
  add column amount_adjustment_reason text,
  add column approved_by uuid references public.users(id) on delete restrict,
  add column approved_at timestamptz,
  add constraint stipend_recommendations_base_snapshot_check check (
    (base_config_id is null and base_stipend_amount is null)
    or (base_config_id is not null and base_stipend_amount is not null)
  ),
  add constraint stipend_recommendations_approval_metadata_check check (
    (status <> 'approved' and final_approved_amount is null and approved_by is null and approved_at is null)
    or (status = 'approved' and final_approved_amount is not null and approved_by is not null and approved_at is not null)
  ),
  add constraint stipend_recommendations_adjustment_reason_check check (
    final_approved_amount is null
    or final_approved_amount = recommended_amount
    or coalesce(btrim(amount_adjustment_reason), '') <> ''
  ),
  add constraint stipend_recommendations_formula_check check (
    recommendation_mode = 'manual'
    or formula_recommended_amount is null
    or formula_recommended_amount = round(base_stipend_amount * recommended_percentage / 100.00, 2)
  );

create index stipend_recommendations_management_idx
  on public.stipend_recommendations (status, evaluation_id, updated_at desc);

-- Sensitive writes are RPC-only. Existing participant read policies remain in place.
drop policy if exists "Department managers can create stipend recommendations"
  on public.stipend_recommendations;
drop policy if exists "Department managers can update stipend recommendations"
  on public.stipend_recommendations;
drop policy if exists "Admins can delete draft stipend recommendations"
  on public.stipend_recommendations;

alter table public.stipend_base_configs enable row level security;
revoke all on table public.stipend_base_configs from anon, authenticated;
grant select on table public.stipend_base_configs to authenticated;
grant all on table public.stipend_base_configs to service_role;

create policy "Managers can read applicable base stipend configs"
  on public.stipend_base_configs for select to authenticated
  using (
    public.evaluation_is_admin()
    or (
      public.evaluation_is_active_user()
      and exists (
        select 1 from public.users manager
        where manager.id = auth.uid()
          and manager.role = 'department_lead'
          and (
            stipend_base_configs.department_id is null
            or stipend_base_configs.department_id = manager.department_id
            or exists (
              select 1 from public.users employee
              where employee.id = stipend_base_configs.employee_id
                and employee.department_id = manager.department_id
            )
          )
      )
    )
  );

create or replace function public.validate_stipend_base_config()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  employee_department_id uuid;
begin
  new.name := btrim(new.name);
  new.currency := upper(new.currency);
  if new.employee_id is not null then
    select department_id into employee_department_id
    from public.users where id = new.employee_id and status = 'active';
    if not found then raise exception 'Base stipend employee must be active.'; end if;
  end if;
  if new.status = 'active' and exists (
    select 1 from public.stipend_base_configs existing
    where existing.id <> new.id
      and existing.status = 'active'
      and existing.department_id is not distinct from new.department_id
      and existing.employee_id is not distinct from new.employee_id
      and daterange(existing.effective_from, coalesce(existing.effective_to, 'infinity'::date), '[]')
        && daterange(new.effective_from, coalesce(new.effective_to, 'infinity'::date), '[]')
  ) then
    raise exception 'Active base stipend configurations cannot overlap for the same scope.';
  end if;
  if tg_op = 'UPDATE' then
    if new.department_id is distinct from old.department_id
      or new.employee_id is distinct from old.employee_id
      or new.effective_from is distinct from old.effective_from then
      raise exception 'Base stipend scope and effective start are immutable; create a new version instead.';
    end if;
  end if;
  return new;
end;
$$;

create trigger stipend_base_configs_updated_at
  before update on public.stipend_base_configs
  for each row execute function public.set_evaluation_updated_at();
create trigger stipend_base_configs_validate
  before insert or update on public.stipend_base_configs
  for each row execute function public.validate_stipend_base_config();

alter table public.evaluation_audit_history
  drop constraint evaluation_audit_history_entity_type_check,
  add constraint evaluation_audit_history_entity_type_check check (entity_type in (
    'weight_config', 'evaluation_period', 'attendance', 'employee_evaluation',
    'component_score', 'stipend_recommendation', 'evaluation_approval', 'payment',
    'evaluation_review_round', 'evaluation_review_comment', 'stipend_base_config'
  ));

create or replace function public.capture_stipend_base_config_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_row jsonb;
  actor_id uuid;
begin
  audit_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  actor_id := coalesce(
    auth.uid(),
    nullif(current_setting('app.actor_user_id', true), '')::uuid,
    (audit_row ->> 'updated_by')::uuid,
    (audit_row ->> 'created_by')::uuid
  );
  insert into public.evaluation_audit_history (
    entity_type, entity_id, action, department_id, actor_user_id,
    old_values, new_values, request_id, reason
  ) values (
    'stipend_base_config', (audit_row ->> 'id')::uuid, lower(tg_op),
    nullif(audit_row ->> 'department_id', '')::uuid, actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger stipend_base_configs_audit
  after insert or update or delete on public.stipend_base_configs
  for each row execute function public.capture_stipend_base_config_audit();

create or replace function public.validate_stipend_recommendation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  evaluation_status text;
  evaluation_calculation_status text;
begin
  select status, calculation_status
  into evaluation_status, evaluation_calculation_status
  from public.employee_evaluations where id = new.evaluation_id;
  if evaluation_status not in ('approved', 'finalized') then
    raise exception 'Stipend recommendations may be created only after employee evaluation approval.';
  end if;

  new.currency := upper(new.currency);
  if new.status in ('recommended', 'approved') and new.recommended_at is null then
    new.recommended_at := now();
    new.recommended_by := coalesce(new.recommended_by, nullif(current_setting('app.actor_user_id', true), '')::uuid, auth.uid());
  end if;
  if new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, nullif(current_setting('app.actor_user_id', true), '')::uuid, auth.uid());
  end if;

  if tg_op = 'UPDATE' then
    if new.evaluation_id is distinct from old.evaluation_id
      or new.version is distinct from old.version
      or new.base_config_id is distinct from old.base_config_id
      or new.base_stipend_amount is distinct from old.base_stipend_amount
      or new.recommendation_mode is distinct from old.recommendation_mode
      or new.recommended_percentage is distinct from old.recommended_percentage
      or new.formula_recommended_amount is distinct from old.formula_recommended_amount
      or new.recommended_amount is distinct from old.recommended_amount
      or new.currency is distinct from old.currency then
      raise exception 'Recommendation evaluation, basis, formula, and proposed financial terms are immutable.';
    end if;
    if old.status = 'approved' and to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception 'Approved stipend recommendations are immutable.';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status in ('recommended', 'cancelled'))
      or (old.status = 'recommended' and new.status in ('approved', 'rejected', 'superseded', 'cancelled'))
      or (old.status = 'rejected' and new.status = 'superseded')
    ) then raise exception 'Invalid stipend recommendation status transition: % to %.', old.status, new.status; end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_stipend_recommendation(
  p_evaluation_id uuid,
  p_actor_id uuid,
  p_base_config_id uuid default null,
  p_manual_amount numeric default null,
  p_reason text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_row public.employee_evaluations%rowtype;
  period_end date;
  actor_role text;
  actor_status text;
  actor_department_id uuid;
  base_row public.stipend_base_configs%rowtype;
  recommendation_id uuid;
  next_version integer;
  mode text;
  percentage numeric(5,2);
  formula_amount numeric(14,2);
  proposed_amount numeric(14,2);
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor identity does not match the authenticated principal.';
  end if;
  select * into evaluation_row from public.employee_evaluations
  where id = p_evaluation_id for update;
  if not found then raise exception 'Employee evaluation was not found.'; end if;
  if evaluation_row.status not in ('approved', 'finalized')
    or evaluation_row.current_approval_status <> 'approved'
    or evaluation_row.approved_score is null then
    raise exception 'Stipend recommendations require an approved employee evaluation.';
  end if;
  select role, status, department_id into actor_role, actor_status, actor_department_id
  from public.users where id = p_actor_id;
  if actor_status is distinct from 'active'
    or actor_role not in ('admin', 'department_lead')
    or (actor_role = 'department_lead' and actor_department_id is distinct from evaluation_row.department_id) then
    raise exception 'An authorized active manager is required.';
  end if;
  if evaluation_row.employee_id = p_actor_id then
    raise exception 'Employees cannot create their own stipend recommendation.';
  end if;
  if exists (
    select 1 from public.stipend_recommendations
    where evaluation_id = p_evaluation_id and status in ('draft', 'recommended', 'approved')
  ) then raise exception 'This evaluation already has a current stipend recommendation.'; end if;

  select end_date into period_end from public.evaluation_periods
  where id = evaluation_row.evaluation_period_id;
  select * into base_row from public.stipend_base_configs
  where status = 'active'
    and effective_from <= period_end and (effective_to is null or effective_to >= period_end)
    and (
      employee_id = evaluation_row.employee_id
      or department_id = evaluation_row.department_id
      or (employee_id is null and department_id is null)
    )
  order by
    (employee_id = evaluation_row.employee_id) desc,
    (department_id = evaluation_row.department_id) desc,
    effective_from desc
  limit 1;
  if base_row.id is null then raise exception 'No applicable active base stipend configuration was found.'; end if;
  if p_base_config_id is not null and p_base_config_id is distinct from base_row.id then
    raise exception 'The selected base stipend is stale or is not the highest-priority applicable configuration.';
  end if;

  mode := case
    when evaluation_row.approved_score < 60 or evaluation_row.approved_stipend_mode = 'manual'
      then 'manual'
    else 'percentage'
  end;
  if mode = 'manual' then
    if p_manual_amount is null or p_manual_amount <= 0 then
      raise exception 'A positive manual stipend amount is required for Review Required evaluations.';
    end if;
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'A reason is required for every manual stipend decision.';
    end if;
    percentage := null;
    formula_amount := null;
    proposed_amount := round(p_manual_amount, 2);
  else
    percentage := evaluation_row.approved_stipend_percentage;
    if percentage is null then raise exception 'The approved stipend percentage is missing.'; end if;
    formula_amount := round(base_row.amount * percentage / 100.00, 2);
    proposed_amount := formula_amount;
  end if;

  perform set_config('app.actor_user_id', p_actor_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, gen_random_uuid())::text, true);
  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_reason), ''), ''), true);
  select coalesce(max(version), 0) + 1 into next_version
  from public.stipend_recommendations where evaluation_id = p_evaluation_id;

  insert into public.stipend_recommendations (
    evaluation_id, review_round_id, version, status, recommendation_source,
    recommendation_mode, recommended_percentage, base_config_id,
    base_stipend_amount, formula_recommended_amount, recommended_amount,
    currency, rationale, policy_snapshot, created_by, recommended_by, recommended_at
  ) values (
    p_evaluation_id, evaluation_row.approved_review_round_id, next_version, 'recommended',
    case when mode = 'manual' then 'manual' else 'rules' end,
    mode, percentage, base_row.id, base_row.amount, formula_amount, proposed_amount,
    base_row.currency,
    case when mode = 'manual' then btrim(p_reason)
      else format('Base stipend %s %s × approved stipend percentage %s%%.', base_row.currency, base_row.amount, percentage)
    end,
    jsonb_build_object(
      'baseConfigId', base_row.id,
      'baseAmount', base_row.amount,
      'currency', base_row.currency,
      'approvedScore', evaluation_row.approved_score,
      'approvedPerformanceBand', evaluation_row.approved_performance_band,
      'approvedStipendPercentage', evaluation_row.approved_stipend_percentage,
      'formula', 'base_stipend_x_approved_percentage'
    ),
    p_actor_id, p_actor_id, now()
  ) returning id into recommendation_id;
  return recommendation_id;
end;
$$;

create or replace function public.approve_stipend_recommendation(
  p_recommendation_id uuid,
  p_actor_id uuid,
  p_final_amount numeric default null,
  p_adjustment_reason text default null,
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
  final_amount numeric(14,2);
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor identity does not match the authenticated principal.';
  end if;
  select role, status into actor_role, actor_status from public.users where id = p_actor_id;
  if actor_status is distinct from 'active' or actor_role <> 'admin' then
    raise exception 'Only an active administrator may approve or adjust final stipend amounts.';
  end if;
  select * into recommendation_row from public.stipend_recommendations
  where id = p_recommendation_id for update;
  if not found or recommendation_row.status <> 'recommended' then
    raise exception 'A pending stipend recommendation was not found.';
  end if;
  select * into evaluation_row from public.employee_evaluations
  where id = recommendation_row.evaluation_id for update;
  if evaluation_row.employee_id = p_actor_id then
    raise exception 'Employees cannot approve or adjust their own stipend recommendation.';
  end if;
  if evaluation_row.status not in ('approved', 'finalized')
    or evaluation_row.current_approval_status <> 'approved' then
    raise exception 'The employee evaluation must remain approved.';
  end if;

  final_amount := round(coalesce(p_final_amount, recommendation_row.recommended_amount), 2);
  if final_amount < 0 then raise exception 'Final approved amount cannot be negative.'; end if;
  if final_amount is distinct from recommendation_row.recommended_amount
    and coalesce(btrim(p_adjustment_reason), '') = '' then
    raise exception 'A reason is required for every final amount adjustment.';
  end if;

  perform set_config('app.actor_user_id', p_actor_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, gen_random_uuid())::text, true);
  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_adjustment_reason), ''), 'Stipend recommendation approved'), true);

  update public.stipend_recommendations
  set status = 'approved', final_approved_amount = final_amount,
    amount_adjustment = round(final_amount - recommended_amount, 2),
    amount_adjustment_reason = nullif(btrim(p_adjustment_reason), ''),
    approved_by = p_actor_id, approved_at = now(), updated_at = now()
  where id = recommendation_row.id;

  update public.employee_evaluations
  set approved_stipend_recommendation_id = recommendation_row.id,
    updated_at = now()
  where id = evaluation_row.id;
  return recommendation_row.id;
end;
$$;

revoke all on function public.create_stipend_recommendation(uuid, uuid, uuid, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_stipend_recommendation(uuid, uuid, uuid, numeric, text, uuid)
  to service_role;
revoke all on function public.approve_stipend_recommendation(uuid, uuid, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_stipend_recommendation(uuid, uuid, numeric, text, uuid)
  to service_role;

-- Payment remains a separate workflow. If a payment record is created later,
-- it must use the stipend recommendation's human-approved final amount.
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
  if evaluation_row.status not in ('approved', 'finalized') then
    raise exception 'Payments require an approved or finalized employee evaluation.';
  end if;
  if new.review_round_id is null or evaluation_row.approved_review_round_id is distinct from new.review_round_id then
    raise exception 'Payment must use the evaluation approved review round.';
  end if;
  if approval_row.id is distinct from evaluation_row.final_approval_id
    or approval_row.status <> 'approved' then
    raise exception 'Payment must reference the evaluation final human approval.';
  end if;
  if recommendation_row.evaluation_id is distinct from new.evaluation_id
    or recommendation_row.review_round_id is distinct from new.review_round_id
    or recommendation_row.status <> 'approved'
    or recommendation_row.final_approved_amount is null
    or recommendation_row.approved_by is null then
    raise exception 'Payment requires a separately approved stipend recommendation.';
  end if;
  new.employee_id := evaluation_row.employee_id;
  new.department_id := evaluation_row.department_id;
  new.currency := upper(new.currency);
  if new.currency <> recommendation_row.currency
    or new.amount <> recommendation_row.final_approved_amount then
    raise exception 'Payment amount and currency must match the approved stipend recommendation.';
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
      raise exception 'Payment ownership and financial authorization fields are immutable.';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'pending' and new.status in ('scheduled', 'processing', 'cancelled', 'failed'))
      or (old.status = 'scheduled' and new.status in ('processing', 'cancelled', 'failed'))
      or (old.status = 'processing' and new.status in ('paid', 'failed'))
      or (old.status = 'failed' and new.status in ('processing', 'cancelled'))
      or (old.status = 'paid' and new.status = 'reversed')
    ) then raise exception 'Invalid payment status transition: % to %.', old.status, new.status; end if;
  end if;
  return new;
end;
$$;

comment on table public.stipend_base_configs is
  'Versioned global, department, or employee base stipend amounts used to calculate recommendations.';
comment on column public.stipend_recommendations.formula_recommended_amount is
  'Database-calculated Base Stipend × Approved Stipend Percentage amount; null for manual Review Required decisions.';
comment on column public.stipend_recommendations.final_approved_amount is
  'Human-approved stipend amount. This is not a payment and does not mark any payment record paid.';
