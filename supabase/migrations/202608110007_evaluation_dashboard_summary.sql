-- Real-data aggregate summary for the paginated evaluation dashboard.
-- Server-only: caller scope is resolved by authenticated API authorization.

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
      and (
        p_approval_status is null
        or (
          p_approval_status = 'not_started'
          and not exists (
            select 1 from public.evaluation_approvals approval
            where approval.evaluation_id = evaluation.id and approval.status <> 'cancelled'
          )
        )
        or exists (
          select 1 from public.evaluation_approvals approval
          where approval.evaluation_id = evaluation.id and approval.status = p_approval_status
        )
      )
  ), component_pivot as (
    select
      score.evaluation_id,
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
    'approvedCount', count(*) filter (where exists (
      select 1 from public.evaluation_approvals approval
      where approval.evaluation_id = filtered.id and approval.status = 'approved'
    )),
    'pendingApprovalCount', count(*) filter (where exists (
      select 1 from public.evaluation_approvals approval
      where approval.evaluation_id = filtered.id and approval.status = 'pending'
    ))
  )
  from filtered
  left join component_pivot on component_pivot.evaluation_id = filtered.id;
$$;

revoke all on function public.get_evaluation_dashboard_summary(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.get_evaluation_dashboard_summary(uuid, uuid, uuid, text, text)
  to service_role;

create index if not exists employee_evaluations_dashboard_filter_idx
  on public.employee_evaluations (
    department_id,
    evaluation_period_id,
    performance_band,
    status,
    employee_id
  );
