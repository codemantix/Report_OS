const OWN_EVALUATION_SELECT = `
  id, employee_id, department_id, evaluation_period_id, weight_config_id,
  status, calculation_status, overall_score, performance_band,
  calculated_stipend_percentage, stipend_recommendation_mode,
  calculated_at, created_at, updated_at,
  approved_score, approved_performance_band, approved_stipend_percentage,
  approved_stipend_mode, approved_at, current_approval_status,
  employee_name_snapshot, department_name_snapshot,
  period:evaluation_period_id (
    id, name, start_date, end_date, evaluation_deadline, status, department_id
  ),
  component_scores:evaluation_component_scores (
    id, component, raw_score, weight, weighted_score,
    calculation_method, calculation_version, evidence_metrics,
    source_cutoff_at, calculated_at
  ),
  review_comments:evaluation_review_comments (
    id, visibility, body, created_at,
    author:author_user_id (id, full_name, display_name)
  ),
  stipend_recommendations:stipend_recommendations!stipend_recommendations_evaluation_id_fkey (
    id, version, status, recommendation_mode, recommended_percentage,
    base_stipend_amount, formula_recommended_amount, recommended_amount,
    final_approved_amount, currency, recommended_at, approved_at,
    payment_records (
      id, status, amount, currency, payment_date, created_at, updated_at
    )
  )
`;

function repositoryError(message, result, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = result?.error;
  throw error;
}

export async function fetchOwnEvaluations(supabaseAdmin, employeeId) {
  const result = await supabaseAdmin.from('employee_evaluations')
    .select(OWN_EVALUATION_SELECT)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (result.error) repositoryError('Your evaluation history could not be loaded.', result);
  return result.data || [];
}

export async function fetchOwnEvaluation(supabaseAdmin, employeeId, evaluationId) {
  const result = await supabaseAdmin.from('employee_evaluations')
    .select(OWN_EVALUATION_SELECT)
    .eq('id', evaluationId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (result.error) repositoryError('Your selected evaluation could not be loaded.', result);
  if (!result.data) repositoryError('The requested evaluation was not found.', result, 404);
  return result.data;
}

export async function fetchCurrentDepartmentPeriod(supabaseAdmin, departmentId) {
  if (!departmentId) return null;
  const result = await supabaseAdmin.from('evaluation_periods')
    .select('id, name, start_date, end_date, evaluation_deadline, status, department_id')
    .eq('department_id', departmentId)
    .in('status', ['active', 'under_review'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) repositoryError('The current evaluation period could not be loaded.', result);
  return result.data || null;
}
