-- Bi-weekly evaluation period management.
-- Reuses evaluation_periods and employee_evaluations; no parallel applicability model is introduced.

create extension if not exists btree_gist;

alter table public.evaluation_periods
  add column evaluation_deadline timestamptz,
  add column review_started_by uuid references public.users(id) on delete set null,
  add column review_started_at timestamptz,
  add column approved_by uuid references public.users(id) on delete set null,
  add column approved_at timestamptz,
  drop constraint if exists evaluation_periods_status_check;

alter table public.evaluation_periods disable trigger evaluation_periods_validate;

update public.evaluation_periods
set evaluation_deadline = end_date::timestamptz + interval '7 days 17 hours'
where evaluation_deadline is null;

update public.evaluation_periods set status = 'active' where status = 'open';
update public.evaluation_periods set status = 'under_review' where status in ('scoring', 'pending_approval');


alter table public.evaluation_periods
  alter column evaluation_deadline set not null,
  add constraint evaluation_periods_status_check
    check (status in ('draft', 'active', 'under_review', 'approved', 'closed', 'cancelled')),
  add constraint evaluation_periods_title_length_check
    check (char_length(btrim(name)) between 3 and 120) not valid,
  add constraint evaluation_periods_deadline_check
    check (evaluation_deadline::date >= end_date),
  add constraint evaluation_periods_review_metadata_check
    check (
      (review_started_by is null and review_started_at is null)
      or (review_started_by is not null and review_started_at is not null)
    ),
  add constraint evaluation_periods_approval_metadata_check
    check (
      (approved_by is null and approved_at is null)
      or (approved_by is not null and approved_at is not null)
    );

create index evaluation_periods_deadline_status_idx
  on public.evaluation_periods (status, evaluation_deadline)
  where status not in ('closed', 'cancelled');

alter table public.evaluation_periods
  add constraint evaluation_periods_no_department_overlap
  exclude using gist (
    department_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'cancelled');

create or replace function public.protect_evaluation_period_management_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.status <> 'draft'
      or new.opened_by is not null
      or new.opened_at is not null
      or new.review_started_by is not null
      or new.review_started_at is not null
      or new.approved_by is not null
      or new.approved_at is not null
      or new.closed_by is not null
      or new.closed_at is not null then
      raise exception 'New evaluation periods must begin as an unprocessed Draft.';
    end if;
  elsif new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or (old.status <> 'draft' and new.evaluation_deadline is distinct from old.evaluation_deadline)
    or new.status is distinct from old.status
    or new.opened_by is distinct from old.opened_by
    or new.opened_at is distinct from old.opened_at
    or new.review_started_by is distinct from old.review_started_by
    or new.review_started_at is distinct from old.review_started_at
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.closed_by is distinct from old.closed_by
    or new.closed_at is distinct from old.closed_at then
    raise exception 'Evaluation-period lifecycle and audit fields can only be changed by the server management service.';
  end if;

  return new;
end;
$$;

create trigger evaluation_periods_protect_management_fields
  before insert or update on public.evaluation_periods
  for each row execute function public.protect_evaluation_period_management_fields();

create or replace function public.validate_evaluation_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  config_department_id uuid;
  config_status text;
  config_effective_from date;
  config_effective_to date;
  evaluation_count integer;
  incomplete_evaluation_count integer;
begin
  select
    config.department_id,
    config.status,
    config.effective_from,
    config.effective_to
  into
    config_department_id,
    config_status,
    config_effective_from,
    config_effective_to
  from public.evaluation_weight_configs config
  where config.id = new.weight_config_id;

  if not found then
    raise exception 'Evaluation weight configuration does not exist.';
  end if;

  if config_status <> 'active' then
    raise exception 'Evaluation periods must use an active weight configuration.';
  end if;

  if config_department_id is not null and config_department_id <> new.department_id then
    raise exception 'Department weight configuration does not match the evaluation period department.';
  end if;

  if new.start_date < config_effective_from
    or (config_effective_to is not null and new.end_date > config_effective_to) then
    raise exception 'Evaluation period falls outside the weight configuration effective dates.';
  end if;

  if new.evaluation_deadline::date < new.end_date then
    raise exception 'Evaluation deadline cannot be before the period end date.';
  end if;

  if new.status <> 'cancelled' and exists (
    select 1
    from public.evaluation_periods existing
    where existing.id <> new.id
      and existing.department_id = new.department_id
      and existing.status <> 'cancelled'
      and daterange(existing.start_date, existing.end_date, '[]')
          && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'Evaluation periods cannot overlap within a department.';
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New evaluation periods must begin in Draft status.';
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('closed', 'cancelled') and to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception 'Closed or cancelled evaluation periods are immutable.';
    end if;

    if old.status <> 'draft' and (
      new.department_id is distinct from old.department_id
      or new.weight_config_id is distinct from old.weight_config_id
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
    ) then
      raise exception 'Department, scoring configuration, and period dates are immutable after activation.';
    end if;

    if exists (
      select 1 from public.employee_evaluations evaluation
      where evaluation.evaluation_period_id = old.id
    ) and (
      new.department_id is distinct from old.department_id
      or new.weight_config_id is distinct from old.weight_config_id
    ) then
      raise exception 'Period department and scoring configuration are immutable once employees are assigned.';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status = 'active')
      or (old.status = 'active' and new.status = 'under_review')
      or (old.status = 'under_review' and new.status in ('active', 'approved'))
      or (old.status = 'approved' and new.status = 'closed')
    ) then
      raise exception 'Invalid evaluation period status transition: % to %.', old.status, new.status;
    end if;
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    select count(*) into evaluation_count
    from public.employee_evaluations evaluation
    where evaluation.evaluation_period_id = new.id
      and evaluation.status <> 'cancelled';

    if evaluation_count = 0 then
      raise exception 'An Active period requires at least one applicable employee.';
    end if;
  end if;

  if new.status = 'approved' and new.status is distinct from old.status then
    select
      count(*),
      count(*) filter (where evaluation.status not in ('approved', 'finalized'))
    into evaluation_count, incomplete_evaluation_count
    from public.employee_evaluations evaluation
    where evaluation.evaluation_period_id = new.id
      and evaluation.status <> 'cancelled';

    if evaluation_count = 0 or incomplete_evaluation_count > 0 then
      raise exception 'Every applicable employee evaluation must be human-approved before the period can be Approved.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_evaluation_component_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_weight numeric(5,2);
  evaluation_status text;
  period_status text;
  period_deadline timestamptz;
begin
  select
    case new.component
      when 'task_performance' then config.task_performance_weight
      when 'reporting_performance' then config.reporting_performance_weight
      when 'attendance' then config.attendance_weight
    end,
    evaluation.status,
    period.status,
    period.evaluation_deadline
  into expected_weight, evaluation_status, period_status, period_deadline
  from public.employee_evaluations evaluation
  join public.evaluation_weight_configs config on config.id = evaluation.weight_config_id
  join public.evaluation_periods period on period.id = evaluation.evaluation_period_id
  where evaluation.id = new.evaluation_id;

  if not found then
    raise exception 'Evaluation does not exist.';
  end if;

  if evaluation_status in ('pending_approval', 'approved', 'finalized', 'cancelled') then
    raise exception 'Scores for evaluations awaiting or completing approval are immutable.';
  end if;

  if tg_op = 'UPDATE' and (
    period_status not in ('active', 'under_review')
    or now() > period_deadline
  ) then
    raise exception 'Evaluation components can only be calculated during an Active or Under Review period before its deadline.';
  end if;

  if tg_op = 'UPDATE' and (
    new.evaluation_id is distinct from old.evaluation_id
    or new.component is distinct from old.component
  ) then
    raise exception 'Evaluation score ownership and component are immutable.';
  end if;

  new.weight := expected_weight;
  if new.raw_score is not null and new.calculated_at is null then
    new.calculated_at := now();
    new.calculated_by := coalesce(new.calculated_by, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.validate_evaluation_calculation_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  period_status text;
  period_deadline timestamptz;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.calculation_status is distinct from old.calculation_status
    or new.overall_score is distinct from old.overall_score
    or new.performance_band is distinct from old.performance_band
    or new.calculated_stipend_percentage is distinct from old.calculated_stipend_percentage
    or new.calculation_snapshot is distinct from old.calculation_snapshot then
    select period.status, period.evaluation_deadline
    into period_status, period_deadline
    from public.evaluation_periods period
    where period.id = new.evaluation_period_id;

    if period_status not in ('active', 'under_review') or now() > period_deadline then
      raise exception 'Central evaluation results can only be written during an Active or Under Review period before its deadline.';
    end if;
  end if;

  return new;
end;
$$;

create trigger employee_evaluations_validate_calculation_window
  before update on public.employee_evaluations
  for each row execute function public.validate_evaluation_calculation_window();

create or replace function public.create_managed_evaluation_period(
  p_department_id uuid,
  p_weight_config_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_evaluation_deadline timestamptz,
  p_employee_ids uuid[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_id uuid;
  valid_employee_count integer;
begin
  if coalesce(cardinality(p_employee_ids), 0) = 0 then
    raise exception 'At least one applicable employee is required.';
  end if;

  select count(distinct employee.id)
  into valid_employee_count
  from public.users employee
  where employee.id = any(p_employee_ids)
    and employee.department_id = p_department_id
    and employee.status = 'active';

  if valid_employee_count <> cardinality(p_employee_ids) then
    raise exception 'Every applicable employee must be active and belong to the selected department.';
  end if;

  insert into public.evaluation_periods (
    department_id,
    weight_config_id,
    name,
    period_type,
    start_date,
    end_date,
    evaluation_deadline,
    status,
    created_by
  ) values (
    p_department_id,
    p_weight_config_id,
    btrim(p_title),
    'biweekly',
    p_start_date,
    p_end_date,
    p_evaluation_deadline,
    'draft',
    p_actor_id
  ) returning id into period_id;

  insert into public.employee_evaluations (
    employee_id,
    evaluation_period_id,
    department_id,
    weight_config_id,
    status,
    employee_name_snapshot,
    department_name_snapshot,
    created_by
  )
  select
    requested.employee_id,
    period_id,
    p_department_id,
    p_weight_config_id,
    'draft',
    'Pending trigger snapshot',
    'Pending trigger snapshot',
    p_actor_id
  from unnest(p_employee_ids) as requested(employee_id);

  return period_id;
end;
$$;

create or replace function public.update_managed_draft_evaluation_period(
  p_period_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_evaluation_deadline timestamptz,
  p_employee_ids uuid[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_row public.evaluation_periods%rowtype;
  valid_employee_count integer;
begin
  select * into period_row
  from public.evaluation_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'Evaluation period was not found.';
  end if;
  if period_row.status <> 'draft' then
    raise exception 'Only Draft periods can change dates or applicable employees.';
  end if;
  if coalesce(cardinality(p_employee_ids), 0) = 0 then
    raise exception 'At least one applicable employee is required.';
  end if;

  select count(distinct employee.id)
  into valid_employee_count
  from public.users employee
  where employee.id = any(p_employee_ids)
    and employee.department_id = period_row.department_id
    and employee.status = 'active';

  if valid_employee_count <> cardinality(p_employee_ids) then
    raise exception 'Every applicable employee must be active and belong to the selected department.';
  end if;

  if exists (
    select 1
    from public.employee_evaluations evaluation
    where evaluation.evaluation_period_id = p_period_id
      and not (evaluation.employee_id = any(p_employee_ids))
      and (
        evaluation.status <> 'draft'
        or evaluation.calculation_status <> 'not_calculated'
      )
  ) then
    raise exception 'Employees with started or completed evaluations cannot be removed from the period.';
  end if;

  delete from public.employee_evaluations evaluation
  where evaluation.evaluation_period_id = p_period_id
    and not (evaluation.employee_id = any(p_employee_ids));

  insert into public.employee_evaluations (
    employee_id,
    evaluation_period_id,
    department_id,
    weight_config_id,
    status,
    employee_name_snapshot,
    department_name_snapshot,
    created_by
  )
  select
    requested.employee_id,
    p_period_id,
    period_row.department_id,
    period_row.weight_config_id,
    'draft',
    'Pending trigger snapshot',
    'Pending trigger snapshot',
    p_actor_id
  from unnest(p_employee_ids) as requested(employee_id)
  where not exists (
    select 1
    from public.employee_evaluations existing
    where existing.evaluation_period_id = p_period_id
      and existing.employee_id = requested.employee_id
  );

  update public.evaluation_periods
  set
    name = btrim(p_title),
    start_date = p_start_date,
    end_date = p_end_date,
    evaluation_deadline = p_evaluation_deadline
  where id = p_period_id;

  return p_period_id;
end;
$$;

revoke all on function public.create_managed_evaluation_period(uuid, uuid, text, date, date, timestamptz, uuid[], uuid)
  from public, anon, authenticated;
revoke all on function public.update_managed_draft_evaluation_period(uuid, text, date, date, timestamptz, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.create_managed_evaluation_period(uuid, uuid, text, date, date, timestamptz, uuid[], uuid)
  to service_role;
grant execute on function public.update_managed_draft_evaluation_period(uuid, text, date, date, timestamptz, uuid[], uuid)
  to service_role;

alter table public.evaluation_periods enable trigger evaluation_periods_validate;

comment on column public.evaluation_periods.name is
  'Evaluation period title displayed in the management interface.';

comment on column public.evaluation_periods.evaluation_deadline is
  'Deadline for completing calculation and human review; cannot precede the period end date.';
