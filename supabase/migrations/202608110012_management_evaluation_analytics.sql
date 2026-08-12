-- Management analytics derived only from canonical evaluation, component,
-- stipend, payment, department, and evaluation-period records.

create or replace function public.get_management_evaluation_analytics(
  p_department_id uuid default null,
  p_period_id uuid default null,
  p_employee_id uuid default null,
  p_performance_band text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with evaluation_base as (
    select
      evaluation.*,
      coalesce(evaluation.approved_score, evaluation.overall_score) as effective_score,
      coalesce(evaluation.approved_performance_band, evaluation.performance_band) as effective_band
    from public.employee_evaluations evaluation
    where evaluation.status <> 'cancelled'
      and (p_department_id is null or evaluation.department_id = p_department_id)
      and (p_period_id is null or evaluation.evaluation_period_id = p_period_id)
      and (p_employee_id is null or evaluation.employee_id = p_employee_id)
  ), filtered as (
    select *
    from evaluation_base
    where p_performance_band is null or effective_band = p_performance_band
  ), component_pivot as (
    select
      score.evaluation_id,
      max(score.raw_score) filter (where score.component = 'task_performance') as task_score,
      max(score.raw_score) filter (where score.component = 'reporting_performance') as reporting_score,
      max(score.raw_score) filter (where score.component = 'attendance') as attendance_score
    from public.evaluation_component_scores score
    join filtered evaluation on evaluation.id = score.evaluation_id
    group by score.evaluation_id
  ), analytics_rows as (
    select
      evaluation.*,
      component.task_score,
      component.reporting_score,
      component.attendance_score
    from filtered evaluation
    left join component_pivot component on component.evaluation_id = evaluation.id
  ), performance_rows as (
    select *
    from analytics_rows
    where calculation_status = 'complete'
      and status in ('approved', 'finalized')
      and current_approval_status = 'approved'
      and effective_score is not null
  ), band_option_rows as (
    select distinct effective_band as band
    from evaluation_base
    where calculation_status = 'complete'
      and status in ('approved', 'finalized')
      and current_approval_status = 'approved'
      and effective_score is not null
      and effective_band is not null
  ), department_rows as (
    select
      department.id,
      department.name,
      count(performance.id) as evaluation_count,
      count(performance.effective_score) as overall_sample_size,
      count(performance.task_score) as task_sample_size,
      count(performance.reporting_score) as reporting_sample_size,
      count(performance.attendance_score) as attendance_sample_size,
      round(avg(performance.effective_score), 2) as average_overall_score,
      round(avg(performance.task_score), 2) as average_task_score,
      round(avg(performance.reporting_score), 2) as average_reporting_score,
      round(avg(performance.attendance_score), 2) as average_attendance_score
    from performance_rows performance
    join public.departments department on department.id = performance.department_id
    group by department.id, department.name
  ), band_rows as (
    select
      effective_band as band,
      count(*) as evaluation_count
    from performance_rows
    where effective_band is not null
    group by effective_band
  ), trend_rows as (
    select
      period.id,
      period.name,
      period.start_date,
      period.end_date,
      count(performance.id) as evaluation_count,
      round(avg(performance.effective_score), 2) as average_overall_score,
      round(avg(performance.task_score), 2) as average_task_score,
      round(avg(performance.reporting_score), 2) as average_reporting_score,
      round(avg(performance.attendance_score), 2) as average_attendance_score
    from performance_rows performance
    join public.evaluation_periods period on period.id = performance.evaluation_period_id
    group by period.id, period.name, period.start_date, period.end_date
    order by period.start_date desc
    limit 12
  ), latest_stipends as (
    select distinct on (recommendation.evaluation_id)
      recommendation.evaluation_id,
      recommendation.status,
      recommendation.recommendation_mode,
      recommendation.recommended_percentage
    from public.stipend_recommendations recommendation
    join filtered evaluation on evaluation.id = recommendation.evaluation_id
    where recommendation.status not in ('cancelled', 'superseded')
    order by recommendation.evaluation_id, recommendation.version desc, recommendation.id
  ), current_payments as (
    select distinct on (payment.evaluation_id)
      payment.evaluation_id,
      payment.status
    from public.payment_records payment
    join filtered evaluation
      on evaluation.id = payment.evaluation_id
      and evaluation.approved_stipend_recommendation_id = payment.stipend_recommendation_id
    order by payment.evaluation_id, payment.updated_at desc, payment.created_at desc, payment.id
  )
  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'totalEvaluations', count(*),
        'scoredEvaluations', (select count(*) from performance_rows),
        'averageOverallScore', (select round(avg(effective_score), 2) from performance_rows),
        'averageTaskScore', (select round(avg(task_score), 2) from performance_rows),
        'averageReportingScore', (select round(avg(reporting_score), 2) from performance_rows),
        'averageAttendanceScore', (select round(avg(attendance_score), 2) from performance_rows),
        'overallSampleSize', (select count(effective_score) from performance_rows),
        'taskSampleSize', (select count(task_score) from performance_rows),
        'reportingSampleSize', (select count(reporting_score) from performance_rows),
        'attendanceSampleSize', (select count(attendance_score) from performance_rows),
        'pendingEvaluations', count(*) filter (
          where status in ('draft', 'scoring')
            or (status = 'pending_approval' and calculation_status <> 'complete')
        ),
        'pendingApprovals', count(*) filter (
          where status <> 'rejected'
            and (status = 'pending_approval' or current_approval_status = 'pending')
        )
      )
      from analytics_rows
    ),
    'departmentComparison', coalesce((
      select jsonb_agg(jsonb_build_object(
        'departmentId', id,
        'departmentName', name,
        'evaluationCount', evaluation_count,
        'overallSampleSize', overall_sample_size,
        'taskSampleSize', task_sample_size,
        'reportingSampleSize', reporting_sample_size,
        'attendanceSampleSize', attendance_sample_size,
        'averageOverallScore', average_overall_score,
        'averageTaskScore', average_task_score,
        'averageReportingScore', average_reporting_score,
        'averageAttendanceScore', average_attendance_score
      ) order by average_overall_score desc nulls last, name)
      from department_rows
    ), '[]'::jsonb),
    'performanceBandOptions', coalesce((
      select jsonb_agg(band order by band)
      from band_option_rows
    ), '[]'::jsonb),
    'performanceBands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'band', band,
        'count', evaluation_count
      ) order by case band
        when 'Excellent' then 1
        when 'Very Good' then 2
        when 'Good' then 3
        when 'Needs Improvement' then 4
        when 'Review Required' then 5
        else 6
      end, band)
      from band_rows
    ), '[]'::jsonb),
    'trends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'periodId', id,
        'periodName', name,
        'startDate', start_date,
        'endDate', end_date,
        'evaluationCount', evaluation_count,
        'averageOverallScore', average_overall_score,
        'averageTaskScore', average_task_score,
        'averageReportingScore', average_reporting_score,
        'averageAttendanceScore', average_attendance_score
      ) order by start_date)
      from trend_rows
    ), '[]'::jsonb),
    'stipends', (
      select jsonb_build_object(
        'totalCurrentRecords', count(*),
        'draft', count(*) filter (where status = 'draft'),
        'issued', count(*) filter (where status in ('recommended', 'approved', 'rejected')),
        'recommended', count(*) filter (where status = 'recommended'),
        'approved', count(*) filter (where status = 'approved'),
        'rejected', count(*) filter (where status = 'rejected'),
        'manualModeRecommendations', count(*) filter (
          where recommendation_mode = 'manual' and status in ('recommended', 'approved', 'rejected')
        ),
        'awaitingRecommendation', (
          select count(*)
          from filtered evaluation
          where evaluation.current_approval_status = 'approved'
            and not exists (
              select 1 from latest_stipends stipend
              where stipend.evaluation_id = evaluation.id
                and stipend.status in ('recommended', 'approved')
            )
        )
      )
      from latest_stipends
    ),
    'payments', (
      select jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (where status = 'pending'),
        'approved', count(*) filter (where status = 'approved'),
        'paid', count(*) filter (where status = 'paid'),
        'held', count(*) filter (where status = 'held')
      )
      from current_payments
    ),
    'trace', jsonb_build_object(
      'performanceCohort', 'human-approved or finalized evaluations only',
      'overallScoreBasis', 'approved score when present, otherwise stored calculated score',
      'componentScoreBasis', 'original calculated evaluation component scores',
      'stipendBasis', 'latest non-cancelled, non-superseded recommendation per evaluation',
      'paymentBasis', 'payment tied to the evaluation approved stipend recommendation'
    )
  );
$$;

revoke all on function public.get_management_evaluation_analytics(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_management_evaluation_analytics(uuid, uuid, uuid, text)
  to service_role;

create index if not exists stipend_recommendations_analytics_idx
  on public.stipend_recommendations (evaluation_id, version desc, status);

comment on function public.get_management_evaluation_analytics(uuid, uuid, uuid, text) is
  'Returns management-scoped analytics derived from stored evaluation, component, stipend, and payment records. No synthetic values are generated.';
