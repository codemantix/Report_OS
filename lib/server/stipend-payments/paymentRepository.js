const PAYMENT_SELECT = `
  id, evaluation_id, review_round_id, version, status, recommendation_mode,
  recommended_percentage, base_stipend_amount, recommended_amount,
  final_approved_amount, currency, approved_at,
  evaluation:employee_evaluations!stipend_recommendations_evaluation_id_fkey!inner (
    id, employee_id, department_id, evaluation_period_id,
    approved_score, approved_performance_band,
    employee_name_snapshot, department_name_snapshot,
    employee:employee_id (id, full_name, display_name, email, avatar_url),
    department:department_id (id, name),
    period:evaluation_period_id (id, name, start_date, end_date)
  ),
  payment_records (
    id, status, amount, currency, approved_by, approved_at,
    processed_by, processed_at, paid_at, held_by, held_at, hold_reason,
    payment_date, payment_reference, notes, created_at, updated_at,
    payment_approver:approved_by (id, full_name, display_name, email),
    payment_recorder:processed_by (id, full_name, display_name, email),
    hold_actor:held_by (id, full_name, display_name, email)
  )
`;

function repositoryError(message, result, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = result?.error;
  throw error;
}

export async function fetchPaymentTrackingRows(supabaseAdmin, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 12, 1), 50);
  const from = (page - 1) * pageSize;
  let query = supabaseAdmin.from('stipend_recommendations')
    .select(PAYMENT_SELECT, { count: 'exact' })
    .eq('status', 'approved');
  if (filters.departmentId) query = query.eq('evaluation.department_id', filters.departmentId);
  if (filters.employeeId) query = query.eq('evaluation.employee_id', filters.employeeId);
  if (filters.periodId) query = query.eq('evaluation.evaluation_period_id', filters.periodId);
  const result = await query.order('approved_at', { ascending: false }).range(from, from + pageSize - 1);
  if (result.error) repositoryError('Stipend payment tracking could not be loaded.', result);
  return { rows: result.data || [], count: result.count || 0, page, pageSize };
}

export async function fetchPaymentTrackingOptions(supabaseAdmin, scope = {}) {
  let departmentQuery = supabaseAdmin.from('departments').select('id, name').order('name');
  let employeeQuery = supabaseAdmin.from('users')
    .select('id, full_name, display_name, email, department_id')
    .eq('status', 'active').order('full_name').limit(5000);
  let periodQuery = supabaseAdmin.from('evaluation_periods')
    .select('id, name, department_id, start_date, end_date')
    .order('start_date', { ascending: false }).limit(1000);
  if (scope.departmentId) {
    departmentQuery = departmentQuery.eq('id', scope.departmentId);
    employeeQuery = employeeQuery.eq('department_id', scope.departmentId);
    periodQuery = periodQuery.eq('department_id', scope.departmentId);
  }
  if (scope.employeeId) employeeQuery = employeeQuery.eq('id', scope.employeeId);
  const [departments, employees, periods] = await Promise.all([departmentQuery, employeeQuery, periodQuery]);
  if (departments.error) repositoryError('Payment departments could not be loaded.', departments);
  if (employees.error) repositoryError('Payment employees could not be loaded.', employees);
  if (periods.error) repositoryError('Payment periods could not be loaded.', periods);
  return { departments: departments.data || [], employees: employees.data || [], periods: periods.data || [] };
}

export async function createPaymentTracking(supabaseAdmin, payload) {
  const result = await supabaseAdmin.rpc('create_stipend_payment_tracking', payload);
  if (result.error || !result.data) repositoryError('Payment tracking record could not be created.', result, 409);
  return result.data;
}

export async function updatePaymentTracking(supabaseAdmin, payload) {
  const result = await supabaseAdmin.rpc('update_stipend_payment_tracking', payload);
  if (result.error || !result.data) repositoryError('Payment tracking status could not be updated.', result, 409);
  return result.data;
}
