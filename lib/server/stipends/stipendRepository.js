const EVALUATION_SELECT = `
  id, employee_id, department_id, evaluation_period_id, status,
  approved_score, approved_performance_band, approved_stipend_percentage,
  approved_stipend_mode, current_approval_status, approved_at,
  employee_name_snapshot, department_name_snapshot,
  employee:employee_id (id, full_name, display_name, email, avatar_url),
  department:department_id (id, name),
  period:evaluation_period_id (id, name, start_date, end_date),
  stipend_recommendations:stipend_recommendations!stipend_recommendations_evaluation_id_fkey (
    id, version, status, recommendation_source, recommendation_mode,
    base_config_id, base_stipend_amount, recommended_percentage,
    formula_recommended_amount, recommended_amount, final_approved_amount,
    amount_adjustment, amount_adjustment_reason, currency, rationale,
    recommended_at, approved_at, approved_by
  )
`;

function repositoryError(message, result, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = result?.error;
  throw error;
}

export async function fetchApprovedEvaluations(supabaseAdmin, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 12, 1), 50);
  const from = (page - 1) * pageSize;
  let query = supabaseAdmin
    .from('employee_evaluations')
    .select(EVALUATION_SELECT, { count: 'exact' })
    .in('status', ['approved', 'finalized'])
    .eq('current_approval_status', 'approved');
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.periodId) query = query.eq('evaluation_period_id', filters.periodId);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  const result = await query.order('approved_at', { ascending: false }).range(from, from + pageSize - 1);
  if (result.error) repositoryError('Approved evaluations could not be loaded.', result);
  return { rows: result.data || [], count: result.count || 0, page, pageSize };
}

export async function fetchBaseConfigs(supabaseAdmin, scope = {}) {
  let query = supabaseAdmin
    .from('stipend_base_configs')
    .select(`
      id, name, department_id, employee_id, amount, currency,
      effective_from, effective_to, status, created_at, updated_at,
      department:department_id (id, name),
      employee:employee_id (id, full_name, display_name, email, department_id)
    `)
    .order('effective_from', { ascending: false });
  if (!scope.all) {
    const clauses = ['and(department_id.is.null,employee_id.is.null)'];
    if (scope.departmentIds?.length) clauses.push(`department_id.in.(${scope.departmentIds.join(',')})`);
    if (scope.employeeIds?.length) clauses.push(`employee_id.in.(${scope.employeeIds.join(',')})`);
    query = query.or(clauses.join(','));
  }
  const result = await query.limit(5000);
  if (result.error) repositoryError('Base stipend configurations could not be loaded.', result);
  return result.data || [];
}

export async function fetchStipendOptions(supabaseAdmin, scope = {}) {
  let departmentQuery = supabaseAdmin.from('departments').select('id, name').order('name');
  let employeeQuery = supabaseAdmin.from('users')
    .select('id, full_name, display_name, email, department_id')
    .eq('status', 'active').order('full_name').limit(1000);
  let periodQuery = supabaseAdmin.from('evaluation_periods')
    .select('id, name, department_id, start_date, end_date')
    .order('start_date', { ascending: false }).limit(300);
  if (scope.departmentId) {
    departmentQuery = departmentQuery.eq('id', scope.departmentId);
    employeeQuery = employeeQuery.eq('department_id', scope.departmentId);
    periodQuery = periodQuery.eq('department_id', scope.departmentId);
  }
  const [departments, employees, periods] = await Promise.all([
    departmentQuery, employeeQuery, periodQuery,
  ]);
  if (departments.error) repositoryError('Departments could not be loaded.', departments);
  if (employees.error) repositoryError('Employees could not be loaded.', employees);
  if (periods.error) repositoryError('Evaluation periods could not be loaded.', periods);
  return {
    departments: departments.data || [],
    employees: employees.data || [],
    periods: periods.data || [],
  };
}

export async function insertBaseConfig(supabaseAdmin, payload) {
  const result = await supabaseAdmin.from('stipend_base_configs').insert(payload).select('id').single();
  if (result.error) repositoryError('Base stipend configuration could not be created.', result, 409);
  return result.data;
}

export async function updateBaseConfig(supabaseAdmin, id, payload) {
  const result = await supabaseAdmin.from('stipend_base_configs')
    .update(payload).eq('id', id).select('id').single();
  if (result.error) repositoryError('Base stipend configuration could not be updated.', result, 409);
  return result.data;
}

export async function createRecommendation(supabaseAdmin, payload) {
  const result = await supabaseAdmin.rpc('create_stipend_recommendation', payload);
  if (result.error || !result.data) repositoryError('Stipend recommendation could not be created.', result, 409);
  return result.data;
}

export async function approveRecommendation(supabaseAdmin, payload) {
  const result = await supabaseAdmin.rpc('approve_stipend_recommendation', payload);
  if (result.error || !result.data) repositoryError('Stipend recommendation could not be approved.', result, 409);
  return result.data;
}
