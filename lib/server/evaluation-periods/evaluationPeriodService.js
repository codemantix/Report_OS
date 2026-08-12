import {
  hasEvaluationPeriodErrors,
  isUuid,
  normalizeEvaluationPeriodPayload,
  validateEvaluationPeriod,
} from '../../../utils/evaluationPeriodValidation';
import {
  EVALUATION_PERIOD_STATUSES,
  EVALUATION_PERIOD_TRANSITIONS,
} from '../../../utils/evaluationPeriodConstants';
import {
  assertNoPeriodOverlap,
  createEvaluationPeriod,
  fetchEvaluationPeriod,
  fetchEvaluationPeriodOptions,
  fetchEvaluationPeriods,
  resolveEvaluationWeightConfig,
  transitionEvaluationPeriod,
  updateDraftPeriod,
  validateApplicableEmployees,
} from './evaluationPeriodRepository';
import {
  buildPeriodOpenedNotifications,
  dispatchEvaluationNotifications,
} from '../notifications/evaluationNotifier';

function assertManager(currentUser) {
  if (!currentUser || currentUser.status !== 'active') {
    const error = new Error('An active account is required.');
    error.statusCode = 403;
    throw error;
  }
  if (!['admin', 'department_lead'].includes(currentUser.role)) {
    const error = new Error('Only authorized management can manage evaluation periods.');
    error.statusCode = 403;
    throw error;
  }
  if (currentUser.role === 'department_lead' && !currentUser.department_id) {
    const error = new Error('A department assignment is required to manage evaluation periods.');
    error.statusCode = 403;
    throw error;
  }
}

function assertDepartmentAccess(currentUser, departmentId) {
  if (currentUser.role === 'department_lead' && currentUser.department_id !== departmentId) {
    const error = new Error('You cannot manage evaluation periods outside your department.');
    error.statusCode = 403;
    throw error;
  }
}

function assertIdentifier(value, label) {
  if (!isUuid(value)) {
    const error = new Error(`${label} must be a valid identifier.`);
    error.statusCode = 400;
    throw error;
  }
}

function validationError(errors) {
  const error = new Error('Please correct the highlighted evaluation-period fields.');
  error.statusCode = 400;
  error.code = 'EVALUATION_PERIOD_VALIDATION_ERROR';
  error.fields = errors;
  return error;
}

export async function listEvaluationPeriods(supabaseAdmin, filters, currentUser) {
  assertManager(currentUser);
  const departmentId = currentUser.role === 'department_lead'
    ? currentUser.department_id
    : filters.departmentId || null;
  if (departmentId) assertIdentifier(departmentId, 'Department id');
  if (filters.status && !EVALUATION_PERIOD_STATUSES.includes(filters.status)) {
    const error = new Error('Status filter is invalid.');
    error.statusCode = 400;
    throw error;
  }
  const [periodResult, options] = await Promise.all([
    fetchEvaluationPeriods(supabaseAdmin, {
      departmentId,
      status: filters.status || null,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    fetchEvaluationPeriodOptions(
      supabaseAdmin,
      currentUser.role === 'department_lead' ? currentUser.department_id : null
    ),
  ]);
  return {
    periods: periodResult.data,
    options,
    pagination: {
      page: periodResult.page,
      pageSize: periodResult.pageSize,
      totalCount: periodResult.count,
      totalPages: Math.max(Math.ceil(periodResult.count / periodResult.pageSize), 1),
    },
  };
}

export async function createManagedEvaluationPeriod(supabaseAdmin, input, currentUser) {
  assertManager(currentUser);
  const payload = normalizeEvaluationPeriodPayload(input);
  const errors = validateEvaluationPeriod(payload);
  if (hasEvaluationPeriodErrors(errors)) throw validationError(errors);
  assertDepartmentAccess(currentUser, payload.department_id);

  await Promise.all([
    validateApplicableEmployees(supabaseAdmin, payload.department_id, payload.employee_ids),
    assertNoPeriodOverlap(supabaseAdmin, {
      departmentId: payload.department_id,
      startDate: payload.start_date,
      endDate: payload.end_date,
    }),
  ]);
  const config = await resolveEvaluationWeightConfig(
    supabaseAdmin,
    payload.department_id,
    payload.start_date,
    payload.end_date
  );
  return createEvaluationPeriod(supabaseAdmin, payload, currentUser.id, config.id);
}

export async function updateManagedEvaluationPeriod(supabaseAdmin, periodId, input, currentUser) {
  assertManager(currentUser);
  assertIdentifier(periodId, 'Evaluation period id');
  const period = await fetchEvaluationPeriod(supabaseAdmin, periodId);
  assertDepartmentAccess(currentUser, period.department_id);
  if (period.status !== 'draft') {
    const error = new Error('Only Draft periods can change dates or applicable employees.');
    error.statusCode = 409;
    throw error;
  }

  const payload = normalizeEvaluationPeriodPayload(input);
  payload.department_id = period.department_id;
  const errors = validateEvaluationPeriod(payload);
  if (hasEvaluationPeriodErrors(errors)) throw validationError(errors);

  const [, , config] = await Promise.all([
    validateApplicableEmployees(supabaseAdmin, period.department_id, payload.employee_ids),
    assertNoPeriodOverlap(supabaseAdmin, {
      id: period.id,
      departmentId: period.department_id,
      startDate: payload.start_date,
      endDate: payload.end_date,
    }),
    resolveEvaluationWeightConfig(
      supabaseAdmin,
      period.department_id,
      payload.start_date,
      payload.end_date
    ),
  ]);
  if (config.id !== period.weight_config_id) {
    const error = new Error(
      'The selected dates require a different scoring configuration. Create a new period for that window.'
    );
    error.statusCode = 409;
    throw error;
  }
  return updateDraftPeriod(supabaseAdmin, period, payload, currentUser.id);
}

export async function transitionManagedEvaluationPeriod(
  supabaseAdmin,
  periodId,
  nextStatus,
  currentUser
) {
  assertManager(currentUser);
  assertIdentifier(periodId, 'Evaluation period id');
  const period = await fetchEvaluationPeriod(supabaseAdmin, periodId);
  assertDepartmentAccess(currentUser, period.department_id);
  const allowed = (EVALUATION_PERIOD_TRANSITIONS[period.status] || [])
    .some((transition) => transition.status === nextStatus);
  if (!allowed) {
    const error = new Error(`Evaluation period cannot move from ${period.status} to ${nextStatus}.`);
    error.statusCode = 409;
    throw error;
  }
  if (nextStatus === 'active' && (period.evaluations || []).length === 0) {
    const error = new Error('Select at least one applicable employee before activating this period.');
    error.statusCode = 409;
    throw error;
  }
  if (
    nextStatus === 'approved'
    && (period.evaluations || []).some((evaluation) => !['approved', 'finalized'].includes(evaluation.status))
  ) {
    const error = new Error(
      'Every applicable employee evaluation requires human approval before approving the period.'
    );
    error.statusCode = 409;
    throw error;
  }
  const updatedPeriod = await transitionEvaluationPeriod(supabaseAdmin, period, nextStatus, currentUser.id);
  if (nextStatus === 'active') {
    // Notify applicable employees once per period. Failures never break the
    // transition response; the dispatcher logs and skips duplicates.
    try {
      await dispatchEvaluationNotifications(supabaseAdmin, buildPeriodOpenedNotifications(updatedPeriod));
    } catch (error) {
      console.error('Period-opened notifications could not be dispatched:', error);
    }
  }
  return updatedPeriod;
}
