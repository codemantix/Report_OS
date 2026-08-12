-- Attendance management extension
-- Preserves existing attendance data and keeps evaluations linked to the same employee/department ownership model.

alter table public.attendance_records
  add column meeting_session text,
  add column attendance_type text not null default 'meeting',
  add column recorded_at timestamptz not null default now(),
  add column evaluation_period_id uuid references public.evaluation_periods(id) on delete restrict;

update public.attendance_records
set meeting_session = 'General attendance'
where meeting_session is null or btrim(meeting_session) = '';

update public.attendance_records
set recorded_at = coalesce(created_at, recorded_at);

alter table public.attendance_records
  alter column meeting_session set not null,
  add constraint attendance_records_meeting_session_length_check
    check (char_length(btrim(meeting_session)) between 1 and 150),
  add constraint attendance_records_type_check
    check (attendance_type in ('meeting', 'work_session', 'training', 'company_event', 'other')),
  add constraint attendance_records_notes_length_check
    check (notes is null or char_length(notes) <= 2000);

alter table public.attendance_records
  drop constraint if exists attendance_records_unique_employee_date;

create unique index attendance_records_employee_session_uidx
  on public.attendance_records (
    employee_id,
    attendance_date,
    lower(btrim(meeting_session)),
    attendance_type
  );

create index attendance_records_evaluation_period_idx
  on public.attendance_records (evaluation_period_id, employee_id)
  where evaluation_period_id is not null;

create index attendance_records_type_date_idx
  on public.attendance_records (attendance_type, attendance_date desc);

create or replace function public.validate_attendance_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_department_id uuid;
  period_department_id uuid;
  period_start_date date;
  period_end_date date;
begin
  select department_id
  into employee_department_id
  from public.users
  where id = new.employee_id;

  if employee_department_id is null then
    raise exception 'Attendance employee must belong to a department.';
  end if;

  new.meeting_session := btrim(new.meeting_session);

  if tg_op = 'INSERT' then
    if new.department_id <> employee_department_id then
      raise exception 'Attendance department must match the employee department.';
    end if;

    new.recorded_at := coalesce(new.recorded_at, now());

    if auth.uid() is not null then
      new.recorded_by := auth.uid();
      new.approved_by := auth.uid();
      new.approved_at := now();
      new.review_status := 'confirmed';
    end if;
  elsif new.employee_id is distinct from old.employee_id
    or new.department_id is distinct from old.department_id
    or new.attendance_date is distinct from old.attendance_date
    or new.recorded_by is distinct from old.recorded_by
    or new.recorded_at is distinct from old.recorded_at then
    raise exception 'Attendance employee, department, date, recorder, and recorded timestamp are immutable.';
  end if;

  if new.evaluation_period_id is not null then
    select department_id, start_date, end_date
    into period_department_id, period_start_date, period_end_date
    from public.evaluation_periods
    where id = new.evaluation_period_id;

    if not found then
      raise exception 'Associated evaluation period does not exist.';
    end if;

    if period_department_id <> new.department_id then
      raise exception 'Attendance evaluation period must belong to the same department.';
    end if;

    if new.attendance_date < period_start_date or new.attendance_date > period_end_date then
      raise exception 'Attendance date must fall within the associated evaluation period.';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "Employees and department managers can record attendance"
  on public.attendance_records;

drop policy if exists "Employees can correct pending attendance"
  on public.attendance_records;

create policy "Department managers can record official attendance"
  on public.attendance_records
  for insert
  to authenticated
  with check (
    public.evaluation_can_manage_department(department_id)
    and recorded_by = auth.uid()
    and review_status = 'confirmed'
    and approved_by = auth.uid()
    and approved_at is not null
  );

comment on column public.attendance_records.meeting_session is
  'Human-readable meeting, work session, training, or event name.';

comment on column public.attendance_records.attendance_type is
  'Session category used when calculating and filtering attendance.';

comment on column public.attendance_records.recorded_at is
  'Immutable timestamp when an authorized manager created the official record.';

comment on column public.attendance_records.evaluation_period_id is
  'Optional direct association to the department evaluation period containing the attendance date.';
