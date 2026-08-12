const LOCKED_EVALUATION_STATUSES = new Set([
  'pending_approval',
  'approved',
  'finalized',
  'cancelled',
]);

export function normalizeEvaluationPeriod(period) {
  return Array.isArray(period) ? period[0] : period;
}

export function validateEvaluationContext(evaluation) {
  const period = normalizeEvaluationPeriod(evaluation.period);
  if (!period) {
    const error = new Error('The evaluation period could not be loaded.');
    error.statusCode = 409;
    throw error;
  }
  if (period.department_id !== evaluation.department_id) {
    const error = new Error('Evaluation and evaluation-period departments do not match.');
    error.statusCode = 409;
    throw error;
  }
  return { ...evaluation, period };
}

export function assertEvaluationPeriodCalculable(evaluation, componentLabel) {
  if (!['active', 'under_review'].includes(evaluation.period.status)) {
    const error = new Error(
      `${componentLabel} can only be calculated while the evaluation period is Active or Under Review.`
    );
    error.statusCode = 409;
    throw error;
  }
  if (
    evaluation.period.evaluation_deadline
    && Date.now() > new Date(evaluation.period.evaluation_deadline).getTime()
  ) {
    const error = new Error(`${componentLabel} cannot be calculated after the evaluation deadline.`);
    error.statusCode = 409;
    throw error;
  }
}

export function canReadEvaluation(currentUser, evaluation) {
  if (!currentUser || currentUser.status !== 'active') return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'department_lead') {
    return currentUser.department_id === evaluation.department_id;
  }
  return currentUser.id === evaluation.employee_id;
}

export function canCalculateEvaluation(currentUser, evaluation) {
  if (!currentUser || currentUser.status !== 'active') return false;
  if (currentUser.role === 'admin') return true;
  return currentUser.role === 'department_lead'
    && currentUser.department_id === evaluation.department_id;
}

export function assertEvaluationMutable(evaluation, componentLabel) {
  if (LOCKED_EVALUATION_STATUSES.has(evaluation.status)) {
    const error = new Error(
      `${componentLabel} cannot be recalculated for a ${evaluation.status} evaluation.`
    );
    error.statusCode = 409;
    throw error;
  }
}

export function evaluationResponse(evaluation) {
  return {
    id: evaluation.id,
    employeeId: evaluation.employee_id,
    employeeName: evaluation.employee_name_snapshot,
    departmentId: evaluation.department_id,
    departmentName: evaluation.department_name_snapshot,
    status: evaluation.status,
    period: evaluation.period,
  };
}
