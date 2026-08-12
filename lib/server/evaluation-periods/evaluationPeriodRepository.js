const PERIOD_SELECT = `
  id,
  name,
  department_id,
  weight_config_id,
  start_date,
  end_date,
  evaluation_deadline,
  status,
  created_by,
  created_at,
  updated_at,
  opened_at,
  review_started_at,
  approved_at,
  closed_at,
  department:department_id (id, name),
  creator:created_by (id, full_name, display_name, email),
  evaluations:employee_evaluations (
    id,
    employee_id,
    status,
    calculation_status,
    overall_score,
    performance_band,
    employee:employee_id (id, full_name, display_name, email, avatar_url, job_title, status)
  )
`;

function queryError(message, result, statusCode) {
  const error = new Error(message);
  const conflictCodes = new Set(['23P01', '23505']);
  error.statusCode = statusCode || (conflictCodes.has(result.error?.code) ? 409 : undefined);
  error.cause = result.error;
  return error;
}

export async function fetchEvaluationPeriod(supabaseAdmin, periodId) {
  const result = await supabaseAdmin
    .from('evaluation_periods')
    .select(PERIOD_SELECT)
    .eq('id', periodId)
    .single();
  if (result.error || !result.data) throw queryError('Evaluation period was not found.', result, 404);
  return result.data;
}

export async function fetchEvaluationPeriods(supabaseAdmin, filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabaseAdmin
    .from('evaluation_periods')
    .select(PERIOD_SELECT, { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(from, to);

  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.status) query = query.eq('status', filters.status);

  const result = await query;
  if (result.error) throw queryError('Evaluation periods could not be loaded.', result);
  return {
    data: result.data || [],
    count: result.count || 0,
    page,
    pageSize,
  };
}

export async function fetchEvaluationPeriodOptions(supabaseAdmin, departmentId) {
  let departmentQuery = supabaseAdmin
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true });
  let employeeQuery = supabaseAdmin
    .from('users')
    .select('id, full_name, display_name, email, avatar_url, job_title, department_id')
    .eq('status', 'active')
    .order('full_name', { ascending: true })
    .limit(1000);

  if (departmentId) {
    departmentQuery = departmentQuery.eq('id', departmentId);
    employeeQuery = employeeQuery.eq('department_id', departmentId);
  }

  const [departmentResult, employeeResult] = await Promise.all([
    departmentQuery,
    employeeQuery,
  ]);
  if (departmentResult.error) throw queryError('Departments could not be loaded.', departmentResult);
  if (employeeResult.error) throw queryError('Employees could not be loaded.', employeeResult);

  return {
    departments: departmentResult.data || [],
    employees: employeeResult.data || [],
  };
}

export async function resolveEvaluationWeightConfig(supabaseAdmin, departmentId, startDate, endDate) {
  const result = await supabaseAdmin
    .from('evaluation_weight_configs')
    .select('id, department_id, version, effective_from, effective_to')
    .eq('status', 'active')
    .lte('effective_from', startDate)
    .or(`effective_to.is.null,effective_to.gte.${endDate}`);
  if (result.error) throw queryError('Evaluation scoring configuration could not be resolved.', result);

  const configs = result.data || [];
  const config = configs
    .filter((item) => item.department_id === departmentId)
    .sort((a, b) => b.version - a.version)[0]
    || configs
      .filter((item) => item.department_id === null)
      .sort((a, b) => b.version - a.version)[0];

  if (!config) {
    const error = new Error('No active scoring configuration covers the selected department and dates.');
    error.statusCode = 409;
    throw error;
  }
  return config;
}

export async function validateApplicableEmployees(supabaseAdmin, departmentId, employeeIds) {
  const result = await supabaseAdmin
    .from('users')
    .select('id')
    .in('id', employeeIds)
    .eq('department_id', departmentId)
    .eq('status', 'active');
  if (result.error) throw queryError('Applicable employees could not be validated.', result);
  if ((result.data || []).length !== employeeIds.length) {
    const error = new Error('Every applicable employee must be active and belong to the selected department.');
    error.statusCode = 400;
    throw error;
  }
}

export async function assertNoPeriodOverlap(supabaseAdmin, { id, departmentId, startDate, endDate }) {
  let query = supabaseAdmin
    .from('evaluation_periods')
    .select('id, name, start_date, end_date')
    .eq('department_id', departmentId)
    .neq('status', 'cancelled')
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  if (id) query = query.neq('id', id);

  const result = await query.limit(1);
  if (result.error) throw queryError('Evaluation-period overlap could not be checked.', result);
  if ((result.data || []).length > 0) {
    const error = new Error('The selected dates overlap another evaluation period in this department.');
    error.statusCode = 409;
    throw error;
  }
}

export async function createEvaluationPeriod(supabaseAdmin, payload, actorId, weightConfigId) {
  const result = await supabaseAdmin.rpc('create_managed_evaluation_period', {
    p_department_id: payload.department_id,
    p_weight_config_id: weightConfigId,
    p_title: payload.title,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_evaluation_deadline: payload.evaluation_deadline,
    p_employee_ids: payload.employee_ids,
    p_actor_id: actorId,
  });
  if (result.error || !result.data) throw queryError('Evaluation period could not be created.', result);
  return fetchEvaluationPeriod(supabaseAdmin, result.data);
}

export async function updateDraftPeriod(supabaseAdmin, period, payload, actorId) {
  const result = await supabaseAdmin.rpc('update_managed_draft_evaluation_period', {
    p_period_id: period.id,
    p_title: payload.title,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_evaluation_deadline: payload.evaluation_deadline,
    p_employee_ids: payload.employee_ids,
    p_actor_id: actorId,
  });
  if (result.error || !result.data) {
    throw queryError('Draft evaluation period could not be updated.', result, 409);
  }
  return fetchEvaluationPeriod(supabaseAdmin, result.data);
}

export async function transitionEvaluationPeriod(supabaseAdmin, period, status, actorId) {
  const updates = { status };
  const now = new Date().toISOString();
  if (status === 'active' && !period.opened_at) {
    Object.assign(updates, { opened_by: actorId, opened_at: now });
  }
  if (status === 'under_review' && !period.review_started_at) {
    Object.assign(updates, { review_started_by: actorId, review_started_at: now });
  }
  if (status === 'approved' && !period.approved_at) {
    Object.assign(updates, { approved_by: actorId, approved_at: now });
  }
  if (status === 'closed' && !period.closed_at) {
    Object.assign(updates, { closed_by: actorId, closed_at: now });
  }

  const result = await supabaseAdmin
    .from('evaluation_periods')
    .update(updates)
    .eq('id', period.id)
    .select('id')
    .single();
  if (result.error || !result.data) throw queryError('Evaluation period status could not be updated.', result, 409);
  return fetchEvaluationPeriod(supabaseAdmin, period.id);
}
