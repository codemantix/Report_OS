-- Report OS employee evaluation data architecture
-- Additive only: existing goals, plans, tasks, task assignments, reports, and AI analyses remain authoritative.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Configurable evaluation weights
-- -----------------------------------------------------------------------------

create table public.evaluation_weight_configs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete restrict,
  name text not null,
  version integer not null check (version > 0),
  task_performance_weight numeric(5,2) not null default 50.00,
  reporting_performance_weight numeric(5,2) not null default 30.00,
  attendance_weight numeric(5,2) not null default 20.00,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  effective_from date not null,
  effective_to date,
  created_by uuid references public.users(id) on delete set null,
  activated_by uuid references public.users(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_weight_configs_date_range_check
    check (effective_to is null or effective_to >= effective_from),
  constraint evaluation_weight_configs_task_weight_check
    check (task_performance_weight between 0 and 100),
  constraint evaluation_weight_configs_reporting_weight_check
    check (reporting_performance_weight between 0 and 100),
  constraint evaluation_weight_configs_attendance_weight_check
    check (attendance_weight between 0 and 100),
  constraint evaluation_weight_configs_total_check
    check (
      task_performance_weight
      + reporting_performance_weight
      + attendance_weight = 100.00
    ),
  constraint evaluation_weight_configs_activation_check
    check (
      (status = 'active' and activated_at is not null)
      or status <> 'active'
    )
);

create unique index evaluation_weight_configs_scope_version_uidx
  on public.evaluation_weight_configs (
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
    version
  );

create index evaluation_weight_configs_scope_status_dates_idx
  on public.evaluation_weight_configs (department_id, status, effective_from, effective_to);

insert into public.evaluation_weight_configs (
  id,
  department_id,
  name,
  version,
  task_performance_weight,
  reporting_performance_weight,
  attendance_weight,
  status,
  effective_from,
  activated_at
)
values (
  '00000000-0000-0000-0000-000000000501'::uuid,
  null,
  'Default 50/30/20 evaluation weights',
  1,
  50.00,
  30.00,
  20.00,
  'active',
  date '1970-01-01',
  now()
);

-- -----------------------------------------------------------------------------
-- Department-scoped, inclusive 14-day evaluation periods
-- -----------------------------------------------------------------------------

create table public.evaluation_periods (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  weight_config_id uuid not null references public.evaluation_weight_configs(id) on delete restrict,
  name text not null,
  period_type text not null default 'biweekly'
    check (period_type = 'biweekly'),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'scoring', 'pending_approval', 'closed', 'cancelled')),
  created_by uuid references public.users(id) on delete set null,
  opened_by uuid references public.users(id) on delete set null,
  opened_at timestamptz,
  closed_by uuid references public.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_periods_date_order_check check (end_date >= start_date),
  constraint evaluation_periods_biweekly_duration_check check (end_date - start_date = 13),
  constraint evaluation_periods_open_metadata_check check (
    (opened_by is null and opened_at is null)
    or (opened_by is not null and opened_at is not null)
  ),
  constraint evaluation_periods_close_metadata_check check (
    (closed_by is null and closed_at is null)
    or (closed_by is not null and closed_at is not null)
  ),
  unique (department_id, start_date, end_date)
);

create index evaluation_periods_department_status_dates_idx
  on public.evaluation_periods (department_id, status, start_date, end_date);

create index evaluation_periods_weight_config_idx
  on public.evaluation_periods (weight_config_id);

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  attendance_date date not null,
  attendance_status text not null
    check (attendance_status in (
      'present',
      'absent',
      'late',
      'half_day',
      'approved_leave',
      'excused',
      'holiday',
      'weekend'
    )),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'disputed', 'corrected')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  timezone text not null default 'UTC',
  scheduled_minutes integer,
  worked_minutes integer,
  break_minutes integer not null default 0,
  late_minutes integer not null default 0,
  source text not null default 'manual'
    check (source in ('manual', 'import', 'integration', 'system')),
  external_reference text,
  notes text,
  evidence jsonb not null default '[]'::jsonb,
  recorded_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_unique_employee_date unique (employee_id, attendance_date),
  constraint attendance_records_check_out_check
    check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at),
  constraint attendance_records_scheduled_minutes_check
    check (scheduled_minutes is null or scheduled_minutes >= 0),
  constraint attendance_records_worked_minutes_check
    check (worked_minutes is null or worked_minutes >= 0),
  constraint attendance_records_break_minutes_check check (break_minutes >= 0),
  constraint attendance_records_late_minutes_check check (late_minutes >= 0),
  constraint attendance_records_late_within_schedule_check
    check (scheduled_minutes is null or late_minutes <= scheduled_minutes),
  constraint attendance_records_approval_metadata_check check (
    (approved_by is null and approved_at is null)
    or (approved_by is not null and approved_at is not null)
  ),
  constraint attendance_records_evidence_array_check
    check (jsonb_typeof(evidence) = 'array')
);

create index attendance_records_employee_date_idx
  on public.attendance_records (employee_id, attendance_date desc);

create index attendance_records_department_date_idx
  on public.attendance_records (department_id, attendance_date desc);

create index attendance_records_department_review_idx
  on public.attendance_records (department_id, review_status, attendance_date);

create unique index attendance_records_source_reference_uidx
  on public.attendance_records (source, external_reference)
  where external_reference is not null;

-- -----------------------------------------------------------------------------
-- Employee evaluations and weighted component scores
-- -----------------------------------------------------------------------------

create table public.employee_evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete restrict,
  evaluation_period_id uuid not null references public.evaluation_periods(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  weight_config_id uuid not null references public.evaluation_weight_configs(id) on delete restrict,
  evaluator_id uuid references public.users(id) on delete set null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'scoring',
      'pending_approval',
      'approved',
      'rejected',
      'finalized',
      'cancelled'
    )),
  overall_score numeric(6,3)
    check (overall_score is null or overall_score between 0 and 100),
  calculation_version text,
  evidence_cutoff_at timestamptz,
  summary text,
  employee_name_snapshot text not null,
  department_name_snapshot text not null,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  finalized_by uuid references public.users(id) on delete set null,
  finalized_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_evaluations_unique_employee_period
    unique (employee_id, evaluation_period_id),
  constraint employee_evaluations_submission_metadata_check check (
    (submitted_by is null and submitted_at is null)
    or (submitted_by is not null and submitted_at is not null)
  ),
  constraint employee_evaluations_finalization_metadata_check check (
    (finalized_by is null and finalized_at is null)
    or (finalized_by is not null and finalized_at is not null)
  )
);

create index employee_evaluations_employee_period_idx
  on public.employee_evaluations (employee_id, evaluation_period_id);

create index employee_evaluations_department_status_idx
  on public.employee_evaluations (department_id, status, created_at desc);

create index employee_evaluations_period_status_idx
  on public.employee_evaluations (evaluation_period_id, status);

create index employee_evaluations_evaluator_idx
  on public.employee_evaluations (evaluator_id, status)
  where evaluator_id is not null;

create table public.evaluation_component_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete cascade,
  component text not null
    check (component in ('task_performance', 'reporting_performance', 'attendance')),
  raw_score numeric(6,3)
    check (raw_score is null or raw_score between 0 and 100),
  weight numeric(5,2) not null
    check (weight between 0 and 100),
  weighted_score numeric(6,3)
    generated always as (round((raw_score * weight) / 100.00, 3)) stored,
  calculation_method text,
  calculation_version text,
  evidence_metrics jsonb not null default '{}'::jsonb,
  source_cutoff_at timestamptz,
  calculated_by uuid references public.users(id) on delete set null,
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_component_scores_unique_component
    unique (evaluation_id, component),
  constraint evaluation_component_scores_metrics_object_check
    check (jsonb_typeof(evidence_metrics) = 'object'),
  constraint evaluation_component_scores_calculation_metadata_check check (
    (raw_score is null and calculated_at is null)
    or (raw_score is not null and calculated_at is not null)
  )
);

create index evaluation_component_scores_evaluation_idx
  on public.evaluation_component_scores (evaluation_id);

-- -----------------------------------------------------------------------------
-- Stipend recommendations, human approval, and payment records
-- -----------------------------------------------------------------------------

create table public.stipend_recommendations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'recommended', 'approved', 'rejected', 'superseded', 'cancelled')),
  recommendation_source text not null default 'rules'
    check (recommendation_source in ('rules', 'ai', 'manual', 'hybrid')),
  recommended_amount numeric(14,2) not null check (recommended_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rationale text not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  model_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  recommended_by uuid references public.users(id) on delete set null,
  recommended_at timestamptz,
  supersedes_id uuid references public.stipend_recommendations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stipend_recommendations_unique_version unique (evaluation_id, version),
  constraint stipend_recommendations_policy_object_check
    check (jsonb_typeof(policy_snapshot) = 'object'),
  constraint stipend_recommendations_model_object_check
    check (jsonb_typeof(model_metadata) = 'object'),
  constraint stipend_recommendations_recommended_metadata_check check (
    (status = 'draft' and recommended_at is null)
    or status <> 'draft'
  )
);

create index stipend_recommendations_evaluation_status_idx
  on public.stipend_recommendations (evaluation_id, status, version desc);

create unique index stipend_recommendations_one_current_uidx
  on public.stipend_recommendations (evaluation_id)
  where status in ('draft', 'recommended', 'approved');

create table public.evaluation_approvals (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete restrict,
  stipend_recommendation_id uuid references public.stipend_recommendations(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  approval_stage text not null
    check (approval_stage in ('department', 'administration', 'finance')),
  sequence_number integer not null check (sequence_number > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled')),
  assigned_approver_id uuid references public.users(id) on delete restrict,
  decided_by uuid references public.users(id) on delete restrict,
  decision_note text,
  approved_amount numeric(14,2)
    check (approved_amount is null or approved_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  decided_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_approvals_unique_sequence
    unique (evaluation_id, sequence_number),
  constraint evaluation_approvals_decision_metadata_check check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  ),
  constraint evaluation_approvals_amount_currency_check check (
    (approved_amount is null and currency is null)
    or (approved_amount is not null and currency is not null)
  )
);

create index evaluation_approvals_evaluation_sequence_idx
  on public.evaluation_approvals (evaluation_id, sequence_number);

create index evaluation_approvals_assignee_status_idx
  on public.evaluation_approvals (assigned_approver_id, status)
  where assigned_approver_id is not null;

create index evaluation_approvals_department_status_idx
  on public.evaluation_approvals (department_id, status, created_at desc);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete restrict,
  stipend_recommendation_id uuid not null references public.stipend_recommendations(id) on delete restrict,
  approval_id uuid not null references public.evaluation_approvals(id) on delete restrict,
  employee_id uuid not null references public.users(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'processing', 'paid', 'failed', 'cancelled', 'reversed')),
  payment_method text,
  provider text,
  provider_reference text,
  idempotency_key text not null unique,
  failure_code text,
  failure_message text,
  receipt_reference text,
  scheduled_at timestamptz,
  processed_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  processed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_records_paid_at_check
    check ((status = 'paid' and paid_at is not null) or status <> 'paid'),
  constraint payment_records_failed_at_check
    check ((status = 'failed' and failed_at is not null) or status <> 'failed'),
  constraint payment_records_reversed_at_check
    check ((status = 'reversed' and reversed_at is not null) or status <> 'reversed')
);

create index payment_records_employee_created_idx
  on public.payment_records (employee_id, created_at desc);

create index payment_records_department_status_idx
  on public.payment_records (department_id, status, created_at desc);

create index payment_records_recommendation_status_idx
  on public.payment_records (stipend_recommendation_id, status);

create unique index payment_records_provider_reference_uidx
  on public.payment_records (provider, provider_reference)
  where provider is not null and provider_reference is not null;

create unique index payment_records_one_paid_per_recommendation_uidx
  on public.payment_records (stipend_recommendation_id)
  where status = 'paid';

-- -----------------------------------------------------------------------------
-- Append-only audit history
-- -----------------------------------------------------------------------------

create table public.evaluation_audit_history (
  id bigint generated always as identity primary key,
  entity_type text not null
    check (entity_type in (
      'weight_config',
      'evaluation_period',
      'attendance',
      'employee_evaluation',
      'component_score',
      'stipend_recommendation',
      'evaluation_approval',
      'payment'
    )),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  evaluation_id uuid,
  employee_id uuid references public.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  request_id uuid,
  reason text,
  occurred_at timestamptz not null default now()
);

create index evaluation_audit_entity_idx
  on public.evaluation_audit_history (entity_type, entity_id, occurred_at desc);

create index evaluation_audit_evaluation_idx
  on public.evaluation_audit_history (evaluation_id, occurred_at desc)
  where evaluation_id is not null;

create index evaluation_audit_employee_idx
  on public.evaluation_audit_history (employee_id, occurred_at desc)
  where employee_id is not null;

create index evaluation_audit_department_idx
  on public.evaluation_audit_history (department_id, occurred_at desc)
  where department_id is not null;

-- -----------------------------------------------------------------------------
-- Shared timestamps and integrity functions
-- -----------------------------------------------------------------------------

create or replace function public.set_evaluation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_evaluation_weight_config()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and exists (
    select 1
    from public.evaluation_periods ep
    where ep.weight_config_id = old.id
  ) and (
    new.department_id is distinct from old.department_id
    or new.version is distinct from old.version
    or new.task_performance_weight is distinct from old.task_performance_weight
    or new.reporting_performance_weight is distinct from old.reporting_performance_weight
    or new.attendance_weight is distinct from old.attendance_weight
    or new.effective_from is distinct from old.effective_from
  ) then
    raise exception 'A weight configuration referenced by an evaluation period is versioned and cannot be changed.';
  end if;

  if new.status = 'active' and exists (
    select 1
    from public.evaluation_weight_configs existing
    where existing.id <> new.id
      and existing.status = 'active'
      and existing.department_id is not distinct from new.department_id
      and daterange(existing.effective_from, coalesce(existing.effective_to, 'infinity'::date), '[]')
          && daterange(new.effective_from, coalesce(new.effective_to, 'infinity'::date), '[]')
  ) then
    raise exception 'Active evaluation weight configurations cannot overlap within the same department scope.';
  end if;

  if new.status = 'active' and new.activated_at is null then
    new.activated_at := now();
    new.activated_by := coalesce(new.activated_by, auth.uid());
  end if;

  return new;
end;
$$;

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

  if new.status <> 'cancelled' and exists (
    select 1
    from public.evaluation_periods existing
    where existing.id <> new.id
      and existing.department_id = new.department_id
      and existing.status <> 'cancelled'
      and daterange(existing.start_date, existing.end_date, '[]')
          && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'Non-cancelled evaluation periods cannot overlap within a department.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'closed' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Closed evaluation periods are immutable.';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('open', 'cancelled'))
      or (old.status = 'open' and new.status in ('scoring', 'cancelled'))
      or (old.status = 'scoring' and new.status in ('pending_approval', 'cancelled'))
      or (old.status = 'pending_approval' and new.status in ('scoring', 'closed', 'cancelled'))
    ) then
      raise exception 'Invalid evaluation period status transition: % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_attendance_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  employee_department_id uuid;
begin
  select department_id
  into employee_department_id
  from public.users
  where id = new.employee_id;

  if employee_department_id is null then
    raise exception 'Attendance employee must belong to a department.';
  end if;

  if tg_op = 'INSERT' then
    if new.department_id <> employee_department_id then
      raise exception 'Attendance department must match the employee department.';
    end if;
  elsif new.employee_id is distinct from old.employee_id
    or new.department_id is distinct from old.department_id
    or new.attendance_date is distinct from old.attendance_date then
    raise exception 'Attendance employee, department, and date are historical ownership fields and cannot be changed.';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_employee_evaluation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  period_department_id uuid;
  period_weight_config_id uuid;
  employee_department_id uuid;
  employee_name text;
  department_name text;
begin
  select ep.department_id, ep.weight_config_id
  into period_department_id, period_weight_config_id
  from public.evaluation_periods ep
  where ep.id = new.evaluation_period_id;

  if not found then
    raise exception 'Evaluation period does not exist.';
  end if;

  select u.department_id, coalesce(nullif(u.display_name, ''), u.full_name)
  into employee_department_id, employee_name
  from public.users u
  where u.id = new.employee_id;

  if not found then
    raise exception 'Evaluation employee does not exist.';
  end if;

  if employee_department_id is distinct from period_department_id then
    raise exception 'Evaluation employee must belong to the evaluation period department.';
  end if;

  select d.name into department_name
  from public.departments d
  where d.id = period_department_id;

  if tg_op = 'INSERT' then
    new.department_id := period_department_id;
    new.weight_config_id := period_weight_config_id;
    new.employee_name_snapshot := employee_name;
    new.department_name_snapshot := department_name;
  elsif new.employee_id is distinct from old.employee_id
    or new.evaluation_period_id is distinct from old.evaluation_period_id
    or new.department_id is distinct from old.department_id
    or new.weight_config_id is distinct from old.weight_config_id
    or new.employee_name_snapshot is distinct from old.employee_name_snapshot
    or new.department_name_snapshot is distinct from old.department_name_snapshot then
    raise exception 'Evaluation ownership, period, weight configuration, and identity snapshots are immutable.';
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
begin
  select
    case new.component
      when 'task_performance' then config.task_performance_weight
      when 'reporting_performance' then config.reporting_performance_weight
      when 'attendance' then config.attendance_weight
    end,
    evaluation.status
  into expected_weight, evaluation_status
  from public.employee_evaluations evaluation
  join public.evaluation_weight_configs config
    on config.id = evaluation.weight_config_id
  where evaluation.id = new.evaluation_id;

  if not found then
    raise exception 'Evaluation does not exist.';
  end if;

  if evaluation_status in ('approved', 'finalized', 'cancelled') then
    raise exception 'Scores for approved, finalized, or cancelled evaluations are immutable.';
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

create or replace function public.create_default_evaluation_components()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.evaluation_component_scores (
    evaluation_id,
    component,
    weight
  )
  values
    (new.id, 'task_performance', 0),
    (new.id, 'reporting_performance', 0),
    (new.id, 'attendance', 0);

  return new;
end;
$$;

create or replace function public.recalculate_employee_evaluation_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_evaluation_id uuid;
  component_count integer;
  scored_component_count integer;
  calculated_score numeric(6,3);
begin
  target_evaluation_id := coalesce(new.evaluation_id, old.evaluation_id);

  select
    count(*),
    count(raw_score),
    round(sum(weighted_score), 3)
  into component_count, scored_component_count, calculated_score
  from public.evaluation_component_scores
  where evaluation_id = target_evaluation_id;

  update public.employee_evaluations
  set
    overall_score = case
      when component_count = 3 and scored_component_count = 3 then calculated_score
      else null
    end,
    updated_at = now()
  where id = target_evaluation_id;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_employee_evaluation_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  component_count integer;
  scored_component_count integer;
  total_weight numeric(6,2);
  approved_count integer;
  incomplete_approval_count integer;
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('scoring', 'cancelled'))
      or (old.status = 'scoring' and new.status in ('pending_approval', 'cancelled'))
      or (old.status = 'pending_approval' and new.status in ('scoring', 'approved', 'rejected', 'cancelled'))
      or (old.status = 'rejected' and new.status in ('scoring', 'cancelled'))
      or (old.status = 'approved' and new.status = 'finalized')
    ) then
      raise exception 'Invalid employee evaluation status transition: % to %.', old.status, new.status;
    end if;
  end if;

  if new.status in ('pending_approval', 'approved', 'finalized') then
    select count(*), count(raw_score), sum(weight)
    into component_count, scored_component_count, total_weight
    from public.evaluation_component_scores
    where evaluation_id = new.id;

    if component_count <> 3 or scored_component_count <> 3 or total_weight <> 100.00 then
      raise exception 'Evaluation requires all three scored components with weights totaling 100 before approval.';
    end if;
  end if;

  if new.status = 'finalized' then
    select
      count(*) filter (where approval.status = 'approved'),
      count(*) filter (where approval.status not in ('approved', 'cancelled'))
    into approved_count, incomplete_approval_count
    from public.evaluation_approvals approval
    where approval.evaluation_id = new.id;

    if approved_count = 0 or incomplete_approval_count > 0 then
      raise exception 'Evaluation requires every non-cancelled human approval stage to be approved before finalization.';
    end if;

    if new.finalized_at is null then
      new.finalized_at := now();
      new.finalized_by := coalesce(new.finalized_by, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_stipend_recommendation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  evaluation_status text;
begin
  select status into evaluation_status
  from public.employee_evaluations
  where id = new.evaluation_id;

  if evaluation_status not in ('pending_approval', 'approved', 'finalized') then
    raise exception 'A stipend recommendation requires a scored evaluation pending approval or later.';
  end if;

  new.currency := upper(new.currency);

  if new.status in ('recommended', 'approved') and new.recommended_at is null then
    new.recommended_at := now();
    new.recommended_by := coalesce(new.recommended_by, auth.uid());
  end if;

  if tg_op = 'UPDATE' then
    if new.evaluation_id is distinct from old.evaluation_id
      or new.version is distinct from old.version then
      raise exception 'Stipend recommendation evaluation and version are immutable.';
    end if;

    if old.status = 'approved' and (
      new.recommended_amount is distinct from old.recommended_amount
      or new.currency is distinct from old.currency
      or new.evaluation_id is distinct from old.evaluation_id
    ) then
      raise exception 'Approved stipend financial fields are immutable.';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status in ('recommended', 'cancelled'))
      or (old.status = 'recommended' and new.status in ('approved', 'rejected', 'superseded', 'cancelled'))
      or (old.status = 'rejected' and new.status = 'superseded')
    ) then
      raise exception 'Invalid stipend recommendation status transition: % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_evaluation_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  evaluation_employee_id uuid;
  evaluation_department_id uuid;
  recommendation_evaluation_id uuid;
  recommendation_amount numeric(14,2);
  recommendation_currency text;
  prior_pending_count integer;
begin
  select employee_id, department_id
  into evaluation_employee_id, evaluation_department_id
  from public.employee_evaluations
  where id = new.evaluation_id;

  if not found then
    raise exception 'Evaluation does not exist.';
  end if;

  new.department_id := evaluation_department_id;

  if new.stipend_recommendation_id is not null then
    select evaluation_id, recommended_amount, currency
    into recommendation_evaluation_id, recommendation_amount, recommendation_currency
    from public.stipend_recommendations
    where id = new.stipend_recommendation_id;

    if recommendation_evaluation_id is distinct from new.evaluation_id then
      raise exception 'Approval stipend recommendation must belong to the same evaluation.';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.evaluation_id is distinct from old.evaluation_id
    or new.stipend_recommendation_id is distinct from old.stipend_recommendation_id
    or new.department_id is distinct from old.department_id
    or new.approval_stage is distinct from old.approval_stage
    or new.sequence_number is distinct from old.sequence_number
  ) then
    raise exception 'Approval ownership, subject, stage, and sequence are immutable.';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'pending' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Completed approval decisions are immutable.';
  end if;

  if new.status <> 'pending' then
    new.decided_by := coalesce(new.decided_by, auth.uid());
    new.decided_at := coalesce(new.decided_at, now());

    if new.decided_by = evaluation_employee_id then
      raise exception 'Employees cannot approve or reject their own evaluation.';
    end if;

    select count(*)
    into prior_pending_count
    from public.evaluation_approvals prior
    where prior.evaluation_id = new.evaluation_id
      and prior.sequence_number < new.sequence_number
      and prior.status <> 'approved';

    if prior_pending_count > 0 then
      raise exception 'Approval stages must be completed in sequence.';
    end if;
  end if;

  if new.status = 'approved' and new.stipend_recommendation_id is not null then
    new.approved_amount := coalesce(new.approved_amount, recommendation_amount);
    new.currency := coalesce(upper(new.currency), recommendation_currency);

    if new.approved_amount > recommendation_amount then
      raise exception 'Approved amount cannot exceed the stipend recommendation amount.';
    end if;
  elsif new.currency is not null then
    new.currency := upper(new.currency);
  end if;

  return new;
end;
$$;

create or replace function public.sync_approved_recommendation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.stipend_recommendation_id is not null then
    update public.stipend_recommendations
    set status = 'approved', updated_at = now()
    where id = new.stipend_recommendation_id
      and status = 'recommended';
  elsif new.status in ('rejected', 'changes_requested') and new.stipend_recommendation_id is not null then
    update public.stipend_recommendations
    set status = 'rejected', updated_at = now()
    where id = new.stipend_recommendation_id
      and status = 'recommended';
  end if;

  return new;
end;
$$;

create or replace function public.validate_payment_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  evaluation_employee_id uuid;
  evaluation_department_id uuid;
  evaluation_status text;
  recommendation_evaluation_id uuid;
  recommendation_status text;
  recommendation_amount numeric(14,2);
  recommendation_currency text;
  approval_evaluation_id uuid;
  approval_recommendation_id uuid;
  approval_status text;
  approval_amount numeric(14,2);
  approval_currency text;
  incomplete_approval_count integer;
begin
  select employee_id, department_id, status
  into evaluation_employee_id, evaluation_department_id, evaluation_status
  from public.employee_evaluations
  where id = new.evaluation_id;

  select evaluation_id, status, recommended_amount, currency
  into recommendation_evaluation_id, recommendation_status, recommendation_amount, recommendation_currency
  from public.stipend_recommendations
  where id = new.stipend_recommendation_id;

  select evaluation_id, stipend_recommendation_id, status, approved_amount, currency
  into approval_evaluation_id, approval_recommendation_id, approval_status, approval_amount, approval_currency
  from public.evaluation_approvals
  where id = new.approval_id;

  if evaluation_status not in ('approved', 'finalized') then
    raise exception 'Payments require an approved or finalized employee evaluation.';
  end if;

  if recommendation_evaluation_id is distinct from new.evaluation_id
    or recommendation_status <> 'approved' then
    raise exception 'Payments require an approved recommendation for the same evaluation.';
  end if;

  if approval_evaluation_id is distinct from new.evaluation_id
    or approval_recommendation_id is distinct from new.stipend_recommendation_id
    or approval_status <> 'approved' then
    raise exception 'Payments require an approved human approval for the same evaluation and recommendation.';
  end if;

  select count(*)
  into incomplete_approval_count
  from public.evaluation_approvals approval
  where approval.evaluation_id = new.evaluation_id
    and approval.status not in ('approved', 'cancelled');

  if incomplete_approval_count > 0 then
    raise exception 'Payments require every non-cancelled approval stage to be approved.';
  end if;

  new.employee_id := evaluation_employee_id;
  new.department_id := evaluation_department_id;
  new.currency := upper(new.currency);

  if new.currency <> coalesce(approval_currency, recommendation_currency) then
    raise exception 'Payment currency must match the approved stipend currency.';
  end if;

  if new.amount > coalesce(approval_amount, recommendation_amount) then
    raise exception 'Payment amount cannot exceed the human-approved stipend amount.';
  end if;

  if tg_op = 'UPDATE' then
    if new.evaluation_id is distinct from old.evaluation_id
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
    ) then
      raise exception 'Invalid payment status transition: % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.capture_evaluation_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_row jsonb;
  audit_entity_type text;
  audit_entity_id uuid;
  audit_evaluation_id uuid;
  audit_employee_id uuid;
  audit_department_id uuid;
  audit_actor_id uuid;
begin
  audit_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  audit_entity_id := (audit_row ->> 'id')::uuid;
  audit_actor_id := auth.uid();

  audit_entity_type := case tg_table_name
    when 'evaluation_weight_configs' then 'weight_config'
    when 'evaluation_periods' then 'evaluation_period'
    when 'attendance_records' then 'attendance'
    when 'employee_evaluations' then 'employee_evaluation'
    when 'evaluation_component_scores' then 'component_score'
    when 'stipend_recommendations' then 'stipend_recommendation'
    when 'evaluation_approvals' then 'evaluation_approval'
    when 'payment_records' then 'payment'
  end;

  if tg_table_name = 'attendance_records' then
    audit_employee_id := (audit_row ->> 'employee_id')::uuid;
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(
      audit_actor_id,
      (audit_row ->> 'approved_by')::uuid,
      (audit_row ->> 'recorded_by')::uuid
    );
  elsif tg_table_name = 'employee_evaluations' then
    audit_evaluation_id := audit_entity_id;
    audit_employee_id := (audit_row ->> 'employee_id')::uuid;
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(
      audit_actor_id,
      (audit_row ->> 'finalized_by')::uuid,
      (audit_row ->> 'submitted_by')::uuid,
      (audit_row ->> 'created_by')::uuid
    );
  elsif tg_table_name = 'evaluation_component_scores' then
    audit_evaluation_id := (audit_row ->> 'evaluation_id')::uuid;
    select employee_id, department_id
    into audit_employee_id, audit_department_id
    from public.employee_evaluations
    where id = audit_evaluation_id;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'calculated_by')::uuid);
  elsif tg_table_name in ('stipend_recommendations', 'evaluation_approvals', 'payment_records') then
    audit_evaluation_id := (audit_row ->> 'evaluation_id')::uuid;
    select employee_id, department_id
    into audit_employee_id, audit_department_id
    from public.employee_evaluations
    where id = audit_evaluation_id;
    audit_actor_id := coalesce(
      audit_actor_id,
      (audit_row ->> 'decided_by')::uuid,
      (audit_row ->> 'processed_by')::uuid,
      (audit_row ->> 'recommended_by')::uuid,
      (audit_row ->> 'created_by')::uuid
    );
  elsif tg_table_name = 'evaluation_periods' then
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(
      audit_actor_id,
      (audit_row ->> 'closed_by')::uuid,
      (audit_row ->> 'opened_by')::uuid,
      (audit_row ->> 'created_by')::uuid
    );
  elsif tg_table_name = 'evaluation_weight_configs' then
    audit_department_id := nullif(audit_row ->> 'department_id', '')::uuid;
    audit_actor_id := coalesce(
      audit_actor_id,
      (audit_row ->> 'activated_by')::uuid,
      (audit_row ->> 'created_by')::uuid
    );
  end if;

  insert into public.evaluation_audit_history (
    entity_type,
    entity_id,
    action,
    evaluation_id,
    employee_id,
    department_id,
    actor_user_id,
    old_values,
    new_values
  )
  values (
    audit_entity_type,
    audit_entity_id,
    lower(tg_op),
    audit_evaluation_id,
    audit_employee_id,
    audit_department_id,
    audit_actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger evaluation_weight_configs_updated_at
  before update on public.evaluation_weight_configs
  for each row execute function public.set_evaluation_updated_at();

create trigger evaluation_weight_configs_validate
  before insert or update on public.evaluation_weight_configs
  for each row execute function public.validate_evaluation_weight_config();

create trigger evaluation_periods_updated_at
  before update on public.evaluation_periods
  for each row execute function public.set_evaluation_updated_at();

create trigger evaluation_periods_validate
  before insert or update on public.evaluation_periods
  for each row execute function public.validate_evaluation_period();

create trigger attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function public.set_evaluation_updated_at();

create trigger attendance_records_validate_ownership
  before insert or update on public.attendance_records
  for each row execute function public.validate_attendance_ownership();

create trigger employee_evaluations_updated_at
  before update on public.employee_evaluations
  for each row execute function public.set_evaluation_updated_at();

create trigger employee_evaluations_prepare
  before insert or update on public.employee_evaluations
  for each row execute function public.prepare_employee_evaluation();

create trigger employee_evaluations_validate_status
  before update of status on public.employee_evaluations
  for each row execute function public.validate_employee_evaluation_status();

create trigger employee_evaluations_default_components
  after insert on public.employee_evaluations
  for each row execute function public.create_default_evaluation_components();

create trigger evaluation_component_scores_updated_at
  before update on public.evaluation_component_scores
  for each row execute function public.set_evaluation_updated_at();

create trigger evaluation_component_scores_set_weight
  before insert or update on public.evaluation_component_scores
  for each row execute function public.set_evaluation_component_weight();

create trigger evaluation_component_scores_recalculate_insert
  after insert on public.evaluation_component_scores
  for each row execute function public.recalculate_employee_evaluation_score();

create trigger evaluation_component_scores_recalculate_update
  after update of raw_score, weight on public.evaluation_component_scores
  for each row execute function public.recalculate_employee_evaluation_score();

create trigger evaluation_component_scores_recalculate_delete
  after delete on public.evaluation_component_scores
  for each row execute function public.recalculate_employee_evaluation_score();

create trigger stipend_recommendations_updated_at
  before update on public.stipend_recommendations
  for each row execute function public.set_evaluation_updated_at();

create trigger stipend_recommendations_validate
  before insert or update on public.stipend_recommendations
  for each row execute function public.validate_stipend_recommendation();

create trigger evaluation_approvals_updated_at
  before update on public.evaluation_approvals
  for each row execute function public.set_evaluation_updated_at();

create trigger evaluation_approvals_validate
  before insert or update on public.evaluation_approvals
  for each row execute function public.validate_evaluation_approval();

create trigger evaluation_approvals_sync_recommendation
  after insert or update of status on public.evaluation_approvals
  for each row execute function public.sync_approved_recommendation();

create trigger payment_records_updated_at
  before update on public.payment_records
  for each row execute function public.set_evaluation_updated_at();

create trigger payment_records_validate
  before insert or update on public.payment_records
  for each row execute function public.validate_payment_record();

create trigger evaluation_weight_configs_audit
  after insert or update or delete on public.evaluation_weight_configs
  for each row execute function public.capture_evaluation_audit();

create trigger evaluation_periods_audit
  after insert or update or delete on public.evaluation_periods
  for each row execute function public.capture_evaluation_audit();

create trigger attendance_records_audit
  after insert or update or delete on public.attendance_records
  for each row execute function public.capture_evaluation_audit();

create trigger employee_evaluations_audit
  after insert or update or delete on public.employee_evaluations
  for each row execute function public.capture_evaluation_audit();

create trigger evaluation_component_scores_audit
  after insert or update or delete on public.evaluation_component_scores
  for each row execute function public.capture_evaluation_audit();

create trigger stipend_recommendations_audit
  after insert or update or delete on public.stipend_recommendations
  for each row execute function public.capture_evaluation_audit();

create trigger evaluation_approvals_audit
  after insert or update or delete on public.evaluation_approvals
  for each row execute function public.capture_evaluation_audit();

create trigger payment_records_audit
  after insert or update or delete on public.payment_records
  for each row execute function public.capture_evaluation_audit();

comment on table public.evaluation_weight_configs is
  'Versioned evaluation weight configurations. Defaults to task 50%, reporting 30%, attendance 20%.';

comment on table public.attendance_records is
  'Daily employee attendance. Employee and department are historical ownership fields used by evaluation periods.';

comment on table public.employee_evaluations is
  'One department-owned employee evaluation per bi-weekly evaluation period.';

comment on table public.evaluation_component_scores is
  'Task, reporting, and attendance component scores. Evidence metrics summarize existing canonical records without duplicating them.';

comment on table public.stipend_recommendations is
  'Advisory stipend recommendation produced after scoring; it cannot authorize payment without a human approval.';

comment on table public.payment_records is
  'Auditable payment records requiring an approved evaluation, recommendation, and human approval.';

comment on table public.evaluation_audit_history is
  'Append-only trigger-generated history for evaluation and payment-domain records.';
