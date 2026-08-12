import { fetchDashboardOptions } from '../evaluation-dashboard/evaluationDashboardRepository';

function fail(message, result) {
  const error = new Error(message);
  error.statusCode = 500;
  error.cause = result.error;
  throw error;
}

export async function fetchManagementAnalytics(supabaseAdmin, filters) {
  const result = await supabaseAdmin.rpc('get_management_evaluation_analytics', {
    p_department_id: filters.departmentId || null,
    p_period_id: filters.periodId || null,
    p_employee_id: filters.employeeId || null,
    p_performance_band: filters.performanceBand || null,
  });
  if (result.error) fail('Management evaluation analytics could not be loaded.', result);
  return result.data || {};
}

export function fetchManagementAnalyticsOptions(supabaseAdmin, scope) {
  return fetchDashboardOptions(supabaseAdmin, scope);
}
