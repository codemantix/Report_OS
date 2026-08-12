const LIST_SELECT = `
  id,
  employee_id,
  department_id,
  evaluation_period_id,
  status,
  calculation_status,
  overall_score,
  performance_band,
  calculated_stipend_percentage,
  stipend_recommendation_mode,
  current_approval_status,
  approved_score,
  approved_performance_band,
  approved_stipend_percentage,
  approved_stipend_mode,
  calculated_at,
  employee_name_snapshot,
  department_name_snapshot,
  employee:employee_id (id, full_name, display_name, email, avatar_url, job_title),
  department:department_id (id, name),
  period:evaluation_period_id (id, name, start_date, end_date, status, evaluation_deadline),
  component_scores:evaluation_component_scores (
    id, component, raw_score, weight, weighted_score, calculation_version, calculated_at
  ),
  approvals:evaluation_approvals!evaluation_approvals_evaluation_id_fkey (
    id, review_round_id, stipend_recommendation_id, status, approval_stage, sequence_number, assigned_approver_id
  ),
  review_rounds:evaluation_review_rounds!evaluation_review_rounds_evaluation_id_fkey (
    id, round_number, status
  )
`;

const DETAIL_SELECT = `
  *,
  employee:employee_id (id, full_name, display_name, email, avatar_url, job_title, status, role),
  department:department_id (id, name),
  period:evaluation_period_id (id, name, start_date, end_date, status, evaluation_deadline),
  weight_config:weight_config_id (id, name, version, task_performance_weight, reporting_performance_weight, attendance_weight, performance_band_config),
  component_scores:evaluation_component_scores (*),
  approvals:evaluation_approvals!evaluation_approvals_evaluation_id_fkey (
    id, review_round_id, stipend_recommendation_id, approval_stage, sequence_number, status, assigned_approver_id, decided_by,
    decision_note, approved_amount, currency, decided_at, created_at,
    original_calculated_score, original_performance_band, original_stipend_percentage,
    input_score, input_performance_band, input_stipend_percentage, input_stipend_mode,
    approved_final_score, approved_final_band, approved_final_stipend_percentage,
    approved_final_stipend_mode, score_adjustment, adjustment_reason, calculation_snapshot,
    assigned_approver:assigned_approver_id (id, full_name, display_name, email),
    decision_maker:decided_by (id, full_name, display_name, email)
  ),
  review_rounds:evaluation_review_rounds!evaluation_review_rounds_evaluation_id_fkey (
    id, round_number, status, calculation_revision, calculation_run_id,
    calculated_score, calculated_performance_band, calculated_stipend_percentage,
    calculated_stipend_mode, proposed_score, proposed_performance_band,
    proposed_stipend_percentage, proposed_stipend_mode, proposed_adjustment_reason,
    submitted_at, closed_at, close_reason
  ),
  review_comments:evaluation_review_comments (
    id, review_round_id, approval_id, visibility, body, created_at,
    author:author_user_id (id, full_name, display_name, email)
  ),
  stipend_recommendations:stipend_recommendations!stipend_recommendations_evaluation_id_fkey (
    id, review_round_id, version, status, recommendation_source, recommendation_mode,
    recommended_amount, recommended_percentage, currency, rationale, policy_snapshot, created_at, recommended_at,
    authorized_by_approval_id
  )
`;

function fail(message, result, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = result.error;
  throw error;
}

function applyFilters(query, filters) {
  let next = query;
  if (filters.periodId) next = next.eq('evaluation_period_id', filters.periodId);
  if (filters.departmentId) next = next.eq('department_id', filters.departmentId);
  if (filters.employeeId) next = next.eq('employee_id', filters.employeeId);
  if (filters.performanceBand) next = next.eq('performance_band', filters.performanceBand);
  return next;
}


export async function fetchDashboardEvaluations(supabaseAdmin, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 50);
  const from = (page - 1) * pageSize;
  let query = applyFilters(
    supabaseAdmin.from('employee_evaluations').select(LIST_SELECT, { count: 'exact' }),
    filters
  );
  if (filters.approvalStatus) query = query.eq('current_approval_status', filters.approvalStatus);
  const result = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (result.error) fail('Employee evaluations could not be loaded.', result);
  return { rows: result.data || [], count: result.count || 0, page, pageSize };
}

export async function fetchDashboardSummary(supabaseAdmin, filters) {
  const result = await supabaseAdmin.rpc('get_evaluation_dashboard_summary', {
    p_department_id: filters.departmentId || null,
    p_period_id: filters.periodId || null,
    p_employee_id: filters.employeeId || null,
    p_performance_band: filters.performanceBand || null,
    p_approval_status: filters.approvalStatus || null,
  });
  if (result.error) fail('Evaluation summary could not be loaded.', result);
  return result.data || {};
}

export async function fetchDashboardOptions(supabaseAdmin, scope = {}) {
  let departmentQuery = supabaseAdmin.from('departments').select('id, name').order('name');
  let employeeQuery = supabaseAdmin
    .from('users')
    .select('id, full_name, display_name, email, department_id')
    .eq('status', 'active')
    .order('full_name')
    .limit(1000);
  let periodQuery = supabaseAdmin
    .from('evaluation_periods')
    .select('id, name, department_id, start_date, end_date, status')
    .order('start_date', { ascending: false })
    .limit(200);
  let bandQuery = supabaseAdmin
    .from('employee_evaluations')
    .select('performance_band, department_id, employee_id')
    .not('performance_band', 'is', null)
    .limit(2000);

  if (scope.departmentId) {
    departmentQuery = departmentQuery.eq('id', scope.departmentId);
    employeeQuery = employeeQuery.eq('department_id', scope.departmentId);
    periodQuery = periodQuery.eq('department_id', scope.departmentId);
    bandQuery = bandQuery.eq('department_id', scope.departmentId);
  }
  if (scope.employeeId) {
    employeeQuery = employeeQuery.eq('id', scope.employeeId);
    bandQuery = bandQuery.eq('employee_id', scope.employeeId);
  }

  const [departments, employees, periods, bands] = await Promise.all([
    departmentQuery,
    employeeQuery,
    periodQuery,
    bandQuery,
  ]);
  if (departments.error) fail('Department filters could not be loaded.', departments);
  if (employees.error) fail('Employee filters could not be loaded.', employees);
  if (periods.error) fail('Evaluation period filters could not be loaded.', periods);
  if (bands.error) fail('Performance band filters could not be loaded.', bands);
  return {
    departments: departments.data || [],
    employees: employees.data || [],
    periods: periods.data || [],
    performanceBands: [...new Set((bands.data || []).map((row) => row.performance_band).filter(Boolean))].sort(),
  };
}

export async function saveEvaluationReviewDecision(supabaseAdmin, payload) {
  const result = await supabaseAdmin.rpc('review_employee_evaluation', payload);
  if (result.error || !result.data) fail('Evaluation review decision could not be saved.', result, 409);
  return result.data;
}

export async function fetchEvaluationDetail(supabaseAdmin, evaluationId) {
  const result = await supabaseAdmin
    .from('employee_evaluations')
    .select(DETAIL_SELECT)
    .eq('id', evaluationId)
    .single();
  if (result.error || !result.data) fail('Employee evaluation was not found.', result, 404);
  return result.data;
}
