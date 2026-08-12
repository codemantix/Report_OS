-- Central bi-weekly evaluation engine metadata and versioned performance-band policy.
-- Component scores remain authoritative in evaluation_component_scores.

create or replace function public.is_valid_performance_band_config(config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  band jsonb;
  minimum_score numeric;
  maximum_score numeric;
  stipend_percentage numeric;
  recommendation_mode text;
  previous_maximum numeric;
  band_count integer := 0;
begin
  if jsonb_typeof(config) <> 'array' or jsonb_array_length(config) = 0 then
    return false;
  end if;

  for band in
    select value
    from jsonb_array_elements(config)
    order by (value ->> 'minimumScore')::numeric
  loop
    band_count := band_count + 1;
    minimum_score := (band ->> 'minimumScore')::numeric;
    maximum_score := (band ->> 'maximumScore')::numeric;
    recommendation_mode := band ->> 'recommendationMode';

    if coalesce(btrim(band ->> 'key'), '') = ''
      or coalesce(btrim(band ->> 'label'), '') = ''
      or minimum_score < 0
      or maximum_score > 100
      or minimum_score > maximum_score then
      return false;
    end if;

    if band_count = 1 and minimum_score <> 0 then
      return false;
    elsif band_count > 1 and minimum_score <> previous_maximum + 0.001 then
      return false;
    end if;

    if recommendation_mode = 'percentage' then
      if not (band ? 'stipendPercentage') or band -> 'stipendPercentage' = 'null'::jsonb then
        return false;
      end if;
      stipend_percentage := (band ->> 'stipendPercentage')::numeric;
      if stipend_percentage < 0 or stipend_percentage > 100 then
        return false;
      end if;
    elsif recommendation_mode = 'manual' then
      if not (band ? 'stipendPercentage') or band -> 'stipendPercentage' <> 'null'::jsonb then
        return false;
      end if;
    else
      return false;
    end if;

    previous_maximum := maximum_score;
  end loop;

  return previous_maximum = 100;
exception
  when others then
    return false;
end;
$$;

alter table public.evaluation_weight_configs
  add column performance_band_config jsonb not null default '[
    {"key":"excellent","label":"Excellent","minimumScore":90,"maximumScore":100,"stipendPercentage":100,"recommendationMode":"percentage"},
    {"key":"very_good","label":"Very Good","minimumScore":80,"maximumScore":89.999,"stipendPercentage":90,"recommendationMode":"percentage"},
    {"key":"good","label":"Good","minimumScore":70,"maximumScore":79.999,"stipendPercentage":80,"recommendationMode":"percentage"},
    {"key":"needs_improvement","label":"Needs Improvement","minimumScore":60,"maximumScore":69.999,"stipendPercentage":70,"recommendationMode":"percentage"},
    {"key":"review_required","label":"Review Required","minimumScore":0,"maximumScore":59.999,"stipendPercentage":null,"recommendationMode":"manual"}
  ]'::jsonb,
  add constraint evaluation_weight_configs_band_config_check
    check (public.is_valid_performance_band_config(performance_band_config));

alter table public.employee_evaluations
  add column calculation_status text not null default 'not_calculated'
    check (calculation_status in ('not_calculated', 'incomplete', 'complete')),
  add column performance_band text,
  add column calculated_stipend_percentage numeric(5,2)
    check (calculated_stipend_percentage is null or calculated_stipend_percentage between 0 and 100),
  add column stipend_recommendation_mode text
    check (stipend_recommendation_mode is null or stipend_recommendation_mode in ('percentage', 'manual')),
  add column calculation_snapshot jsonb not null default '{}'::jsonb,
  add column calculation_run_id uuid,
  add column calculation_revision bigint not null default 0 check (calculation_revision >= 0),
  add column calculated_by uuid references public.users(id) on delete set null,
  add column calculated_at timestamptz,
  add constraint employee_evaluations_calculation_snapshot_object_check
    check (jsonb_typeof(calculation_snapshot) = 'object'),
  add constraint employee_evaluations_stipend_mode_percentage_check
    check (
      (stipend_recommendation_mode = 'percentage' and calculated_stipend_percentage is not null)
      or (stipend_recommendation_mode = 'manual' and calculated_stipend_percentage is null)
      or stipend_recommendation_mode is null
    );

create index employee_evaluations_performance_band_idx
  on public.employee_evaluations (department_id, performance_band, calculated_at desc)
  where performance_band is not null;

-- Component score rows are still inserted by the existing evaluation-creation
-- trigger. Their calculated contents are server-managed after creation, so
-- authenticated users retain read access but cannot update or delete them.
drop policy if exists "Department managers can update component scores"
  on public.evaluation_component_scores;

drop policy if exists "Admins can delete draft component scores"
  on public.evaluation_component_scores;

create or replace function public.protect_evaluation_calculation_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' and (
    new.overall_score is not null
    or new.calculation_status <> 'not_calculated'
    or new.calculation_version is not null
    or new.performance_band is not null
    or new.calculated_stipend_percentage is not null
    or new.stipend_recommendation_mode is not null
    or new.calculation_snapshot <> '{}'::jsonb
    or new.calculation_run_id is not null
    or new.calculation_revision <> 0
    or new.evidence_cutoff_at is not null
    or new.calculated_by is not null
    or new.calculated_at is not null
  ) then
    raise exception 'Calculated evaluation fields can only be initialized by the server evaluation engine.';
  elsif tg_op = 'UPDATE' and (
    new.overall_score is distinct from old.overall_score
    or new.calculation_status is distinct from old.calculation_status
    or new.calculation_version is distinct from old.calculation_version
    or new.performance_band is distinct from old.performance_band
    or new.calculated_stipend_percentage is distinct from old.calculated_stipend_percentage
    or new.stipend_recommendation_mode is distinct from old.stipend_recommendation_mode
    or new.calculation_snapshot is distinct from old.calculation_snapshot
    or new.calculation_run_id is distinct from old.calculation_run_id
    or new.calculation_revision is distinct from old.calculation_revision
    or new.evidence_cutoff_at is distinct from old.evidence_cutoff_at
    or new.calculated_by is distinct from old.calculated_by
    or new.calculated_at is distinct from old.calculated_at
  ) then
    raise exception 'Calculated evaluation fields can only be changed by the server evaluation engine.';
  end if;

  return new;
end;
$$;

create trigger employee_evaluations_protect_calculation_fields
  before insert or update on public.employee_evaluations
  for each row execute function public.protect_evaluation_calculation_fields();

comment on column public.evaluation_weight_configs.performance_band_config is
  'Versioned centralized score-band and stipend-percentage recommendation policy.';

comment on column public.employee_evaluations.performance_band is
  'Advisory performance classification calculated from the three weighted component scores.';

comment on column public.employee_evaluations.calculated_stipend_percentage is
  'Advisory stipend percentage only; never constitutes approval or payment authorization.';

comment on column public.employee_evaluations.calculation_snapshot is
  'Compact source/component/config snapshot used by the central bi-weekly evaluation engine.';

-- Any component mutation invalidates the prior central aggregate. During an
-- active engine run, the started snapshot is retained so failures remain
-- visibly incomplete rather than exposing stale band or stipend metadata.
create or replace function public.recalculate_employee_evaluation_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_evaluation_id uuid;
begin
  target_evaluation_id := coalesce(new.evaluation_id, old.evaluation_id);

  update public.employee_evaluations
  set
    overall_score = null,
    calculation_status = case
      when calculation_status = 'incomplete' then 'incomplete'
      else 'not_calculated'
    end,
    calculation_version = null,
    performance_band = null,
    calculated_stipend_percentage = null,
    stipend_recommendation_mode = null,
    calculation_snapshot = case
      when calculation_status = 'incomplete' then calculation_snapshot
      else '{}'::jsonb
    end,
    evidence_cutoff_at = null,
    calculated_by = case
      when calculation_status = 'incomplete' then calculated_by
      else null
    end,
    calculated_at = case
      when calculation_status = 'incomplete' then calculated_at
      else null
    end,
    calculation_revision = calculation_revision + 1,
    updated_at = now()
  where id = target_evaluation_id;

  return coalesce(new, old);
end;
$$;

create or replace function public.require_complete_engine_for_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and new.status in ('pending_approval', 'approved', 'finalized')
    and not (
      old.status = 'approved'
      and new.status = 'finalized'
      and new.calculation_status = 'not_calculated'
    )
    and (
      new.calculation_status <> 'complete'
      or new.overall_score is null
      or new.performance_band is null
      or new.stipend_recommendation_mode is null
    ) then
    raise exception 'A complete central evaluation calculation is required before human approval.';
  end if;

  return new;
end;
$$;

create trigger employee_evaluations_require_complete_engine
  before update on public.employee_evaluations
  for each row execute function public.require_complete_engine_for_approval();

-- Performance-band policy is part of the historical configuration snapshot.
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
    or new.performance_band_config is distinct from old.performance_band_config
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
