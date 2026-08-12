import { randomUUID } from 'crypto';
import { isUuid } from '../../../utils/evaluationPeriodValidation';
import {
  calculateRecommendedPayment,
  currentStipendRecommendation,
  resolveBaseStipend,
  validateBaseStipendInput,
  validateRecommendationAction,
} from '../../../utils/stipendRecommendationRules';
import {
  approveRecommendation,
  createRecommendation,
  fetchApprovedEvaluations,
  fetchBaseConfigs,
  fetchStipendOptions,
  insertBaseConfig,
  updateBaseConfig,
} from './stipendRepository';
import {
  buildStipendApprovedNotification,
  dispatchEvaluationNotifications,
  fetchRecommendationEvaluation,
} from '../notifications/evaluationNotifier';

function stipendError(message, statusCode = 400, fields = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.fields = fields;
  return error;
}

function assertManager(currentUser) {
  if (!currentUser || currentUser.status !== 'active'
    || !['admin', 'department_lead'].includes(currentUser.role)) {
    throw stipendError('You are not authorized to manage stipend recommendations.', 403);
  }
  if (currentUser.role === 'department_lead' && !currentUser.department_id) {
    throw stipendError('A department assignment is required.', 403);
  }
}

function optionalUuid(value, label) {
  if (value && !isUuid(value)) throw stipendError(`${label} is invalid.`);
  return value || null;
}

function managerScope(currentUser, filters = {}) {
  assertManager(currentUser);
  return {
    departmentId: currentUser.role === 'admin'
      ? optionalUuid(filters.departmentId, 'Department')
      : currentUser.department_id,
    employeeId: optionalUuid(filters.employeeId, 'Employee'),
    periodId: optionalUuid(filters.periodId, 'Evaluation period'),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

function canSeeConfig(config, currentUser) {
  if (currentUser.role === 'admin') return true;
  return !config.department_id && !config.employee_id
    || config.department_id === currentUser.department_id
    || config.employee?.department_id === currentUser.department_id;
}

function shapeEvaluation(evaluation, configs) {
  const recommendation = currentStipendRecommendation(evaluation);
  const baseConfig = recommendation?.base_config_id
    ? configs.find((config) => config.id === recommendation.base_config_id) || null
    : resolveBaseStipend(configs, evaluation);
  let calculatedAmount = recommendation?.formula_recommended_amount ?? null;
  if (!recommendation && baseConfig && evaluation.approved_stipend_mode === 'percentage') {
    calculatedAmount = calculateRecommendedPayment(baseConfig.amount, evaluation.approved_stipend_percentage);
  }
  return {
    ...evaluation,
    current_recommendation: recommendation,
    applicable_base_config: baseConfig,
    calculated_recommended_amount: calculatedAmount,
    recommendation_status: recommendation?.status || 'not_started',
  };
}

export async function getStipendManagement(supabaseAdmin, filters, currentUser) {
  const scope = managerScope(currentUser, filters);
  const [list, options] = await Promise.all([
    fetchApprovedEvaluations(supabaseAdmin, scope),
    fetchStipendOptions(supabaseAdmin, { departmentId: currentUser.role === 'admin' ? null : currentUser.department_id }),
  ]);
  const scopedEmployees = scope.departmentId
    ? options.employees.filter((employee) => employee.department_id === scope.departmentId)
    : options.employees;
  const allConfigs = await fetchBaseConfigs(supabaseAdmin, {
    all: currentUser.role === 'admin' && !scope.departmentId,
    departmentIds: [...new Set([
      scope.departmentId,
      ...list.rows.map((row) => row.department_id),
    ].filter(Boolean))],
    employeeIds: [...new Set([
      ...scopedEmployees.map((employee) => employee.id),
      ...list.rows.map((row) => row.employee_id),
    ].filter(Boolean))],
  });
  const configs = allConfigs.filter((config) => canSeeConfig(config, currentUser));
  const evaluations = list.rows.map((evaluation) => shapeEvaluation(evaluation, configs));
  return {
    evaluations,
    baseConfigs: configs,
    options,
    permissions: {
      canManageBaseConfigs: currentUser.role === 'admin',
      canCreateRecommendations: true,
      canApproveRecommendations: currentUser.role === 'admin',
      canAdjustFinalAmount: currentUser.role === 'admin',
    },
    summary: {
      approvedEvaluations: evaluations.length,
      awaitingRecommendation: evaluations.filter((row) => row.recommendation_status === 'not_started').length,
      awaitingApproval: evaluations.filter((row) => row.recommendation_status === 'recommended').length,
      approvedRecommendations: evaluations.filter((row) => row.recommendation_status === 'approved').length,
    },
    pagination: {
      page: list.page,
      pageSize: list.pageSize,
      totalCount: list.count,
      totalPages: Math.max(Math.ceil(list.count / list.pageSize), 1),
    },
  };
}

export async function saveBaseStipendConfig(supabaseAdmin, input, currentUser, operation) {
  assertManager(currentUser);
  if (currentUser.role !== 'admin') throw stipendError('Only administrators may change base stipend configurations.', 403);
  let values;
  try {
    values = validateBaseStipendInput(input);
  } catch (error) {
    throw stipendError(error.message);
  }
  if (values.departmentId) optionalUuid(values.departmentId, 'Department');
  if (values.employeeId) optionalUuid(values.employeeId, 'Employee');
  const payload = {
    name: values.name,
    department_id: values.departmentId,
    employee_id: values.employeeId,
    amount: values.amount,
    currency: values.currency,
    effective_from: values.effectiveFrom,
    effective_to: values.effectiveTo,
    status: values.status,
    updated_by: currentUser.id,
  };
  if (operation === 'update') {
    if (!input.id) throw stipendError('Base stipend configuration id is required for updates.');
    optionalUuid(input.id, 'Base stipend configuration');
    return updateBaseConfig(supabaseAdmin, input.id, payload);
  }
  if (input.id) throw stipendError('New base stipend configurations must not include an id.');
  return insertBaseConfig(supabaseAdmin, { ...payload, created_by: currentUser.id });
}

export async function manageStipendRecommendation(supabaseAdmin, input, currentUser) {
  assertManager(currentUser);
  let action;
  try {
    action = validateRecommendationAction(input);
  } catch (error) {
    throw stipendError(error.message);
  }
  if (action.action === 'create') {
    optionalUuid(action.evaluationId, 'Evaluation');
    if (action.baseConfigId) optionalUuid(action.baseConfigId, 'Base stipend configuration');
    return createRecommendation(supabaseAdmin, {
      p_evaluation_id: action.evaluationId,
      p_actor_id: currentUser.id,
      p_base_config_id: action.baseConfigId,
      p_manual_amount: action.manualAmount,
      p_reason: action.reason,
      p_request_id: randomUUID(),
    });
  }
  if (currentUser.role !== 'admin') {
    throw stipendError('Only administrators may approve or adjust final stipend amounts.', 403);
  }
  optionalUuid(action.recommendationId, 'Stipend recommendation');
  const recommendationId = await approveRecommendation(supabaseAdmin, {
    p_recommendation_id: action.recommendationId,
    p_actor_id: currentUser.id,
    p_final_amount: action.finalAmount,
    p_adjustment_reason: action.reason,
    p_request_id: randomUUID(),
  });

  // Notify the employee once per approved recommendation. Delivery failures are
  // logged and never break the stipend approval response.
  try {
    const context = await fetchRecommendationEvaluation(supabaseAdmin, recommendationId);
    if (context) {
      await dispatchEvaluationNotifications(supabaseAdmin, [
        buildStipendApprovedNotification(context.evaluation, context.recommendation?.final_approved_amount != null
          ? `Approved amount: ${context.recommendation.currency} ${context.recommendation.final_approved_amount}.`
          : ''),
      ]);
    }
  } catch (error) {
    console.error('Stipend-approved notification could not be dispatched:', error);
  }
  return recommendationId;
}
