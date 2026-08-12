export const STIPEND_RECOMMENDATION_STATUSES = Object.freeze([
  'not_started',
  'recommended',
  'approved',
  'rejected',
  'superseded',
  'cancelled',
]);

export function calculateRecommendedPayment(baseAmount, approvedPercentage) {
  const base = Number(baseAmount);
  const percentage = Number(approvedPercentage);
  if (!Number.isFinite(base) || base <= 0) throw new Error('Base stipend must be positive.');
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Approved stipend percentage must be between 0 and 100.');
  }
  return Number((base * percentage / 100).toFixed(2));
}

export function requiresManualStipendDecision(evaluation) {
  return Number(evaluation?.approved_score) < 60
    || evaluation?.approved_stipend_mode === 'manual';
}

export function currentStipendRecommendation(evaluation) {
  return [...(evaluation?.stipend_recommendations || [])]
    .filter((recommendation) => ['draft', 'recommended', 'approved'].includes(recommendation.status))
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

export function resolveBaseStipend(configs, evaluation) {
  const periodEnd = evaluation?.period?.end_date;
  return [...(configs || [])]
    .filter((config) => config.status === 'active'
      && (!periodEnd || config.effective_from <= periodEnd)
      && (!periodEnd || !config.effective_to || config.effective_to >= periodEnd)
      && (config.employee_id === evaluation.employee_id
        || config.department_id === evaluation.department_id
        || (!config.employee_id && !config.department_id)))
    .sort((a, b) => {
      const aPriority = a.employee_id === evaluation.employee_id ? 2 : a.department_id === evaluation.department_id ? 1 : 0;
      const bPriority = b.employee_id === evaluation.employee_id ? 2 : b.department_id === evaluation.department_id ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return String(b.effective_from).localeCompare(String(a.effective_from));
    })[0] || null;
}

export function validateBaseStipendInput(input) {
  const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const amount = Number(payload.amount);
  const currency = typeof payload.currency === 'string' ? payload.currency.trim().toUpperCase() : '';
  const effectiveFrom = typeof payload.effectiveFrom === 'string' ? payload.effectiveFrom : '';
  const effectiveTo = typeof payload.effectiveTo === 'string' && payload.effectiveTo ? payload.effectiveTo : null;
  const status = payload.status ?? 'active';
  if (!name || name.length > 160) throw new Error('Configuration name is required and must be 160 characters or fewer.');
  if (!['active', 'inactive'].includes(status)) throw new Error('Configuration status must be active or inactive.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Base stipend amount must be positive.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter ISO code.');
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };
  if (!validDate(effectiveFrom)) throw new Error('Effective start date is required and must be valid.');
  if (effectiveTo && (!validDate(effectiveTo) || effectiveTo < effectiveFrom)) {
    throw new Error('Effective end date must be on or after the start date.');
  }
  if (payload.departmentId && payload.employeeId) throw new Error('Choose either a department or employee scope, not both.');
  return {
    name,
    amount: Number(amount.toFixed(2)),
    currency,
    effectiveFrom,
    effectiveTo,
    status,
    departmentId: payload.departmentId || null,
    employeeId: payload.employeeId || null,
  };
}

export function validateRecommendationAction(input) {
  const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (!['create', 'approve'].includes(payload.action)) throw new Error('Stipend action must be create or approve.');
  const manualAmount = payload.manualAmount === '' || payload.manualAmount === null || payload.manualAmount === undefined
    ? null
    : Number(payload.manualAmount);
  const finalAmount = payload.finalAmount === '' || payload.finalAmount === null || payload.finalAmount === undefined
    ? null
    : Number(payload.finalAmount);
  if (manualAmount !== null && (!Number.isFinite(manualAmount) || manualAmount <= 0)) {
    throw new Error('Manual stipend amount must be positive.');
  }
  if (finalAmount !== null && (!Number.isFinite(finalAmount) || finalAmount < 0)) {
    throw new Error('Final approved amount cannot be negative.');
  }
  if (payload.action === 'create' && !payload.evaluationId) throw new Error('Evaluation is required.');
  if (payload.action === 'approve' && !payload.recommendationId) throw new Error('Stipend recommendation is required.');
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length > 5000) throw new Error('Adjustment reason must be 5000 characters or fewer.');
  return {
    action: payload.action,
    evaluationId: payload.evaluationId || null,
    recommendationId: payload.recommendationId || null,
    baseConfigId: payload.baseConfigId || null,
    manualAmount: manualAmount === null ? null : Number(manualAmount.toFixed(2)),
    finalAmount: finalAmount === null ? null : Number(finalAmount.toFixed(2)),
    reason: reason || null,
  };
}
