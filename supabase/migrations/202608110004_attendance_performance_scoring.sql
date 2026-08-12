-- Configurable Attendance Performance scoring rules.
-- Rules live on the same versioned weight configuration snapshotted by each evaluation period.

alter table public.evaluation_weight_configs
  add column attendance_present_score numeric(5,2) not null default 100.00,
  add column attendance_late_score numeric(5,2) not null default 75.00,
  add column attendance_absent_score numeric(5,2) not null default 0.00,
  add column attendance_excused_score numeric(5,2) not null default 100.00,
  add constraint evaluation_weight_configs_attendance_present_score_check
    check (attendance_present_score between 0 and 100),
  add constraint evaluation_weight_configs_attendance_late_score_check
    check (attendance_late_score between 0 and 100),
  add constraint evaluation_weight_configs_attendance_absent_score_check
    check (attendance_absent_score between 0 and 100),
  add constraint evaluation_weight_configs_attendance_excused_score_check
    check (attendance_excused_score between 0 and 100);

comment on column public.evaluation_weight_configs.attendance_present_score is
  'Configurable score awarded to an applicable Present attendance session.';

comment on column public.evaluation_weight_configs.attendance_late_score is
  'Configurable score awarded to an applicable Late attendance session.';

comment on column public.evaluation_weight_configs.attendance_absent_score is
  'Configurable score awarded to an applicable unexplained Absent attendance session.';

comment on column public.evaluation_weight_configs.attendance_excused_score is
  'Configurable score awarded to an applicable Excused attendance session; intentionally independent from Absent.';

-- A referenced configuration is a historical scoring snapshot. Changing any
-- attendance rule requires a new configuration version.
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
    or new.attendance_present_score is distinct from old.attendance_present_score
    or new.attendance_late_score is distinct from old.attendance_late_score
    or new.attendance_absent_score is distinct from old.attendance_absent_score
    or new.attendance_excused_score is distinct from old.attendance_excused_score
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

-- Human approvals must always refer to a stable set of component scores.
-- The existing status workflow permits pending_approval -> scoring when a
-- recalculation is required.
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

  if evaluation_status in ('pending_approval', 'approved', 'finalized', 'cancelled') then
    raise exception 'Scores for evaluations awaiting or completing approval are immutable.';
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
