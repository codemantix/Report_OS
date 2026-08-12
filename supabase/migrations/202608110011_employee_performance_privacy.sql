-- Employee My Performance privacy hardening.
-- RLS ownership remains authoritative while column grants prevent direct access
-- to private review, management, audit, and payment-administration fields.

-- Approval stages, review rounds, and raw audit history contain management-only
-- notes and snapshots. Employee-safe final results remain on employee_evaluations.
revoke select on table public.evaluation_approvals from authenticated;
revoke select on table public.evaluation_review_rounds from authenticated;
revoke select on table public.evaluation_audit_history from authenticated;

-- Restrict direct authenticated evaluation reads to employee-safe columns.
-- Existing RLS still limits each employee to employee_id = auth.uid(). Trusted
-- management APIs continue through service_role.
revoke select on table public.employee_evaluations from authenticated;
grant select (
  id, employee_id, evaluation_period_id, department_id, weight_config_id,
  status, overall_score, calculation_version, evidence_cutoff_at,
  employee_name_snapshot, department_name_snapshot, created_at, updated_at,
  calculation_status, performance_band, calculated_stipend_percentage,
  stipend_recommendation_mode, calculation_revision, calculated_at, approved_score,
  approved_performance_band, approved_stipend_percentage,
  approved_stipend_mode, approved_at, current_approval_status,
  approved_stipend_recommendation_id
) on table public.employee_evaluations to authenticated;

-- Raw component evidence JSON may contain historical AI or reviewer free-text.
-- Employee explainability is served through the ownership-checked API after
-- sanitization, so direct authenticated component-table access is removed.
revoke select on table public.evaluation_component_scores from authenticated;

-- Existing task/report comments are collaborative feedback in Report OS. Add an
-- explicit visibility boundary so future management-only notes cannot leak into
-- employee performance responses.
alter table public.admin_comments
  add column if not exists visibility text not null default 'employee_visible'
    check (visibility in ('employee_visible', 'management_only'));
alter table public.task_comments
  add column if not exists visibility text not null default 'employee_visible'
    check (visibility in ('employee_visible', 'management_only'));

alter table public.admin_comments enable row level security;
alter table public.task_comments enable row level security;

-- Restrictive policies are ANDed with permissive policies. Define an explicit
-- active-user baseline so this migration remains safe even when the legacy
-- tables did not already have SELECT policies; the restrictive policies below
-- still determine which rows each active user may retrieve.
create policy "Active users can attempt to read report comments"
  on public.admin_comments as permissive for select to authenticated
  using (public.evaluation_is_active_user());

create policy "Active users can attempt to read task comments"
  on public.task_comments as permissive for select to authenticated
  using (public.evaluation_is_active_user());

-- Preserve the existing direct authenticated task-comment creation flow after
-- enabling RLS. The author must be the caller and must either be assigned to the
-- canonical task or manage that task's department.
create policy "Assigned users and department managers can create task comments"
  on public.task_comments as permissive for insert to authenticated
  with check (
    public.evaluation_is_active_user()
    and task_comments.user_id = auth.uid()
    and (
      (
        task_comments.visibility = 'employee_visible'
        and exists (
          select 1 from public.task_assignees assignment
          where assignment.task_id = task_comments.task_id
            and assignment.user_id = auth.uid()
        )
      )
      or exists (
        select 1 from public.tasks task
        where task.id = task_comments.task_id
          and public.evaluation_can_manage_department(task.department_id)
      )
    )
  );

-- Team members can retrieve only explicitly employee-visible comments on their
-- own reports or assigned tasks. Existing admins retain global access, while
-- department leads retain access only within their managed department.
create policy "Restrict report comments to visible owned or managed reports"
  on public.admin_comments as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      exists (
        select 1 from public.reports report
        where report.id = admin_comments.report_id
          and report.user_id = auth.uid()
          and admin_comments.visibility = 'employee_visible'
      )
      or public.evaluation_is_admin()
      or exists (
        select 1 from public.reports report
        join public.users manager on manager.id = auth.uid()
        where report.id = admin_comments.report_id
          and manager.status = 'active'
          and manager.role = 'department_lead'
          and manager.department_id = report.department_id
      )
    )
  );

create policy "Restrict task comments to visible assigned or managed tasks"
  on public.task_comments as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      (
        task_comments.visibility = 'employee_visible'
        and exists (
          select 1 from public.task_assignees assignment
          where assignment.task_id = task_comments.task_id
            and assignment.user_id = auth.uid()
        )
      )
      or public.evaluation_is_admin()
      or exists (
        select 1 from public.tasks task
        join public.users manager on manager.id = auth.uid()
        where task.id = task_comments.task_id
          and manager.status = 'active'
          and manager.role = 'department_lead'
          and manager.department_id = task.department_id
      )
    )
  );

-- Restrict direct attendance reads to the employee-visible official record.
-- Management evidence, external references, and actor metadata remain API-only.
revoke select on table public.attendance_records from authenticated;
grant select (
  id, employee_id, department_id, evaluation_period_id,
  attendance_date, meeting_session, attendance_type,
  attendance_status, review_status, notes, recorded_by,
  recorded_at, created_at, updated_at
) on table public.attendance_records to authenticated;

-- Evaluation-period lifecycle actors are management metadata. Employees need
-- only the period identity, dates, deadline, department, and public status.
revoke select on table public.evaluation_periods from authenticated;
grant select (
  id, department_id, name, start_date, end_date,
  evaluation_deadline, status, created_at, updated_at
) on table public.evaluation_periods to authenticated;

-- Employees may inspect an issued recommendation and, once approved, its final
-- amount. Base policy, formula internals, rationale, adjustment reasons, and
-- management actors remain private.
revoke select on table public.stipend_recommendations from authenticated;
grant select (
  id, evaluation_id, version, status, recommendation_mode,
  recommended_percentage, recommended_amount, final_approved_amount,
  currency, recommended_at, approved_at, created_at, updated_at
) on table public.stipend_recommendations to authenticated;

-- Employees may see their own payment status/date/amount only. Payment approval
-- actors, recording actors, references, notes, hold reasons, and provider fields
-- remain management-only. Existing payment RLS enforces employee ownership.
revoke select on table public.payment_records from authenticated;
grant select (
  id, evaluation_id, stipend_recommendation_id, employee_id, department_id,
  amount, currency, status, payment_date, created_at, updated_at
) on table public.payment_records to authenticated;

drop policy if exists "Employees can read issued stipend recommendations"
  on public.stipend_recommendations;
create policy "Employees can read issued stipend recommendations"
  on public.stipend_recommendations for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      public.evaluation_can_manage_evaluation(evaluation_id)
      or exists (
        select 1 from public.employee_evaluations evaluation
        where evaluation.id = stipend_recommendations.evaluation_id
          and evaluation.employee_id = auth.uid()
          and stipend_recommendations.status in ('recommended', 'approved')
      )
    )
  );

comment on policy "Employees and department managers can read evaluations"
  on public.employee_evaluations is
  'Row ownership policy for employee performance. Column grants separately exclude private management and approval metadata.';
comment on policy "Evaluation participants can read component scores"
  on public.evaluation_component_scores is
  'Row ownership remains defined for trusted use; direct authenticated table access is revoked because raw evidence JSON can contain private free-text.';
comment on policy "Restrict report comments to visible owned or managed reports"
  on public.admin_comments is
  'Restrictive ownership and visibility boundary for report feedback. Service-role management workflows bypass RLS.';
comment on policy "Restrict task comments to visible assigned or managed tasks"
  on public.task_comments is
  'Restrictive ownership and visibility boundary for task feedback. Team members require an existing task_assignees relationship.';
