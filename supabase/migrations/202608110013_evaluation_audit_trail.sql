-- Complete audit trail for sensitive evaluation and stipend actions.
-- Extends the append-only evaluation_audit_history table with a semantic event
-- classification so management can trace evaluation generation, recalculation,
-- manual adjustment, manager review/feedback, approval, return-for-review,
-- stipend adjustment, and payment lifecycle actions.

-- -----------------------------------------------------------------------------
-- Semantic event classification
-- -----------------------------------------------------------------------------

create or replace function public.classify_evaluation_audit_event(
  p_entity_type text,
  p_action text,
  p_old_values jsonb,
  p_new_values jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity_type = 'employee_evaluation' then
      case p_action
        when 'insert' then 'evaluation_generated'
        when 'delete' then 'record_deleted'
        else
          case
            when coalesce(p_new_values ->> 'current_approval_status', '') = 'changes_requested'
              and coalesce(p_old_values ->> 'current_approval_status', '') <> 'changes_requested'
              then 'returned_for_review'
            when coalesce(p_new_values ->> 'status', '') = 'approved'
              and coalesce(p_old_values ->> 'status', '') <> 'approved'
              then 'approval'
            when (p_new_values ->> 'approved_score') is distinct from (p_old_values ->> 'approved_score')
              or (p_new_values ->> 'approved_stipend_percentage') is distinct from (p_old_values ->> 'approved_stipend_percentage')
              or (p_new_values ->> 'approved_performance_band') is distinct from (p_old_values ->> 'approved_performance_band')
              then 'manual_adjustment'
            when (p_new_values ->> 'overall_score') is distinct from (p_old_values ->> 'overall_score')
              or (p_new_values ->> 'performance_band') is distinct from (p_old_values ->> 'performance_band')
              or (p_new_values ->> 'calculation_status') is distinct from (p_old_values ->> 'calculation_status')
              or (p_new_values ->> 'calculation_revision') is distinct from (p_old_values ->> 'calculation_revision')
              then 'evaluation_recalculated'
            else 'record_updated'
          end
      end
    when p_entity_type = 'component_score' then
      case
        when p_action = 'insert' then 'record_created'
        when p_action = 'delete' then 'record_deleted'
        when (p_new_values ->> 'raw_score') is distinct from (p_old_values ->> 'raw_score') then 'evaluation_recalculated'
        else 'record_updated'
      end
    when p_entity_type = 'evaluation_review_round' then
      case
        when p_action = 'insert' then 'manager_review'
        when p_action = 'delete' then 'record_deleted'
        when coalesce(p_new_values ->> 'status', '') = 'approved' then 'approval'
        when coalesce(p_new_values ->> 'status', '') = 'changes_requested' then 'returned_for_review'
        when coalesce(p_new_values ->> 'status', '') = 'rejected' then 'approval_rejected'
        when coalesce(p_new_values ->> 'status', '') = 'cancelled' then 'approval_cancelled'
        else 'record_updated'
      end
    when p_entity_type = 'evaluation_review_comment' then
      case p_action
        when 'insert' then 'manager_feedback'
        when 'delete' then 'record_deleted'
        else 'record_updated'
      end
    when p_entity_type = 'evaluation_approval' then
      case p_action
        when 'insert' then 'approval_stage_created'
        when 'delete' then 'record_deleted'
        else
          case coalesce(p_new_values ->> 'status', '')
            when 'approved' then
              case when coalesce((p_new_values ->> 'score_adjustment')::numeric, 0) <> 0
                then 'manual_adjustment' else 'approval' end
            when 'changes_requested' then 'returned_for_review'
            when 'rejected' then 'approval_rejected'
            when 'cancelled' then 'approval_cancelled'
            else 'record_updated'
          end
      end
    when p_entity_type = 'stipend_recommendation' then
      case
        when p_action = 'insert' then 'stipend_recommendation_created'
        when p_action = 'delete' then 'record_deleted'
        when (p_new_values ->> 'final_approved_amount') is distinct from (p_old_values ->> 'final_approved_amount')
          or (p_new_values ->> 'amount_adjustment') is distinct from (p_old_values ->> 'amount_adjustment')
          then 'stipend_adjustment'
        when coalesce(p_new_values ->> 'status', '') = 'approved' then 'stipend_approved'
        when coalesce(p_new_values ->> 'status', '') = 'rejected' then 'stipend_rejected'
        when coalesce(p_new_values ->> 'status', '') = 'superseded' then 'stipend_superseded'
        else 'record_updated'
      end
    when p_entity_type = 'payment' then
      case p_action
        when 'insert' then 'payment_record_created'
        when 'delete' then 'record_deleted'
        else
          case coalesce(p_new_values ->> 'status', '')
            when 'approved' then 'payment_approved'
            when 'held' then 'payment_held'
            when 'paid' then 'payment_marked_paid'
            when 'pending' then 'payment_released'
            else 'record_updated'
          end
      end
    when p_entity_type = 'attendance' then
      case p_action
        when 'insert' then 'attendance_recorded'
        when 'delete' then 'attendance_deleted'
        else 'attendance_updated'
      end
    when p_entity_type = 'evaluation_period' then
      case
        when p_action = 'insert' then 'period_created'
        when p_action = 'delete' then 'record_deleted'
        when (p_new_values ->> 'status') is distinct from (p_old_values ->> 'status') then 'period_status_changed'
        else 'record_updated'
      end
    when p_entity_type = 'weight_config' then
      case p_action
        when 'insert' then 'weight_config_created'
        when 'delete' then 'record_deleted'
        else 'record_updated'
      end
    when p_entity_type = 'stipend_base_config' then
      case p_action
        when 'insert' then 'base_config_created'
        when 'delete' then 'record_deleted'
        else 'record_updated'
      end
    else
      case p_action
        when 'insert' then 'record_created'
        when 'delete' then 'record_deleted'
        else 'record_updated'
      end
  end;
$$;

comment on function public.classify_evaluation_audit_event(text, text, jsonb, jsonb) is
  'Deterministic semantic classification of an append-only audit row. Must stay in sync with utils/auditEventClassification.js.';

-- -----------------------------------------------------------------------------
-- Add the classified event type and backfill existing history
-- -----------------------------------------------------------------------------

alter table public.evaluation_audit_history
  add column event_type text;

update public.evaluation_audit_history
set event_type = public.classify_evaluation_audit_event(entity_type, action, old_values, new_values)
where event_type is null;

alter table public.evaluation_audit_history
  alter column event_type set not null,
  add constraint evaluation_audit_history_event_type_check
    check (event_type in (
      'evaluation_generated', 'evaluation_recalculated', 'record_created',
      'record_updated', 'record_deleted', 'approval', 'manual_adjustment',
      'returned_for_review', 'approval_rejected', 'approval_cancelled',
      'approval_stage_created', 'manager_review', 'manager_feedback',
      'stipend_recommendation_created', 'stipend_approved', 'stipend_rejected',
      'stipend_superseded', 'stipend_adjustment', 'payment_record_created',
      'payment_approved', 'payment_held', 'payment_marked_paid', 'payment_released',
      'attendance_recorded', 'attendance_updated', 'attendance_deleted',
      'period_created', 'period_status_changed', 'weight_config_created',
      'base_config_created'
    ));

create index evaluation_audit_event_type_idx
  on public.evaluation_audit_history (event_type, occurred_at desc)
  where event_type is not null;

create index evaluation_audit_actor_idx
  on public.evaluation_audit_history (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

-- The audit trail stores the evaluation id without a prior foreign key, which
-- also prevented PostgREST from embedding the related evaluation. Evaluations
-- are cancelled, never physically deleted, so on delete set null preserves the
-- full append-only trail.
alter table public.evaluation_audit_history
  add constraint evaluation_audit_history_evaluation_fkey
    foreign key (evaluation_id) references public.employee_evaluations(id)
    on delete set null;

comment on column public.evaluation_audit_history.event_type is
  'Semantic action classification (evaluation_generated, approval, payment_held, etc.) derived from the affected entity and before/after values.';

-- -----------------------------------------------------------------------------
-- Update capture triggers so new audit rows always carry a classification
-- -----------------------------------------------------------------------------

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
  audit_event_type text;
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

  audit_event_type := public.classify_evaluation_audit_event(
    audit_entity_type,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  insert into public.evaluation_audit_history (
    entity_type, entity_id, action, event_type, evaluation_id, employee_id, department_id,
    actor_user_id, old_values, new_values, request_id, reason
  ) values (
    audit_entity_type, audit_entity_id, lower(tg_op), audit_event_type, audit_evaluation_id,
    audit_employee_id, audit_department_id, audit_actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    configured_request::uuid, nullif(current_setting('app.audit_reason', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.capture_stipend_base_config_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_row jsonb;
  actor_id uuid;
  audit_event_type text;
begin
  audit_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  actor_id := coalesce(
    auth.uid(),
    nullif(current_setting('app.actor_user_id', true), '')::uuid,
    (audit_row ->> 'updated_by')::uuid,
    (audit_row ->> 'created_by')::uuid
  );
  audit_event_type := public.classify_evaluation_audit_event(
    'stipend_base_config',
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  insert into public.evaluation_audit_history (
    entity_type, entity_id, action, event_type, department_id, actor_user_id,
    old_values, new_values, request_id, reason
  ) values (
    'stipend_base_config', (audit_row ->> 'id')::uuid, lower(tg_op), audit_event_type,
    nullif(audit_row ->> 'department_id', '')::uuid, actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Read access for the management audit interface
-- -----------------------------------------------------------------------------

-- Writes remain append-only through security-definer triggers. Normal users can
-- never INSERT, UPDATE, or DELETE audit rows directly.
revoke insert, update, delete on table public.evaluation_audit_history from authenticated;
revoke all on table public.evaluation_audit_history from anon;

grant select on table public.evaluation_audit_history to authenticated;

drop policy if exists "Evaluation participants can read audit history"
  on public.evaluation_audit_history;

-- Restrictive read policy: administrators can read the full trail; department
-- leads can read rows for their department; employees can read rows where they
-- are the subject (employee_id) or the actor (actor_user_id). Restrictive
-- policies are ANDed with permissive policies, so no other policy can widen
-- this scope.
create policy "Restrict audit history reads to scope"
  on public.evaluation_audit_history as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      public.evaluation_is_admin()
      or public.evaluation_can_manage_department(department_id)
      or employee_id = auth.uid()
      or actor_user_id = auth.uid()
    )
  );

comment on policy "Restrict audit history reads to scope" on public.evaluation_audit_history is
  'Management can read department-scoped history; employees can read rows for which they are the subject or actor. Raw audit JSON may still be filtered by the API for employee-facing views.';

comment on table public.evaluation_audit_history is
  'Append-only trigger-generated history for evaluation and payment-domain records. event_type classifies each change semantically; old_values/new_values preserve the exact before/after state.';
