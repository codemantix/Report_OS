-- Report OS employee evaluation RLS and grants
-- Existing roles remain authoritative: admin, department_lead, team_member.

-- -----------------------------------------------------------------------------
-- RLS helper functions
-- -----------------------------------------------------------------------------

create or replace function public.evaluation_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.evaluation_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.evaluation_can_manage_department(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and status = 'active'
      and (
        role = 'admin'
        or (role = 'department_lead' and department_id = target_department_id)
      )
  );
$$;

create or replace function public.evaluation_can_read_evaluation(target_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employee_evaluations evaluation
    where evaluation.id = target_evaluation_id
      and (
        evaluation.employee_id = auth.uid()
        or public.evaluation_can_manage_department(evaluation.department_id)
      )
  );
$$;

create or replace function public.evaluation_can_manage_evaluation(target_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employee_evaluations evaluation
    where evaluation.id = target_evaluation_id
      and public.evaluation_can_manage_department(evaluation.department_id)
  );
$$;

revoke all on function public.evaluation_is_active_user() from public;
revoke all on function public.evaluation_is_admin() from public;
revoke all on function public.evaluation_can_manage_department(uuid) from public;
revoke all on function public.evaluation_can_read_evaluation(uuid) from public;
revoke all on function public.evaluation_can_manage_evaluation(uuid) from public;

grant execute on function public.evaluation_is_active_user() to authenticated;
grant execute on function public.evaluation_is_admin() to authenticated;
grant execute on function public.evaluation_can_manage_department(uuid) to authenticated;
grant execute on function public.evaluation_can_read_evaluation(uuid) to authenticated;
grant execute on function public.evaluation_can_manage_evaluation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enable and force row-level ownership boundaries
-- -----------------------------------------------------------------------------

alter table public.evaluation_weight_configs enable row level security;
alter table public.evaluation_periods enable row level security;
alter table public.attendance_records enable row level security;
alter table public.employee_evaluations enable row level security;
alter table public.evaluation_component_scores enable row level security;
alter table public.stipend_recommendations enable row level security;
alter table public.evaluation_approvals enable row level security;
alter table public.payment_records enable row level security;
alter table public.evaluation_audit_history enable row level security;

-- -----------------------------------------------------------------------------
-- Grants: policies below remain the authorization boundary.
-- Service role intentionally retains full access for trusted server workflows.
-- -----------------------------------------------------------------------------

revoke all on table public.evaluation_weight_configs from anon;
revoke all on table public.evaluation_periods from anon;
revoke all on table public.attendance_records from anon;
revoke all on table public.employee_evaluations from anon;
revoke all on table public.evaluation_component_scores from anon;
revoke all on table public.stipend_recommendations from anon;
revoke all on table public.evaluation_approvals from anon;
revoke all on table public.payment_records from anon;
revoke all on table public.evaluation_audit_history from anon;

grant select, insert, update, delete on table public.evaluation_weight_configs to authenticated;
grant select, insert, update, delete on table public.evaluation_periods to authenticated;
grant select, insert, update, delete on table public.attendance_records to authenticated;
grant select, insert, update, delete on table public.employee_evaluations to authenticated;
grant select, insert, update, delete on table public.evaluation_component_scores to authenticated;
grant select, insert, update, delete on table public.stipend_recommendations to authenticated;
grant select, insert, update, delete on table public.evaluation_approvals to authenticated;
grant select, insert, update on table public.payment_records to authenticated;
grant select on table public.evaluation_audit_history to authenticated;

grant all on table public.evaluation_weight_configs to service_role;
grant all on table public.evaluation_periods to service_role;
grant all on table public.attendance_records to service_role;
grant all on table public.employee_evaluations to service_role;
grant all on table public.evaluation_component_scores to service_role;
grant all on table public.stipend_recommendations to service_role;
grant all on table public.evaluation_approvals to service_role;
grant all on table public.payment_records to service_role;
grant all on table public.evaluation_audit_history to service_role;
grant usage, select on sequence public.evaluation_audit_history_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Weight configurations
-- -----------------------------------------------------------------------------

create policy "Active users can read applicable evaluation weights"
  on public.evaluation_weight_configs
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      department_id is null
      or department_id = public.current_user_department_id()
      or public.evaluation_is_admin()
    )
  );

create policy "Admins can create evaluation weights"
  on public.evaluation_weight_configs
  for insert
  to authenticated
  with check (public.evaluation_is_admin());

create policy "Admins can update evaluation weights"
  on public.evaluation_weight_configs
  for update
  to authenticated
  using (public.evaluation_is_admin())
  with check (public.evaluation_is_admin());

create policy "Admins can delete unused draft evaluation weights"
  on public.evaluation_weight_configs
  for delete
  to authenticated
  using (
    public.evaluation_is_admin()
    and status = 'draft'
    and not exists (
      select 1
      from public.evaluation_periods period
      where period.weight_config_id = evaluation_weight_configs.id
    )
  );

-- -----------------------------------------------------------------------------
-- Evaluation periods
-- -----------------------------------------------------------------------------

create policy "Active users can read department evaluation periods"
  on public.evaluation_periods
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      department_id = public.current_user_department_id()
      or public.evaluation_is_admin()
    )
  );

create policy "Admins and leads can create department evaluation periods"
  on public.evaluation_periods
  for insert
  to authenticated
  with check (public.evaluation_can_manage_department(department_id));

create policy "Admins and leads can update department evaluation periods"
  on public.evaluation_periods
  for update
  to authenticated
  using (public.evaluation_can_manage_department(department_id))
  with check (public.evaluation_can_manage_department(department_id));

create policy "Admins can delete draft evaluation periods"
  on public.evaluation_periods
  for delete
  to authenticated
  using (public.evaluation_is_admin() and status = 'draft');

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------

create policy "Employees and department managers can read attendance"
  on public.attendance_records
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      employee_id = auth.uid()
      or public.evaluation_can_manage_department(department_id)
    )
  );

create policy "Employees and department managers can record attendance"
  on public.attendance_records
  for insert
  to authenticated
  with check (
    public.evaluation_is_active_user()
    and (
      (
        employee_id = auth.uid()
        and department_id = public.current_user_department_id()
        and recorded_by = auth.uid()
        and review_status = 'pending'
        and approved_by is null
        and approved_at is null
      )
      or public.evaluation_can_manage_department(department_id)
    )
  );

create policy "Employees can correct pending attendance"
  on public.attendance_records
  for update
  to authenticated
  using (
    public.evaluation_is_active_user()
    and employee_id = auth.uid()
    and review_status = 'pending'
  )
  with check (
    employee_id = auth.uid()
    and department_id = public.current_user_department_id()
    and review_status = 'pending'
    and approved_by is null
    and approved_at is null
  );

create policy "Department managers can review attendance"
  on public.attendance_records
  for update
  to authenticated
  using (public.evaluation_can_manage_department(department_id))
  with check (public.evaluation_can_manage_department(department_id));

create policy "Admins can delete attendance"
  on public.attendance_records
  for delete
  to authenticated
  using (public.evaluation_is_admin());

-- -----------------------------------------------------------------------------
-- Employee evaluations
-- -----------------------------------------------------------------------------

create policy "Employees and department managers can read evaluations"
  on public.employee_evaluations
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      employee_id = auth.uid()
      or public.evaluation_can_manage_department(department_id)
    )
  );

create policy "Department managers can create evaluations"
  on public.employee_evaluations
  for insert
  to authenticated
  with check (
    public.evaluation_can_manage_department(department_id)
    and created_by = auth.uid()
  );

create policy "Department managers can update evaluations"
  on public.employee_evaluations
  for update
  to authenticated
  using (public.evaluation_can_manage_department(department_id))
  with check (public.evaluation_can_manage_department(department_id));

create policy "Admins can delete draft evaluations"
  on public.employee_evaluations
  for delete
  to authenticated
  using (public.evaluation_is_admin() and status = 'draft');

-- -----------------------------------------------------------------------------
-- Component scores
-- -----------------------------------------------------------------------------

create policy "Evaluation participants can read component scores"
  on public.evaluation_component_scores
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and public.evaluation_can_read_evaluation(evaluation_id)
  );

create policy "Department managers can create component scores"
  on public.evaluation_component_scores
  for insert
  to authenticated
  with check (public.evaluation_can_manage_evaluation(evaluation_id));

create policy "Department managers can update component scores"
  on public.evaluation_component_scores
  for update
  to authenticated
  using (public.evaluation_can_manage_evaluation(evaluation_id))
  with check (public.evaluation_can_manage_evaluation(evaluation_id));

create policy "Admins can delete draft component scores"
  on public.evaluation_component_scores
  for delete
  to authenticated
  using (
    public.evaluation_is_admin()
    and exists (
      select 1
      from public.employee_evaluations evaluation
      where evaluation.id = evaluation_component_scores.evaluation_id
        and evaluation.status = 'draft'
    )
  );

-- -----------------------------------------------------------------------------
-- Stipend recommendations
-- -----------------------------------------------------------------------------

create policy "Employees can read issued stipend recommendations"
  on public.stipend_recommendations
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      public.evaluation_can_manage_evaluation(evaluation_id)
      or exists (
        select 1
        from public.employee_evaluations evaluation
        where evaluation.id = stipend_recommendations.evaluation_id
          and evaluation.employee_id = auth.uid()
          and stipend_recommendations.status in ('recommended', 'approved', 'rejected', 'superseded')
      )
    )
  );

create policy "Department managers can create stipend recommendations"
  on public.stipend_recommendations
  for insert
  to authenticated
  with check (
    public.evaluation_can_manage_evaluation(evaluation_id)
    and created_by = auth.uid()
  );

create policy "Department managers can update stipend recommendations"
  on public.stipend_recommendations
  for update
  to authenticated
  using (public.evaluation_can_manage_evaluation(evaluation_id))
  with check (public.evaluation_can_manage_evaluation(evaluation_id));

create policy "Admins can delete draft stipend recommendations"
  on public.stipend_recommendations
  for delete
  to authenticated
  using (public.evaluation_is_admin() and status = 'draft');

-- -----------------------------------------------------------------------------
-- Human approvals
-- -----------------------------------------------------------------------------

create policy "Evaluation participants can read approvals"
  on public.evaluation_approvals
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and public.evaluation_can_read_evaluation(evaluation_id)
  );

create policy "Department managers can create approval stages"
  on public.evaluation_approvals
  for insert
  to authenticated
  with check (
    public.evaluation_can_manage_evaluation(evaluation_id)
    and created_by = auth.uid()
  );

create policy "Assigned approvers and admins can decide approvals"
  on public.evaluation_approvals
  for update
  to authenticated
  using (
    status = 'pending'
    and (
      assigned_approver_id = auth.uid()
      or public.evaluation_is_admin()
    )
  )
  with check (
    decided_by = auth.uid()
    or public.evaluation_is_admin()
  );

-- Approval rows are append-oriented and have no delete policy.

-- -----------------------------------------------------------------------------
-- Payment records
-- -----------------------------------------------------------------------------

create policy "Employees can read own payments"
  on public.payment_records
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      employee_id = auth.uid()
      or public.evaluation_is_admin()
    )
  );

create policy "Admins can create payments"
  on public.payment_records
  for insert
  to authenticated
  with check (
    public.evaluation_is_admin()
    and created_by = auth.uid()
  );

create policy "Admins can process payments"
  on public.payment_records
  for update
  to authenticated
  using (public.evaluation_is_admin())
  with check (public.evaluation_is_admin());

-- Payment records intentionally have no delete policy.

-- -----------------------------------------------------------------------------
-- Append-only audit history
-- -----------------------------------------------------------------------------

create policy "Evaluation participants can read audit history"
  on public.evaluation_audit_history
  for select
  to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      employee_id = auth.uid()
      or public.evaluation_can_manage_department(department_id)
      or public.evaluation_is_admin()
    )
  );

-- Audit history intentionally has no insert, update, or delete policy.
-- Writes are performed only by the security-definer audit trigger.
