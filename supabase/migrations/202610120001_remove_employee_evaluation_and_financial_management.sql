-- Destructive rollback for the employee evaluation, attendance, stipend,
-- payment-tracking, and management-analytics systems introduced by migrations
-- 202608110001 through 202608110015.
--
-- This permanently deletes all data held by the feature-owned tables below.
-- Shared report/task/user/email infrastructure is retained. The unrelated
-- admin_comments.author_name_snapshot change from 202608110016 is also retained.
--
-- pgcrypto and btree_gist are intentionally not dropped because they are shared
-- extensions and may be used by objects outside this feature.

begin;

-- -----------------------------------------------------------------------------
-- Remove feature policies and columns from shared application tables first.
-- These policies depend on evaluation helper functions and would otherwise be
-- removed indirectly when the helpers are dropped.
-- -----------------------------------------------------------------------------

drop policy if exists "Active users can attempt to read report comments"
  on public.admin_comments;
drop policy if exists "Restrict report comments to visible owned or managed reports"
  on public.admin_comments;

alter table if exists public.admin_comments
  drop column if exists visibility;
alter table if exists public.admin_comments disable row level security;

drop policy if exists "Active users can attempt to read task comments"
  on public.task_comments;
drop policy if exists "Assigned users and department managers can create task comments"
  on public.task_comments;
drop policy if exists "Restrict task comments to visible assigned or managed tasks"
  on public.task_comments;

alter table if exists public.task_comments
  drop column if exists visibility;
alter table if exists public.task_comments disable row level security;

-- Evaluation hardening replaced the users-table policy set and added a trigger
-- whose implementation depends on evaluation_is_admin(). Restore the pre-feature
-- no-RLS behavior rather than leaving policies with missing dependencies.
drop trigger if exists trg_guard_user_authorization_fields on public.users;
drop function if exists public.guard_user_authorization_fields();

drop policy if exists "Active users can read user profiles" on public.users;
drop policy if exists "Admins can read all profiles" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Admins can update any profile" on public.users;

alter table if exists public.users disable row level security;

-- -----------------------------------------------------------------------------
-- Keep the shared email_logs table used by report emails, but remove only the
-- evaluation-notification additions. Restrict direct client access after RLS is
-- removed; report email APIs use service_role.
-- -----------------------------------------------------------------------------

drop policy if exists "Management and recipients can read notification logs"
  on public.email_logs;

-- Remove evaluation notification history before removing the columns that
-- identify it. Report-email rows have null evaluation fields and are retained.
delete from public.email_logs
where evaluation_id is not null
   or period_id is not null
   or entity_type in ('evaluation_period', 'employee_evaluation')
   or notification_type in (
     'period_opened',
     'report_missing',
     'attendance_missing',
     'ready_for_review',
     'returned_for_review',
     'approved',
     'stipend_approved',
     'payment_recorded'
   );

drop index if exists public.email_logs_dedupe_uidx;
drop index if exists public.email_logs_entity_idx;
drop index if exists public.email_logs_evaluation_idx;
drop index if exists public.email_logs_period_idx;
-- email_logs_recipient_idx is generic and may have existed before the feature.

alter table if exists public.email_logs
  drop column if exists evaluation_id,
  drop column if exists period_id,
  drop column if exists entity_id,
  drop column if exists entity_type,
  drop column if exists notification_type;

alter table if exists public.email_logs disable row level security;
revoke all on table public.email_logs from anon, authenticated;
grant all on table public.email_logs to service_role;

-- -----------------------------------------------------------------------------
-- Drop service/query functions before their source tables. Trigger and RLS
-- helpers remain until their owning tables and policies are removed below.
-- -----------------------------------------------------------------------------

drop function if exists public.get_management_evaluation_analytics(uuid, uuid, uuid, text);
drop function if exists public.get_evaluation_dashboard_summary(uuid, uuid, uuid, text, text);
drop function if exists public.review_employee_evaluation(
  uuid, text, uuid, numeric, text, numeric, text, text, text, uuid
);
drop function if exists public.performance_band_for_evaluation_score(uuid, numeric);
drop function if exists public.create_managed_evaluation_period(
  uuid, uuid, text, date, date, timestamptz, uuid[], uuid
);
drop function if exists public.update_managed_draft_evaluation_period(
  uuid, text, date, date, timestamptz, uuid[], uuid
);
drop function if exists public.create_stipend_recommendation(
  uuid, uuid, uuid, numeric, text, uuid
);
drop function if exists public.approve_stipend_recommendation(
  uuid, uuid, numeric, text, uuid
);
drop function if exists public.create_stipend_payment_tracking(
  uuid, uuid, text, uuid
);
drop function if exists public.update_stipend_payment_tracking(
  uuid, text, uuid, date, text, text, text, uuid
);

-- -----------------------------------------------------------------------------
-- Delete all feature-owned tables and their data. No CASCADE is used: an
-- unexpected dependency aborts the transaction instead of deleting unrelated
-- objects. Internal foreign keys are handled by dropping the full set together.
-- -----------------------------------------------------------------------------

drop table if exists
  public.evaluation_review_comments,
  public.evaluation_review_rounds,
  public.stipend_base_configs,
  public.payment_records,
  public.evaluation_approvals,
  public.stipend_recommendations,
  public.evaluation_component_scores,
  public.employee_evaluations,
  public.attendance_records,
  public.evaluation_audit_history,
  public.evaluation_periods,
  public.evaluation_weight_configs;

-- -----------------------------------------------------------------------------
-- Remove feature helper and trigger functions after table-owned triggers and
-- policies have disappeared.
-- -----------------------------------------------------------------------------

drop function if exists public.classify_evaluation_audit_event(text, text, jsonb, jsonb);
drop function if exists public.evaluation_can_manage_evaluation(uuid);
drop function if exists public.evaluation_can_read_evaluation(uuid);
drop function if exists public.evaluation_can_manage_department(uuid);
drop function if exists public.evaluation_is_admin();
drop function if exists public.evaluation_is_active_user();

drop function if exists public.is_valid_performance_band_config(jsonb);
drop function if exists public.set_evaluation_updated_at();
drop function if exists public.validate_evaluation_weight_config();
drop function if exists public.validate_evaluation_period();
drop function if exists public.validate_attendance_ownership();
drop function if exists public.prepare_employee_evaluation();
drop function if exists public.set_evaluation_component_weight();
drop function if exists public.create_default_evaluation_components();
drop function if exists public.recalculate_employee_evaluation_score();
drop function if exists public.validate_employee_evaluation_status();
drop function if exists public.validate_stipend_recommendation();
drop function if exists public.validate_evaluation_approval();
drop function if exists public.sync_approved_recommendation();
drop function if exists public.validate_payment_record();
drop function if exists public.capture_evaluation_audit();
drop function if exists public.protect_evaluation_calculation_fields();
drop function if exists public.require_complete_engine_for_approval();
drop function if exists public.protect_evaluation_period_management_fields();
drop function if exists public.validate_evaluation_calculation_window();
drop function if exists public.validate_evaluation_review_comment();
drop function if exists public.validate_stipend_base_config();
drop function if exists public.capture_stipend_base_config_audit();

commit;
