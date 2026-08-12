-- Evaluation notification integration.
-- Reuses the existing Resend email pipeline and the documented email_logs table
-- (docs/Overview.md section 19). No competing notification system is created.
-- The table is created defensively if it does not exist yet, and extended with
-- evaluation-notification columns without touching existing report rows.

-- -----------------------------------------------------------------------------
-- email_logs table (documented schema + evaluation notification support)
-- -----------------------------------------------------------------------------

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  email text not null,
  subject text not null,
  status text not null,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Evaluation notification columns. Existing rows keep null values.
alter table public.email_logs
  add column if not exists notification_type text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists period_id uuid references public.evaluation_periods(id) on delete cascade,
  add column if not exists evaluation_id uuid references public.employee_evaluations(id) on delete cascade;

comment on column public.email_logs.notification_type is
  'Evaluation notification kind (period_opened, report_missing, attendance_missing, ready_for_review, returned_for_review, approved, stipend_approved, payment_recorded).';
comment on column public.email_logs.entity_type is
  'Affected domain: evaluation_period or employee_evaluation.';
comment on column public.email_logs.entity_id is
  'Primary key of the affected evaluation period or employee evaluation.';
comment on column public.email_logs.period_id is
  'Evaluation period for scoped filtering and deduplication.';
comment on column public.email_logs.evaluation_id is
  'Employee evaluation for scoped filtering and deduplication.';

-- One successful notification per (type, entity, recipient). This is the
-- database-level anti-spam guardrail; the dispatcher also checks before sending.
create unique index if not exists email_logs_dedupe_uidx
  on public.email_logs (notification_type, entity_type, entity_id, user_id)
  where status = 'sent' and notification_type is not null;

create index if not exists email_logs_recipient_idx
  on public.email_logs (user_id, created_at desc);

create index if not exists email_logs_entity_idx
  on public.email_logs (entity_type, entity_id, created_at desc)
  where entity_id is not null;

create index if not exists email_logs_evaluation_idx
  on public.email_logs (evaluation_id, created_at desc)
  where evaluation_id is not null;

create index if not exists email_logs_period_idx
  on public.email_logs (period_id, notification_type, created_at desc)
  where period_id is not null;

-- -----------------------------------------------------------------------------
-- Access: writes are service-role only (server dispatcher). Authenticated users
-- may read rows they sent/received or that belong to evaluations they manage.
-- -----------------------------------------------------------------------------

alter table public.email_logs enable row level security;

revoke all on table public.email_logs from anon;
revoke insert, update, delete on table public.email_logs from authenticated;
grant select on table public.email_logs to authenticated;
grant all on table public.email_logs to service_role;

drop policy if exists "Management and recipients can read notification logs"
  on public.email_logs;

create policy "Management and recipients can read notification logs"
  on public.email_logs as restrictive for select to authenticated
  using (
    public.evaluation_is_active_user()
    and (
      public.evaluation_is_admin()
      or user_id = auth.uid()
      or exists (
        select 1 from public.users manager
        where manager.id = auth.uid()
          and manager.role = 'department_lead'
          and exists (
            select 1 from public.employee_evaluations evaluation
            where evaluation.id = email_logs.evaluation_id
              and evaluation.department_id = manager.department_id
          )
      )
    )
  );

comment on policy "Management and recipients can read notification logs"
  on public.email_logs is
  'Restrictive read boundary: admins see all logs; employees see their own; department leads see logs for evaluations in their department.';
