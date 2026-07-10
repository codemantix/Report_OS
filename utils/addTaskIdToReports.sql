-- Adds a direct task_id foreign key to the reports table, consistent
-- with how goal_id and plan_id are already stored.
--
-- Run this once in the Supabase SQL editor.

alter table reports add column if not exists task_id uuid references tasks(id) on delete set null;
create index if not exists idx_reports_task_id on reports(task_id);
