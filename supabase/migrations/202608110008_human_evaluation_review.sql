-- Secure human evaluation review and approval workflow.
-- Calculated fields remain immutable. Human proposals, decisions, review rounds,
-- monetary authorization, and comments are stored separately and auditable.

-- -----------------------------------------------------------------------------
-- Review-round and approved-result projections
-- -----------------------------------------------------------------------------

alter table public.employee_evaluations
  add column approved_score numeric(6,3)
    check (approved_score is null or approved_score between 0 and 100),
  add column approved_performance_band text,
  add column approved_stipend_percentage numeric(5,2)
    check (approved_stipend_percentage is null or approved_stipend_percentage between 0 and 100),
  add column approved_stipend_mode text
    check (approved_stipend_mode is null or approved_stipend_mode in ('percentage', 'manual')),
  add column approved_by uuid references public.users(id) on delete set null,
  add column approved_at timestamptz,
  add column approval_feedback text,
  add column adjustment_reason text,
  add column current_approval_status text not null default 'not_started'
    check (current_approval_status in (
      'not_started', 'pending', 'approved', 'rejected', 'changes_requested', 'cancelled'
    ));

create table public.evaluation_review_rounds (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  round_number integer not null check (round_number > 0),
  status text not null default 'in_review'
    check (status in ('in_review', 'changes_requested', 'approved', 'rejected', 'cancelled')),
  calculation_revision bigint not null check (calculation_revision >= 0),
  calculation_run_id uuid,
  calculated_score numeric(6,3) not null check (calculated_score between 0 and 100),
  calculated_performance_band text not null,
  calculated_stipend_percentage numeric(5,2)
    check (calculated_stipend_percentage is null or calculated_stipend_percentage between 0 and 100),
  calculated_stipend_mode text not null
    check (calculated_stipend_mode in ('percentage', 'manual')),
  calculation_snapshot jsonb not null check (jsonb_typeof(calculation_snapshot) = 'object'),
  proposed_score numeric(6,3) not null check (proposed_score between 0 and 100),
  proposed_performance_band text not null,
  proposed_stipend_percentage numeric(5,2)
    check (proposed_stipend_percentage is null or proposed_stipend_percentage between 0 and 100),
  proposed_stipend_mode text not null
    check (proposed_stipend_mode in ('percentage', 'manual')),
  proposed_adjustment_reason text,
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  closed_by uuid references public.users(id) on delete restrict,
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_review_rounds_unique_number unique (evaluation_id, round_number),
  constraint evaluation_review_rounds_stipend_mode_check check (
    (proposed_stipend_mode = 'percentage' and proposed_stipend_percentage is not null)
    or (proposed_stipend_mode = 'manual' and proposed_stipend_percentage is null)
  ),
  constraint evaluation_review_rounds_close_metadata_check check (
    (status = 'in_review' and closed_by is null and closed_at is null)
    or (status <> 'in_review' and closed_by is not null and closed_at is not null)
  )
);

create unique index evaluation_review_rounds_one_active_uidx
  on public.evaluation_review_rounds (evaluation_id)
  where status = 'in_review';
create index evaluation_review_rounds_evaluation_number_idx
  on public.evaluation_review_rounds (evaluation_id, round_number desc);
create index evaluation_review_rounds_department_status_idx
  on public.evaluation_review_rounds (department_id, status, updated_at desc);
create index employee_evaluations_current_approval_status_idx
  on public.employee_evaluations (department_id, current_approval_status, created_at desc);

alter table public.employee_evaluations
  add column approved_review_round_id uuid
    references public.evaluation_review_rounds(id) on delete restrict;

alter table public.evaluation_approvals
  drop constraint evaluation_approvals_unique_sequence,
  drop constraint evaluation_approvals_decision_metadata_check,
  drop constraint evaluation_approvals_status_check,
  add column review_round_id uuid
    references public.evaluation_review_rounds(id) on delete restrict,
  add column required boolean not null default true,
  add column original_calculated_score numeric(6,3),
  add column original_performance_band text,
  add column original_stipend_percentage numeric(5,2),
  add column input_score numeric(6,3),
  add column input_performance_band text,
  add column input_stipend_percentage numeric(5,2),
  add column input_stipend_mode text,
  add column approved_final_score numeric(6,3),
  add column approved_final_band text,
  add column approved_final_stipend_percentage numeric(5,2),
  add column approved_final_stipend_mode text,
  add column score_adjustment numeric(7,3),
  add column adjustment_reason text,
  add column calculation_snapshot jsonb not null default '{}'::jsonb,
  add constraint evaluation_approvals_status_check
    check (status in ('waiting', 'pending', 'approved', 'rejected', 'changes_requested', 'cancelled')),
  add constraint evaluation_approvals_unique_round_sequence unique (review_round_id, sequence_number),
  add constraint evaluation_approvals_unique_round_stage unique (review_round_id, approval_stage),
  add constraint evaluation_approvals_decision_metadata_check check (
    (status in ('waiting', 'pending') and decided_by is null and decided_at is null)
    or (status in ('approved', 'rejected', 'changes_requested') and decided_by is not null and decided_at is not null)
    or (status = 'cancelled' and ((decided_by is null and decided_at is null) or (decided_by is not null and decided_at is not null)))
  ),
  add constraint evaluation_approvals_score_ranges_check check (
    (original_calculated_score is null or original_calculated_score between 0 and 100)
    and (original_stipend_percentage is null or original_stipend_percentage between 0 and 100)
    and (input_score is null or input_score between 0 and 100)
    and (input_stipend_percentage is null or input_stipend_percentage between 0 and 100)
    and (approved_final_score is null or approved_final_score between 0 and 100)
    and (approved_final_stipend_percentage is null or approved_final_stipend_percentage between 0 and 100)
  ),
  add constraint evaluation_approvals_stipend_modes_check check (
    (input_stipend_mode is null or input_stipend_mode in ('percentage', 'manual'))
    and (approved_final_stipend_mode is null or approved_final_stipend_mode in ('percentage', 'manual'))
  ),
  add constraint evaluation_approvals_adjustment_reason_check check (
    adjustment_reason is not null or score_adjustment is null or score_adjustment = 0
  ),
  add constraint evaluation_approvals_snapshot_object_check
    check (jsonb_typeof(calculation_snapshot) = 'object');

create unique index evaluation_approvals_one_pending_per_round_uidx
  on public.evaluation_approvals (review_round_id)
  where status = 'pending';
create index evaluation_approvals_round_sequence_idx
  on public.evaluation_approvals (review_round_id, sequence_number);

alter table public.employee_evaluations
  add column final_approval_id uuid references public.evaluation_approvals(id) on delete restrict,
  add column approved_stipend_recommendation_id uuid
    references public.stipend_recommendations(id) on delete restrict,
  add column approved_calculation_revision bigint
    check (approved_calculation_revision is null or approved_calculation_revision >= 0),
  add constraint employee_evaluations_approved_projection_check check (
    (
      approved_review_round_id is null and final_approval_id is null
      and approved_score is null and approved_performance_band is null
      and approved_stipend_percentage is null and approved_stipend_mode is null
      and approved_by is null and approved_at is null
      and approved_calculation_revision is null
      and approved_stipend_recommendation_id is null
    )
    or (
      approved_review_round_id is not null and final_approval_id is not null
      and approved_score is not null and approved_performance_band is not null
      and approved_stipend_mode is not null
      and approved_by is not null and approved_at is not null
      and approved_calculation_revision is not null
      and (
        (approved_stipend_mode = 'percentage' and approved_stipend_percentage is not null)
        or (approved_stipend_mode = 'manual' and approved_stipend_percentage is null)
      )
    )
  );

alter table public.stipend_recommendations
  add column review_round_id uuid references public.evaluation_review_rounds(id) on delete restrict,
  add column recommendation_mode text not null default 'percentage'
    check (recommendation_mode in ('percentage', 'manual')),
  add column recommended_percentage numeric(5,2)
    check (recommended_percentage is null or recommended_percentage between 0 and 100),
  add column authorized_by_approval_id uuid references public.evaluation_approvals(id) on delete restrict,
  add constraint stipend_recommendations_mode_percentage_check check (
    (recommendation_mode = 'percentage' and recommended_percentage is not null)
    or (recommendation_mode = 'manual' and recommended_percentage is null)
  ) not valid;

alter table public.payment_records
  add column review_round_id uuid references public.evaluation_review_rounds(id) on delete restrict;

create table public.evaluation_review_comments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.employee_evaluations(id) on delete restrict,
  review_round_id uuid references public.evaluation_review_rounds(id) on delete restrict,
  approval_id uuid references public.evaluation_approvals(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  author_user_id uuid not null references public.users(id) on delete restrict,
  visibility text not null default 'employee_visible'
    check (visibility in ('review_participants', 'employee_visible', 'internal')),
  body text not null check (btrim(body) <> '' and char_length(body) <= 5000),
  created_at timestamptz not null default now()
);

create index evaluation_review_comments_evaluation_created_idx
  on public.evaluation_review_comments (evaluation_id, created_at desc);
create index evaluation_review_comments_round_created_idx
  on public.evaluation_review_comments (review_round_id, created_at)
  where review_round_id is not null;

-- -----------------------------------------------------------------------------
-- RLS-ready read ownership. Sensitive writes remain service-only through RPCs.
-- -----------------------------------------------------------------------------

alter table public.evaluation_review_rounds enable row level security;
alter table public.evaluation_review_comments enable row level security;

revoke all on table public.evaluation_review_rounds from anon, authenticated;
revoke all on table public.evaluation_review_comments from anon, authenticated;
grant select on table public.evaluation_review_rounds to authenticated;
grant select on table public.evaluation_review_comments to authenticated;
grant all on table public.evaluation_review_rounds to service_role;
grant all on table public.evaluation_review_comments to service_role;

drop policy if exists "Department managers can update evaluations" on public.employee_evaluations;
drop policy if exists "Department managers can create approval stages" on public.evaluation_approvals;
drop policy if exists "Assigned approvers and admins can decide approvals" on public.evaluation_approvals;

create policy "Evaluation participants can read review rounds"
  on public.evaluation_review_rounds for select to authenticated
  using (public.evaluation_is_active_user() and public.evaluation_can_read_evaluation(evaluation_id));

create policy "Evaluation participants can read permitted review comments"
  on public.evaluation_review_comments for select to authenticated
  using (
    public.evaluation_is_active_user()
    and public.evaluation_can_read_evaluation(evaluation_id)
    and (
      visibility = 'employee_visible'
      or public.evaluation_can_manage_department(department_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Validation helpers
-- -----------------------------------------------------------------------------

create or replace function public.performance_band_for_evaluation_score(
  p_evaluation_id uuid,
  p_score numeric
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select band ->> 'label'
  from public.employee_evaluations evaluation
  join public.evaluation_weight_configs config on config.id = evaluation.weight_config_id
  cross join lateral jsonb_array_elements(config.performance_band_config) band
  where evaluation.id = p_evaluation_id
    and p_score >= (band ->> 'minimumScore')::numeric
    and p_score <= (band ->> 'maximumScore')::numeric
  order by (band ->> 'minimumScore')::numeric desc
  limit 1;
$$;

create or replace function public.validate_evaluation_review_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_department_id uuid;
  related_evaluation_id uuid;
begin
  select department_id into target_department_id
  from public.employee_evaluations where id = new.evaluation_id;
  if not found then raise exception 'Evaluation does not exist.'; end if;
  new.department_id := target_department_id;

  if new.review_round_id is not null then
    select evaluation_id into related_evaluation_id
    from public.evaluation_review_rounds where id = new.review_round_id;
    if related_evaluation_id is distinct from new.evaluation_id then
      raise exception 'Review comment round must belong to the same evaluation.';
    end if;
  end if;
  if new.approval_id is not null then
    select evaluation_id into related_evaluation_id
    from public.evaluation_approvals where id = new.approval_id;
    if related_evaluation_id is distinct from new.evaluation_id then
      raise exception 'Review comment approval must belong to the same evaluation.';
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
  evaluation_calculation_status text;
begin
  select status, calculation_status
  into evaluation_status, evaluation_calculation_status
  from public.employee_evaluations where id = new.evaluation_id;

  if evaluation_status not in ('pending_approval', 'approved', 'finalized')
    and not (evaluation_status = 'scoring' and evaluation_calculation_status = 'complete') then
    raise exception 'A stipend recommendation requires a complete scored evaluation or an evaluation pending approval or later.';
  end if;
  new.currency := upper(new.currency);
  if new.status in ('recommended', 'approved') and new.recommended_at is null then
    new.recommended_at := now();
    new.recommended_by := coalesce(new.recommended_by, nullif(current_setting('app.actor_user_id', true), '')::uuid, auth.uid());
  end if;
  if tg_op = 'UPDATE' then
    if new.evaluation_id is distinct from old.evaluation_id or new.version is distinct from old.version then
      raise exception 'Stipend recommendation evaluation and version are immutable.';
    end if;
    if old.status = 'approved' and (
      new.recommended_amount is distinct from old.recommended_amount
      or new.currency is distinct from old.currency
      or new.evaluation_id is distinct from old.evaluation_id
    ) then raise exception 'Approved stipend financial fields are immutable.'; end if;
    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status in ('recommended', 'cancelled'))
      or (old.status = 'recommended' and new.status in ('approved', 'rejected', 'superseded', 'cancelled'))
      or (old.status = 'rejected' and new.status = 'superseded')
    ) then raise exception 'Invalid stipend recommendation status transition: % to %.', old.status, new.status; end if;
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
  round_evaluation_id uuid;
  round_department_id uuid;
  recommendation_evaluation_id uuid;
begin
  select employee_id, department_id
  into evaluation_employee_id, evaluation_department_id
  from public.employee_evaluations where id = new.evaluation_id;
  if not found then raise exception 'Evaluation does not exist.'; end if;
  new.department_id := evaluation_department_id;

  if new.review_round_id is null then
    raise exception 'Every human approval must belong to a review round.';
  end if;
  select evaluation_id, department_id into round_evaluation_id, round_department_id
  from public.evaluation_review_rounds where id = new.review_round_id;
  if round_evaluation_id is distinct from new.evaluation_id
    or round_department_id is distinct from evaluation_department_id then
    raise exception 'Approval round must belong to the same evaluation and department.';
  end if;

  if new.stipend_recommendation_id is not null then
    select evaluation_id into recommendation_evaluation_id
    from public.stipend_recommendations where id = new.stipend_recommendation_id;
    if recommendation_evaluation_id is distinct from new.evaluation_id then
      raise exception 'Approval stipend recommendation must belong to the same evaluation.';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.evaluation_id is distinct from old.evaluation_id
    or new.review_round_id is distinct from old.review_round_id
    or new.stipend_recommendation_id is distinct from old.stipend_recommendation_id
    or new.department_id is distinct from old.department_id
    or new.approval_stage is distinct from old.approval_stage
    or new.sequence_number is distinct from old.sequence_number
    or new.required is distinct from old.required
  ) then raise exception 'Approval ownership, round, subject, stage, and sequence are immutable.'; end if;

  if tg_op = 'UPDATE' then
    if old.status in ('approved', 'rejected', 'changes_requested', 'cancelled')
      and to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception 'Completed approval decisions are immutable.';
    end if;
    if old.status = 'waiting' and new.status not in ('waiting', 'pending', 'cancelled') then
      raise exception 'A waiting approval stage must become pending before a decision.';
    end if;
    if old.status = 'pending' and new.status not in ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled') then
      raise exception 'Invalid pending approval transition.';
    end if;
  end if;

  if new.status in ('approved', 'rejected', 'changes_requested') then
    new.decided_by := coalesce(new.decided_by, nullif(current_setting('app.actor_user_id', true), '')::uuid, auth.uid());
    new.decided_at := coalesce(new.decided_at, now());
    if new.decided_by = evaluation_employee_id then
      raise exception 'Employees cannot decide their own evaluation.';
    end if;
  end if;
  if new.currency is not null then new.currency := upper(new.currency); end if;
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
  -- Recommendation authorization occurs only when the final required stage
  -- closes its review round. Intermediate approvals remain advisory.
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Round-aware finalization and payment integrity
-- -----------------------------------------------------------------------------

create or replace function public.validate_employee_evaluation_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  component_count integer;
  scored_component_count integer;
  total_weight numeric(6,2);
  round_status text;
  incomplete_approval_count integer;
begin
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('scoring', 'cancelled'))
    or (old.status = 'scoring' and new.status in ('pending_approval', 'cancelled'))
    or (old.status = 'pending_approval' and new.status in ('scoring', 'approved', 'rejected', 'cancelled'))
    or (old.status = 'rejected' and new.status in ('scoring', 'cancelled'))
    or (old.status = 'approved' and new.status = 'finalized')
  ) then
    raise exception 'Invalid employee evaluation status transition: % to %.', old.status, new.status;
  end if;

  if new.status in ('pending_approval', 'approved', 'finalized') then
    select count(*), count(raw_score), sum(weight)
    into component_count, scored_component_count, total_weight
    from public.evaluation_component_scores where evaluation_id = new.id;
    if component_count <> 3 or scored_component_count <> 3 or total_weight <> 100.00 then
      raise exception 'Evaluation requires all three scored components with weights totaling 100 before approval.';
    end if;
  end if;

  if new.status in ('approved', 'finalized') then
    if new.approved_review_round_id is null or new.final_approval_id is null then
      raise exception 'Approved evaluations require a final approved review round and approval stage.';
    end if;
    select status into round_status
    from public.evaluation_review_rounds
    where id = new.approved_review_round_id and evaluation_id = new.id;
    select count(*) into incomplete_approval_count
    from public.evaluation_approvals
    where review_round_id = new.approved_review_round_id
      and required and status <> 'approved';
    if round_status <> 'approved' or incomplete_approval_count > 0 then
      raise exception 'Every required stage in the approved review round must be approved.';
    end if;
  end if;

  if new.status = 'finalized' and new.finalized_at is null then
    new.finalized_at := now();
    new.finalized_by := coalesce(new.finalized_by, nullif(current_setting('app.actor_user_id', true), '')::uuid, auth.uid());
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
  evaluation_row public.employee_evaluations%rowtype;
  recommendation_row public.stipend_recommendations%rowtype;
  approval_row public.evaluation_approvals%rowtype;
  round_status text;
  incomplete_count integer;
begin
  select * into evaluation_row from public.employee_evaluations where id = new.evaluation_id;
  select * into recommendation_row from public.stipend_recommendations where id = new.stipend_recommendation_id;
  select * into approval_row from public.evaluation_approvals where id = new.approval_id;

  if evaluation_row.status not in ('approved', 'finalized') then
    raise exception 'Payments require an approved or finalized employee evaluation.';
  end if;
  if new.review_round_id is null
    or evaluation_row.approved_review_round_id is distinct from new.review_round_id then
    raise exception 'Payment must use the evaluation current approved review round.';
  end if;
  select status into round_status from public.evaluation_review_rounds
  where id = new.review_round_id and evaluation_id = new.evaluation_id;
  if round_status <> 'approved' then raise exception 'Payment review round is not approved.'; end if;

  if recommendation_row.evaluation_id is distinct from new.evaluation_id
    or recommendation_row.review_round_id is distinct from new.review_round_id
    or recommendation_row.status <> 'approved'
    or recommendation_row.authorized_by_approval_id is distinct from new.approval_id then
    raise exception 'Payment requires the monetary recommendation authorized by the final approval.';
  end if;
  if approval_row.evaluation_id is distinct from new.evaluation_id
    or approval_row.review_round_id is distinct from new.review_round_id
    or approval_row.stipend_recommendation_id is distinct from new.stipend_recommendation_id
    or approval_row.status <> 'approved'
    or evaluation_row.final_approval_id is distinct from new.approval_id then
    raise exception 'Payment requires the final approved human authorization.';
  end if;
  select count(*) into incomplete_count from public.evaluation_approvals
  where review_round_id = new.review_round_id and required and status <> 'approved';
  if incomplete_count > 0 then raise exception 'All required stages in the payment review round must be approved.'; end if;

  new.employee_id := evaluation_row.employee_id;
  new.department_id := evaluation_row.department_id;
  new.currency := upper(new.currency);
  if new.currency <> approval_row.currency or new.amount <> approval_row.approved_amount then
    raise exception 'Payment amount and currency must exactly match the final human authorization.';
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

-- -----------------------------------------------------------------------------
-- Audit attribution for service-role transactions and new review entities
-- -----------------------------------------------------------------------------

alter table public.evaluation_audit_history
  drop constraint evaluation_audit_history_entity_type_check,
  add constraint evaluation_audit_history_entity_type_check check (entity_type in (
    'weight_config', 'evaluation_period', 'attendance', 'employee_evaluation',
    'component_score', 'stipend_recommendation', 'evaluation_approval', 'payment',
    'evaluation_review_round', 'evaluation_review_comment'
  ));

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
  configured_actor text;
  configured_request text;
begin
  audit_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  audit_entity_id := (audit_row ->> 'id')::uuid;
  configured_actor := nullif(current_setting('app.actor_user_id', true), '');
  configured_request := nullif(current_setting('app.request_id', true), '');
  audit_actor_id := coalesce(auth.uid(), configured_actor::uuid);

  audit_entity_type := case tg_table_name
    when 'evaluation_weight_configs' then 'weight_config'
    when 'evaluation_periods' then 'evaluation_period'
    when 'attendance_records' then 'attendance'
    when 'employee_evaluations' then 'employee_evaluation'
    when 'evaluation_component_scores' then 'component_score'
    when 'stipend_recommendations' then 'stipend_recommendation'
    when 'evaluation_approvals' then 'evaluation_approval'
    when 'payment_records' then 'payment'
    when 'evaluation_review_rounds' then 'evaluation_review_round'
    when 'evaluation_review_comments' then 'evaluation_review_comment'
  end;

  if tg_table_name = 'attendance_records' then
    audit_employee_id := (audit_row ->> 'employee_id')::uuid;
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'approved_by')::uuid, (audit_row ->> 'recorded_by')::uuid);
  elsif tg_table_name = 'employee_evaluations' then
    audit_evaluation_id := audit_entity_id;
    audit_employee_id := (audit_row ->> 'employee_id')::uuid;
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'approved_by')::uuid, (audit_row ->> 'finalized_by')::uuid, (audit_row ->> 'submitted_by')::uuid, (audit_row ->> 'created_by')::uuid);
  elsif tg_table_name in ('evaluation_component_scores', 'stipend_recommendations', 'evaluation_approvals', 'payment_records', 'evaluation_review_rounds', 'evaluation_review_comments') then
    audit_evaluation_id := (audit_row ->> 'evaluation_id')::uuid;
    select employee_id, department_id into audit_employee_id, audit_department_id
    from public.employee_evaluations where id = audit_evaluation_id;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'author_user_id')::uuid, (audit_row ->> 'closed_by')::uuid, (audit_row ->> 'decided_by')::uuid, (audit_row ->> 'processed_by')::uuid, (audit_row ->> 'recommended_by')::uuid, (audit_row ->> 'created_by')::uuid);
  elsif tg_table_name = 'evaluation_periods' then
    audit_department_id := (audit_row ->> 'department_id')::uuid;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'closed_by')::uuid, (audit_row ->> 'opened_by')::uuid, (audit_row ->> 'created_by')::uuid);
  elsif tg_table_name = 'evaluation_weight_configs' then
    audit_department_id := nullif(audit_row ->> 'department_id', '')::uuid;
    audit_actor_id := coalesce(audit_actor_id, (audit_row ->> 'activated_by')::uuid, (audit_row ->> 'created_by')::uuid);
  end if;

  insert into public.evaluation_audit_history (
    entity_type, entity_id, action, evaluation_id, employee_id, department_id,
    actor_user_id, old_values, new_values, request_id, reason
  ) values (
    audit_entity_type, audit_entity_id, lower(tg_op), audit_evaluation_id,
    audit_employee_id, audit_department_id, audit_actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    configured_request::uuid, nullif(current_setting('app.audit_reason', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger evaluation_review_rounds_updated_at
  before update on public.evaluation_review_rounds
  for each row execute function public.set_evaluation_updated_at();
create trigger evaluation_review_comments_validate
  before insert on public.evaluation_review_comments
  for each row execute function public.validate_evaluation_review_comment();
create trigger evaluation_review_rounds_audit
  after insert or update or delete on public.evaluation_review_rounds
  for each row execute function public.capture_evaluation_audit();
create trigger evaluation_review_comments_audit
  after insert or update or delete on public.evaluation_review_comments
  for each row execute function public.capture_evaluation_audit();

-- -----------------------------------------------------------------------------
-- Transactional human review RPC
-- -----------------------------------------------------------------------------

create or replace function public.review_employee_evaluation(
  p_evaluation_id uuid,
  p_decision text,
  p_reviewer_id uuid,
  p_final_score numeric default null,
  p_final_band text default null,
  p_final_stipend_percentage numeric default null,
  p_final_stipend_mode text default null,
  p_feedback text default null,
  p_adjustment_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_row public.employee_evaluations%rowtype;
  reviewer_role text;
  reviewer_status text;
  reviewer_department_id uuid;
  round_row public.evaluation_review_rounds%rowtype;
  approval_row public.evaluation_approvals%rowtype;
  recommendation_row public.stipend_recommendations%rowtype;
  next_approval public.evaluation_approvals%rowtype;
  next_round_number integer;
  effective_score numeric(6,3);
  effective_band text;
  effective_stipend numeric(5,2);
  effective_mode text;
  adjustment numeric(7,3);
  is_final boolean;
  response_status text;
begin
  if p_decision not in ('feedback', 'return', 'approve') then
    raise exception 'Review decision must be feedback, return, or approve.';
  end if;
  select * into evaluation_row from public.employee_evaluations
  where id = p_evaluation_id for update;
  if not found then raise exception 'Employee evaluation was not found.'; end if;

  if auth.uid() is not null and auth.uid() <> p_reviewer_id then
    raise exception 'Reviewer identity does not match the authenticated principal.';
  end if;
  select role, status, department_id
  into reviewer_role, reviewer_status, reviewer_department_id
  from public.users where id = p_reviewer_id;
  if reviewer_status is distinct from 'active'
    or reviewer_role not in ('admin', 'department_lead') then
    raise exception 'An active authorized reviewer is required.';
  end if;
  if evaluation_row.employee_id = p_reviewer_id then
    raise exception 'Employees cannot review or approve their own evaluation.';
  end if;
  if reviewer_role = 'department_lead'
    and reviewer_department_id is distinct from evaluation_row.department_id then
    raise exception 'Department leads may review only their own department.';
  end if;

  perform set_config('app.actor_user_id', p_reviewer_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, gen_random_uuid())::text, true);
  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_adjustment_reason), ''), nullif(btrim(p_feedback), ''), ''), true);

  select * into round_row from public.evaluation_review_rounds
  where evaluation_id = p_evaluation_id and status = 'in_review'
  for update;

  -- Feedback is append-only and never creates or advances a workflow.
  if p_decision = 'feedback' then
    if coalesce(btrim(p_feedback), '') = '' then raise exception 'Feedback is required.'; end if;
    if char_length(btrim(p_feedback)) > 5000 then raise exception 'Feedback must be 5000 characters or fewer.'; end if;
    if found then
      select * into approval_row from public.evaluation_approvals
      where review_round_id = round_row.id and status = 'pending' for update;
    end if;
    insert into public.evaluation_review_comments (
      evaluation_id, review_round_id, approval_id, department_id,
      author_user_id, visibility, body
    ) values (
      p_evaluation_id, round_row.id, approval_row.id, evaluation_row.department_id,
      p_reviewer_id, 'employee_visible', btrim(p_feedback)
    );
    return jsonb_build_object(
      'decision', 'feedback',
      'finalized', false,
      'approvalStatus', evaluation_row.current_approval_status,
      'reviewRoundId', round_row.id,
      'approvalId', approval_row.id
    );
  end if;

  if evaluation_row.calculation_status <> 'complete' or evaluation_row.overall_score is null
    or evaluation_row.performance_band is null or evaluation_row.stipend_recommendation_mode is null then
    raise exception 'A complete calculated evaluation is required before human review.';
  end if;
  if evaluation_row.status in ('approved', 'finalized', 'cancelled') then
    raise exception 'This evaluation is no longer open for review.';
  end if;

  -- A decision on an unsubmitted evaluation atomically starts a new round.
  if round_row.id is null then
    select coalesce(max(round_number), 0) + 1 into next_round_number
    from public.evaluation_review_rounds where evaluation_id = p_evaluation_id;
    select * into recommendation_row from public.stipend_recommendations
    where evaluation_id = p_evaluation_id and status = 'recommended'
    order by version desc limit 1 for update;

    insert into public.evaluation_review_rounds (
      evaluation_id, department_id, round_number, status,
      calculation_revision, calculation_run_id, calculated_score,
      calculated_performance_band, calculated_stipend_percentage,
      calculated_stipend_mode, calculation_snapshot,
      proposed_score, proposed_performance_band, proposed_stipend_percentage,
      proposed_stipend_mode, submitted_by
    ) values (
      p_evaluation_id, evaluation_row.department_id, next_round_number, 'in_review',
      evaluation_row.calculation_revision, evaluation_row.calculation_run_id,
      evaluation_row.overall_score, evaluation_row.performance_band,
      evaluation_row.calculated_stipend_percentage, evaluation_row.stipend_recommendation_mode,
      evaluation_row.calculation_snapshot, evaluation_row.overall_score,
      evaluation_row.performance_band, evaluation_row.calculated_stipend_percentage,
      evaluation_row.stipend_recommendation_mode, p_reviewer_id
    ) returning * into round_row;

    update public.employee_evaluations
    set status = case when status in ('draft', 'rejected') then 'scoring' else status end
    where id = p_evaluation_id;
    update public.employee_evaluations
    set status = 'pending_approval', submitted_by = p_reviewer_id,
      submitted_at = now(), current_approval_status = 'pending',
      approval_feedback = null
    where id = p_evaluation_id;

    if recommendation_row.id is not null then
      update public.stipend_recommendations
      set review_round_id = round_row.id,
        recommended_percentage = case
          when recommendation_mode = 'percentage'
            then coalesce(recommended_percentage, evaluation_row.calculated_stipend_percentage)
          else null
        end,
        updated_at = now()
      where id = recommendation_row.id
      returning * into recommendation_row;
    end if;

    insert into public.evaluation_approvals (
      evaluation_id, review_round_id, stipend_recommendation_id, department_id,
      approval_stage, sequence_number, status, assigned_approver_id, created_by,
      original_calculated_score, original_performance_band,
      original_stipend_percentage, calculation_snapshot
    ) values
      (p_evaluation_id, round_row.id, recommendation_row.id, evaluation_row.department_id,
       'department', 1, 'pending', p_reviewer_id, p_reviewer_id,
       evaluation_row.overall_score, evaluation_row.performance_band,
       evaluation_row.calculated_stipend_percentage, evaluation_row.calculation_snapshot),
      (p_evaluation_id, round_row.id, recommendation_row.id, evaluation_row.department_id,
       'administration', 2, 'waiting', null, p_reviewer_id,
       evaluation_row.overall_score, evaluation_row.performance_band,
       evaluation_row.calculated_stipend_percentage, evaluation_row.calculation_snapshot);

    if recommendation_row.id is not null then
      insert into public.evaluation_approvals (
        evaluation_id, review_round_id, stipend_recommendation_id, department_id,
        approval_stage, sequence_number, status, created_by,
        original_calculated_score, original_performance_band,
        original_stipend_percentage, calculation_snapshot
      ) values (
        p_evaluation_id, round_row.id, recommendation_row.id, evaluation_row.department_id,
        'finance', 3, 'waiting', p_reviewer_id,
        evaluation_row.overall_score, evaluation_row.performance_band,
        evaluation_row.calculated_stipend_percentage, evaluation_row.calculation_snapshot
      );
    end if;

  end if;

  select * into approval_row from public.evaluation_approvals
  where review_round_id = round_row.id and status = 'pending'
  for update;
  if not found then raise exception 'No active approval stage is available.'; end if;
  if approval_row.assigned_approver_id is not null
    and approval_row.assigned_approver_id <> p_reviewer_id then
    raise exception 'This approval stage is assigned to another reviewer.';
  end if;
  if approval_row.approval_stage = 'department' then
    if reviewer_role not in ('admin', 'department_lead') then
      raise exception 'This reviewer cannot decide the department stage.';
    end if;
  elsif reviewer_role <> 'admin' then
    raise exception 'Administration and finance stages require an administrator.';
  end if;

  if p_decision = 'return' then
    if coalesce(btrim(p_feedback), '') = '' then
      raise exception 'A reason is required when returning an evaluation.';
    end if;
    update public.evaluation_approvals
    set status = 'changes_requested', decision_note = btrim(p_feedback),
      decided_by = p_reviewer_id, decided_at = now()
    where id = approval_row.id;
    update public.evaluation_approvals set status = 'cancelled'
    where review_round_id = round_row.id and status = 'waiting';
    update public.evaluation_review_rounds
    set status = 'changes_requested', closed_by = p_reviewer_id,
      closed_at = now(), close_reason = btrim(p_feedback)
    where id = round_row.id;
    update public.stipend_recommendations
    set status = 'rejected', updated_at = now()
    where id = approval_row.stipend_recommendation_id and status = 'recommended';
    update public.employee_evaluations
    set status = 'scoring', current_approval_status = 'changes_requested',
      approval_feedback = btrim(p_feedback),
      approved_review_round_id = null, final_approval_id = null,
      approved_stipend_recommendation_id = null,
      approved_score = null, approved_performance_band = null,
      approved_stipend_percentage = null, approved_stipend_mode = null,
      approved_by = null, approved_at = null,
      approved_calculation_revision = null, adjustment_reason = null
    where id = p_evaluation_id;
    return jsonb_build_object(
      'decision', 'return', 'finalized', false,
      'approvalStatus', 'changes_requested',
      'reviewRoundId', round_row.id, 'approvalId', approval_row.id
    );
  end if;

  if p_final_stipend_mode not in ('percentage', 'manual') then
    raise exception 'Approved stipend mode must be percentage or manual.';
  end if;
  effective_score := coalesce(p_final_score, round_row.proposed_score);
  if effective_score < 0 or effective_score > 100 then
    raise exception 'Final score must be between 0 and 100.';
  end if;
  effective_band := public.performance_band_for_evaluation_score(p_evaluation_id, effective_score);
  if effective_band is null or p_final_band is distinct from effective_band then
    raise exception 'Approved performance band does not match the configured score policy.';
  end if;
  effective_mode := p_final_stipend_mode;
  effective_stipend := case when effective_mode = 'manual' then null else p_final_stipend_percentage end;
  if effective_mode = 'percentage' and (effective_stipend is null or effective_stipend < 0 or effective_stipend > 100) then
    raise exception 'Approved stipend percentage must be between 0 and 100.';
  end if;

  if approval_row.stipend_recommendation_id is not null then
    select * into recommendation_row from public.stipend_recommendations
    where id = approval_row.stipend_recommendation_id for update;
    if effective_mode is distinct from recommendation_row.recommendation_mode
      or (effective_mode = 'percentage' and effective_stipend is distinct from recommendation_row.recommended_percentage)
      or (effective_mode = 'manual' and recommendation_row.recommended_percentage is not null) then
      raise exception 'A linked monetary recommendation must be revised before changing its stipend percentage or mode.';
    end if;
  end if;

  adjustment := round(effective_score - round_row.proposed_score, 3);
  if (
    effective_score is distinct from round_row.proposed_score
    or effective_band is distinct from round_row.proposed_performance_band
    or effective_stipend is distinct from round_row.proposed_stipend_percentage
    or effective_mode is distinct from round_row.proposed_stipend_mode
  ) and coalesce(btrim(p_adjustment_reason), '') = '' then
    raise exception 'A reason is required for every manual adjustment.';
  end if;

  select * into next_approval from public.evaluation_approvals
  where review_round_id = round_row.id and status = 'waiting' and required
  order by sequence_number limit 1 for update;
  is_final := not found;

  update public.evaluation_approvals
  set status = 'approved', decision_note = nullif(btrim(p_feedback), ''),
    decided_by = p_reviewer_id, decided_at = now(),
    input_score = round_row.proposed_score,
    input_performance_band = round_row.proposed_performance_band,
    input_stipend_percentage = round_row.proposed_stipend_percentage,
    input_stipend_mode = round_row.proposed_stipend_mode,
    approved_final_score = effective_score,
    approved_final_band = effective_band,
    approved_final_stipend_percentage = effective_stipend,
    approved_final_stipend_mode = effective_mode,
    score_adjustment = adjustment,
    adjustment_reason = nullif(btrim(p_adjustment_reason), ''),
    approved_amount = case when is_final then recommendation_row.recommended_amount else null end,
    currency = case when is_final then recommendation_row.currency else null end
  where id = approval_row.id;

  update public.evaluation_review_rounds
  set proposed_score = effective_score,
    proposed_performance_band = effective_band,
    proposed_stipend_percentage = effective_stipend,
    proposed_stipend_mode = effective_mode,
    proposed_adjustment_reason = coalesce(nullif(btrim(p_adjustment_reason), ''), proposed_adjustment_reason)
  where id = round_row.id returning * into round_row;

  if not is_final then
    update public.evaluation_approvals set status = 'pending' where id = next_approval.id;
    update public.employee_evaluations
    set status = 'pending_approval', current_approval_status = 'pending'
    where id = p_evaluation_id;
    response_status := 'pending';
  else
    if approval_row.stipend_recommendation_id is not null then
      update public.stipend_recommendations
      set status = 'approved', authorized_by_approval_id = approval_row.id,
        review_round_id = round_row.id, recommended_percentage = effective_stipend,
        updated_at = now()
      where id = recommendation_row.id and status = 'recommended';
    end if;

    update public.evaluation_review_rounds
    set status = 'approved', closed_by = p_reviewer_id, closed_at = now()
    where id = round_row.id;
    update public.employee_evaluations
    set status = 'approved', current_approval_status = 'approved',
      approved_review_round_id = round_row.id, final_approval_id = approval_row.id,
      approved_stipend_recommendation_id = approval_row.stipend_recommendation_id,
      approved_score = effective_score, approved_performance_band = effective_band,
      approved_stipend_percentage = effective_stipend,
      approved_stipend_mode = effective_mode,
      approved_by = p_reviewer_id, approved_at = now(),
      approved_calculation_revision = evaluation_row.calculation_revision,
      approval_feedback = nullif(btrim(p_feedback), ''),
      adjustment_reason = round_row.proposed_adjustment_reason
    where id = p_evaluation_id;
    response_status := 'approved';
  end if;

  return jsonb_build_object(
    'decision', 'approve', 'finalized', is_final,
    'approvalStatus', response_status,
    'reviewRoundId', round_row.id, 'approvalId', approval_row.id,
    'nextStage', case when is_final then null else next_approval.approval_stage end
  );
end;
$$;

revoke all on function public.performance_band_for_evaluation_score(uuid, numeric) from public, anon, authenticated;
grant execute on function public.performance_band_for_evaluation_score(uuid, numeric) to service_role;
revoke all on function public.review_employee_evaluation(uuid, text, uuid, numeric, text, numeric, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.review_employee_evaluation(uuid, text, uuid, numeric, text, numeric, text, text, text, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- Dashboard summary uses one explicit current status per evaluation.
-- -----------------------------------------------------------------------------

create or replace function public.get_evaluation_dashboard_summary(
  p_department_id uuid default null,
  p_period_id uuid default null,
  p_employee_id uuid default null,
  p_performance_band text default null,
  p_approval_status text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as (
    select evaluation.*
    from public.employee_evaluations evaluation
    where (p_department_id is null or evaluation.department_id = p_department_id)
      and (p_period_id is null or evaluation.evaluation_period_id = p_period_id)
      and (p_employee_id is null or evaluation.employee_id = p_employee_id)
      and (p_performance_band is null or evaluation.performance_band = p_performance_band)
      and (p_approval_status is null or evaluation.current_approval_status = p_approval_status)
  ), component_pivot as (
    select score.evaluation_id,
      max(score.raw_score) filter (where score.component = 'task_performance') as task_score,
      max(score.raw_score) filter (where score.component = 'reporting_performance') as reporting_score,
      max(score.raw_score) filter (where score.component = 'attendance') as attendance_score
    from public.evaluation_component_scores score
    join filtered on filtered.id = score.evaluation_id
    group by score.evaluation_id
  )
  select jsonb_build_object(
    'totalEvaluations', count(*),
    'completeEvaluations', count(*) filter (where filtered.calculation_status = 'complete'),
    'averageOverallScore', round(avg(filtered.overall_score) filter (where filtered.calculation_status = 'complete'), 2),
    'averageTaskScore', round(avg(component_pivot.task_score), 2),
    'averageReportingScore', round(avg(component_pivot.reporting_score), 2),
    'averageAttendanceScore', round(avg(component_pivot.attendance_score), 2),
    'excellentCount', count(*) filter (where filtered.performance_band = 'Excellent'),
    'reviewRequiredCount', count(*) filter (where filtered.performance_band = 'Review Required'),
    'approvedCount', count(*) filter (where filtered.current_approval_status = 'approved'),
    'pendingApprovalCount', count(*) filter (where filtered.current_approval_status = 'pending')
  )
  from filtered left join component_pivot on component_pivot.evaluation_id = filtered.id;
$$;

comment on table public.evaluation_review_rounds is
  'Immutable review attempts that snapshot advisory calculation inputs and carry a sequential human approval route.';
comment on table public.evaluation_review_comments is
  'Append-only reviewer feedback; comments never change evaluation or approval workflow state.';
comment on column public.employee_evaluations.current_approval_status is
  'Cached current review-round status for unambiguous dashboard filtering; historical approvals remain separate.';
comment on column public.employee_evaluations.approved_score is
  'Human-approved final score; original calculated overall_score is never overwritten.';
