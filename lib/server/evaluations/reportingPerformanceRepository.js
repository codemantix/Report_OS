import { fetchEvaluationContext } from './taskPerformanceRepository';

const REPORTING_SELECT = `
  id,
  user_id,
  department_id,
  goal_id,
  plan_id,
  task_id,
  company_goal_id,
  project_name,
  report_type,
  worked_on,
  completed_tasks,
  pending_tasks,
  blockers,
  support_needed,
  hours_worked,
  completion_percentage,
  additional_notes,
  attachments,
  ai_status,
  reviewed,
  reviewed_by,
  reviewed_at,
  submitted_at,
  created_at,
  task:task_id (
    id,
    title,
    expected_output,
    status,
    due_date,
    completed_at
  ),
  plan:plan_id (
    id,
    title,
    plan_type,
    start_date,
    end_date
  ),
  goal:goal_id (
    id,
    title,
    success_metric,
    expected_deliverables
  ),
  company_goal:company_goal_id (
    id,
    title,
    success_metric,
    expected_outcomes
  ),
  analysis:report_ai_analysis (
    id,
    task_alignment_score,
    task_progress_score,
    goal_alignment_score,
    company_goal_alignment_score,
    expected_outcome_progress_score,
    progress_score,
    report_quality_score,
    success_rate,
    risk_level,
    status,
    ai_comment,
    task_feedback,
    created_at
  ),
  manager_feedback:admin_comments (
    id,
    comment,
    visibility,
    created_at,
    author:admin_id (id, full_name, display_name, email, role)
  )
`;


export { fetchEvaluationContext };

export async function fetchExistingReportingScore(supabaseAdmin, evaluationId) {
  const result = await supabaseAdmin
    .from('evaluation_component_scores')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('component', 'reporting_performance')
    .maybeSingle();

  if (result.error) {
    const error = new Error('Reporting Performance score could not be loaded.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

export async function fetchReportingPerformanceSources(supabaseAdmin, evaluation) {
  const queryEndDate = evaluation.period.end_date;
  const result = await supabaseAdmin
    .from('reports')
    .select(REPORTING_SELECT)
    .eq('user_id', evaluation.employee_id)
    .eq('department_id', evaluation.department_id)
    .gte('submitted_at', `${evaluation.period.start_date}T00:00:00.000Z`)
    .lte('submitted_at', `${queryEndDate}T23:59:59.999Z`)
    .order('submitted_at', { ascending: true });

  if (result.error) {
    const error = new Error('Existing reports and analyses could not be loaded.');
    error.cause = result.error;
    throw error;
  }

  return {
    reports: (result.data || []).map((report) => ({
      ...report,
      manager_feedback: (report.manager_feedback || []).filter((feedback) => (
        feedback.visibility === 'employee_visible'
      )),
    })),
    timingBasis: 'submitted_at within the strict evaluation period window',
    queryEndDate,
  };
}

export async function saveReportingPerformanceScore(supabaseAdmin, {
  evaluationId,
  score,
  evidenceMetrics,
  calculatedBy,
  calculatedAt,
}) {
  const result = await supabaseAdmin
    .from('evaluation_component_scores')
    .update({
      raw_score: score,
      calculation_method: 'deterministic_existing_report_evaluation',
      calculation_version: evidenceMetrics.formulaVersion,
      evidence_metrics: evidenceMetrics,
      source_cutoff_at: calculatedAt,
      calculated_by: calculatedBy,
      calculated_at: calculatedAt,
    })
    .eq('evaluation_id', evaluationId)
    .eq('component', 'reporting_performance')
    .select('*')
    .single();

  if (result.error || !result.data) {
    const error = new Error('Reporting Performance score could not be saved.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}
