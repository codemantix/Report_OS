-- Evaluation security hardening.
-- Implements the fixes identified by the earlier security audit (fixes #1, #2,
-- #8, #9). Fix #3 (audit-history SELECT policy) was applied in migration 0013;
-- fix #4 (stipend_base_configs RLS) was applied in migration 0009.
--
-- Principle: table-level grants must match the policies that enforce them.
-- Migration 0002 granted broad DML; later migrations dropped the policies but
-- never revoked the grants, leaving misleading grants and, in one case, a live
-- INSERT policy that allowed fabricated component scores.

-- -----------------------------------------------------------------------------
-- Fix #2: evaluation_component_scores — score-injection vector
-- -----------------------------------------------------------------------------
-- The INSERT policy from 0002 is still live and component scores feed the
-- recalculation trigger that writes employee_evaluations.overall_score. All
-- legitimate writes flow through the trusted server evaluation engine, so
-- authenticated DML must be removed entirely. SELECT was already revoked in
-- 0011 (raw evidence JSON may contain private free-text); restore it behind an
-- explicit restrictive policy so the earlier SELECT policy is not dead code.

drop policy if exists "Department managers can create component scores"
  on public.evaluation_component_scores;

revoke insert, update, delete on table public.evaluation_component_scores from authenticated;

grant select on table public.evaluation_component_scores to authenticated;

drop policy if exists "Evaluation participants can read component scores"
  on public.evaluation_component_scores;

create policy "Participants can read sanitized component score rows"
  on public.evaluation_component_scores as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and public.evaluation_can_read_evaluation(evaluation_id)
  );

comment on policy "Participants can read sanitized component score rows"
  on public.evaluation_component_scores is
  'Restores the documented participant read boundary after 0011 revoked SELECT. Writes remain server-engine only; evidence_metrics JSON may still be filtered by the API for employee-facing views.';

-- -----------------------------------------------------------------------------
-- Fix #1: evaluation_approvals — stale DML grants
-- -----------------------------------------------------------------------------
-- 0008 dropped the create/update policies and 0011 revoked SELECT. Writes are
-- performed exclusively by the service-role review_employee_evaluation RPC, so
-- authenticated DML grants are revoked and SELECT restored via a restrictive
-- participant policy (approval decision notes remain management-readable).

revoke insert, update, delete on table public.evaluation_approvals from authenticated;

grant select on table public.evaluation_approvals to authenticated;

drop policy if exists "Evaluation participants can read approvals"
  on public.evaluation_approvals;

create policy "Participants can read accessible approvals"
  on public.evaluation_approvals as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and public.evaluation_can_read_evaluation(evaluation_id)
  );

comment on policy "Participants can read accessible approvals"
  on public.evaluation_approvals is
  'Restores the documented participant read boundary. Approval decisions are created and updated only by the service-role human review RPC.';

-- -----------------------------------------------------------------------------
-- Fix #8: payment_records — stale DML grants
-- -----------------------------------------------------------------------------
-- 0010 dropped the admin create/process policies; creation and status changes
-- are service-role RPCs only. SELECT remains restricted to the employee-visible
-- columns granted in 0011 and enforced by the 0010 ownership policy.

revoke insert, update, delete on table public.payment_records from authenticated;

-- -----------------------------------------------------------------------------
-- Stale DML grants on stipend_recommendations and employee_evaluations
-- -----------------------------------------------------------------------------
-- 0008 dropped the employee_evaluations UPDATE policy and 0009 dropped the
-- stipend_recommendations write policies, but the table-level DML grants from
-- 0002 remain. No client or server flow writes these tables directly: periods
-- create evaluations via the service-role RPC, stipends go through the
-- service-role RPCs, and the calculation engine writes via service role. The
-- grants are revoked so table-level privileges match the enforced policies.

revoke insert, update, delete on table public.stipend_recommendations from authenticated;
revoke insert, update, delete on table public.employee_evaluations from authenticated;

-- The INSERT policy on employee_evaluations is no longer exercised by any
-- client flow (period creation goes through the service-role RPC). Drop it so
-- the only remaining authenticated access is the 0011 column-restricted SELECT.
drop policy if exists "Department managers can create evaluations"
  on public.employee_evaluations;

-- -----------------------------------------------------------------------------
-- Fix #9: users table RLS
-- -----------------------------------------------------------------------------
-- users carries role, status, and department_id — the authorization data used
-- by every evaluation SECURITY DEFINER helper — yet had no RLS, so any
-- authenticated session could enumerate profiles and roles. Enable RLS with the
-- read boundary documented in docs/002_team_profiles_rls.sql:
--   - active users can read active profiles;
--   - administrators can read all profiles (required to manage inactive users);
--   - profile edits keep working through the existing admin/self UPDATE paths
--     (role/department/status/email remain admin-only via a guard trigger).
-- DML is otherwise service-role only.

alter table public.users enable row level security;

revoke all on table public.users from anon;
revoke insert, delete on table public.users from authenticated;
grant select on table public.users to authenticated;

drop policy if exists "Active users can read user profiles" on public.users;
drop policy if exists "Admins can read all profiles" on public.users;
-- Defensive drops for policy names documented in docs/002_team_profiles_rls.sql
-- in case that design was ever applied manually to the database.
drop policy if exists "Authenticated users can read all profiles" on public.users;
drop policy if exists "Admins can update any profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;

create policy "Active users can read user profiles"
  on public.users as permissive for select to authenticated
  using (public.evaluation_is_active_user() and status = 'active');

create policy "Admins can read all profiles"
  on public.users as permissive for select to authenticated
  using (public.evaluation_is_admin());

create policy "Users can update own profile"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.users for update to authenticated
  using (public.evaluation_is_admin())
  with check (public.evaluation_is_admin());

create or replace function public.guard_user_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  -- Only administrators may change role, department, status, or email.
  if not public.evaluation_is_admin() and (
    new.role is distinct from old.role
    or new.department_id is distinct from old.department_id
    or new.status is distinct from old.status
    or new.email is distinct from old.email
  ) then
    raise exception 'Only administrators can modify role, department, status, or email.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_user_authorization_fields on public.users;
create trigger trg_guard_user_authorization_fields
  before update on public.users
  for each row execute function public.guard_user_authorization_fields();

comment on policy "Active users can read user profiles" on public.users is
  'Authenticated active users can read active profiles; inactive accounts cannot enumerate the directory.';
comment on policy "Admins can read all profiles" on public.users is
  'Administrators retain full profile visibility to manage suspended or inactive accounts.';
comment on policy "Users can update own profile" on public.users is
  'Self-service profile edits continue through the existing profile flow; sensitive fields are guarded by the authorization trigger.';
comment on policy "Admins can update any profile" on public.users is
  'Administrative role, department, and status changes continue through existing admin actions.';
