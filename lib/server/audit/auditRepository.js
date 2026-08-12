const AUDIT_SELECT = `
  id,
  entity_type,
  entity_id,
  action,
  event_type,
  evaluation_id,
  employee_id,
  department_id,
  actor_user_id,
  old_values,
  new_values,
  request_id,
  reason,
  occurred_at,
  actor:actor_user_id (id, full_name, display_name, email, role),
  employee:employee_id (id, full_name, display_name, email),
  department:department_id (id, name),
  evaluation:evaluation_id (id, employee_name_snapshot, department_name_snapshot, status, overall_score)
`;

function repositoryError(message, result, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = result?.error;
  throw error;
}

function applyFilters(query, filters) {
  let next = query;
  if (filters.entityType) next = next.eq('entity_type', filters.entityType);
  if (filters.eventType) next = next.eq('event_type', filters.eventType);
  if (filters.departmentId) next = next.eq('department_id', filters.departmentId);
  if (filters.employeeId) next = next.eq('employee_id', filters.employeeId);
  if (filters.actorId) next = next.eq('actor_user_id', filters.actorId);
  if (filters.evaluationId) next = next.eq('evaluation_id', filters.evaluationId);
  if (filters.dateFrom) next = next.gte('occurred_at', filters.dateFrom);
  if (filters.dateTo) next = next.lte('occurred_at', filters.dateTo);
  if (filters.selfFilter) {
    // Employees see rows where they are the subject OR the actor.
    next = next.or(`employee_id.eq.${filters.selfFilter.subjectId},actor_user_id.eq.${filters.selfFilter.actorId}`);
  }
  return next;
}

export async function fetchAuditHistory(supabaseAdmin, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 15, 1), 50);
  const from = (page - 1) * pageSize;
  const result = await applyFilters(
    supabaseAdmin.from('evaluation_audit_history').select(AUDIT_SELECT, { count: 'exact' }),
    filters
  )
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);
  if (result.error) repositoryError('Audit history could not be loaded.', result);
  return { rows: result.data || [], count: result.count || 0, page, pageSize };
}

// Count rows matching the same filters. Used for summary cards that are always
// traceable to stored audit records.
export async function fetchAuditCount(supabaseAdmin, filters) {
  const result = await applyFilters(
    supabaseAdmin.from('evaluation_audit_history').select('id', { count: 'exact', head: true }),
    filters
  );
  if (result.error) repositoryError('Audit record count could not be loaded.', result);
  return result.count || 0;
}

export async function fetchAuditOptions(supabaseAdmin, scope = {}) {
  let departmentQuery = supabaseAdmin.from('departments').select('id, name').order('name');
  let employeeQuery = supabaseAdmin
    .from('users')
    .select('id, full_name, display_name, email, department_id')
    .eq('status', 'active')
    .order('full_name')
    .limit(1000);
  if (scope.departmentId) {
    departmentQuery = departmentQuery.eq('id', scope.departmentId);
    employeeQuery = employeeQuery.eq('department_id', scope.departmentId);
  }
  const [departments, employees] = await Promise.all([departmentQuery, employeeQuery]);
  if (departments.error) repositoryError('Department filters could not be loaded.', departments);
  if (employees.error) repositoryError('Employee filters could not be loaded.', employees);
  return {
    departments: departments.data || [],
    employees: employees.data || [],
  };
}
