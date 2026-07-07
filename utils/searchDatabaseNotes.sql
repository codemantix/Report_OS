-- Optional database performance improvements for production search.
-- Run in Supabase SQL editor when the dataset grows large.
create extension if not exists pg_trgm;

create index if not exists idx_reports_project_name_trgm on reports using gin (project_name gin_trgm_ops);
create index if not exists idx_reports_worked_on_trgm on reports using gin (worked_on gin_trgm_ops);
create index if not exists idx_reports_completed_tasks_trgm on reports using gin (completed_tasks gin_trgm_ops);
create index if not exists idx_reports_pending_tasks_trgm on reports using gin (pending_tasks gin_trgm_ops);
create index if not exists idx_reports_blockers_trgm on reports using gin (blockers gin_trgm_ops);
create index if not exists idx_tasks_title_trgm on tasks using gin (title gin_trgm_ops);
create index if not exists idx_tasks_description_trgm on tasks using gin (description gin_trgm_ops);
create index if not exists idx_goals_title_trgm on goals using gin (title gin_trgm_ops);
create index if not exists idx_department_plans_title_trgm on department_plans using gin (title gin_trgm_ops);
create index if not exists idx_departments_name_trgm on departments using gin (name gin_trgm_ops);
create index if not exists idx_users_full_name_trgm on users using gin (full_name gin_trgm_ops);
create index if not exists idx_users_email_trgm on users using gin (email gin_trgm_ops);
