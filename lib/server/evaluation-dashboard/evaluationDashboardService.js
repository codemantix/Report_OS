import { canReadEvaluation } from '../evaluations/evaluationAccess';
import { isUuid } from '../../../utils/evaluationPeriodValidation';
import { EVALUATION_APPROVAL_STATUSES } from '../../../utils/evaluationDashboardConstants';
import { fetchEvaluationDetailSources } from './evaluationDetailSourceService';
import { evaluationReviewPermissions } from './evaluationReviewService';
import {
  fetchDashboardEvaluations,
  fetchDashboardOptions,
  fetchDashboardSummary,
  fetchEvaluationDetail,
} from './evaluationDashboardRepository';

function assertActive(currentUser) {
  if (!currentUser || currentUser.status !== 'active') {
    const error = new Error('An active account is required.');
    error.statusCode = 403;
    throw error;
  }
  if (!['admin', 'department_lead', 'team_member'].includes(currentUser.role)) {
    const error = new Error('This role cannot access employee evaluations.');
    error.statusCode = 403;
    throw error;
  }
  if (currentUser.role === 'department_lead' && !currentUser.department_id) {
    const error = new Error('A department assignment is required.');
    error.statusCode = 403;
    throw error;
  }
}

function optionalUuid(value, label) {
  if (value && !isUuid(value)) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
  return value || null;
}

function scopeFilters(filters, currentUser) {
  assertActive(currentUser);
  const scoped = {
    periodId: optionalUuid(filters.periodId, 'Evaluation period'),
    departmentId: optionalUuid(filters.departmentId, 'Department'),
    employeeId: optionalUuid(filters.employeeId, 'Employee'),
    performanceBand: filters.performanceBand || null,
    approvalStatus: filters.approvalStatus || null,
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (scoped.performanceBand && (
    typeof scoped.performanceBand !== 'string' || scoped.performanceBand.length > 100
  )) {
    const error = new Error('Performance band is invalid.');
    error.statusCode = 400;
    throw error;
  }
  if (scoped.approvalStatus && !EVALUATION_APPROVAL_STATUSES.includes(scoped.approvalStatus)) {
    const error = new Error('Approval status is invalid.');
    error.statusCode = 400;
    throw error;
  }

  if (currentUser.role === 'department_lead') scoped.departmentId = currentUser.department_id;
  if (currentUser.role === 'team_member') {
    scoped.employeeId = currentUser.id;
    scoped.departmentId = currentUser.department_id;
  }
  return scoped;
}

export async function getEvaluationDashboard(supabaseAdmin, filters, currentUser) {
  const scoped = scopeFilters(filters, currentUser);
  const [list, summary, options] = await Promise.all([
    fetchDashboardEvaluations(supabaseAdmin, scoped),
    fetchDashboardSummary(supabaseAdmin, scoped),
    fetchDashboardOptions(supabaseAdmin, {
      departmentId: currentUser.role === 'admin' ? null : currentUser.department_id,
      employeeId: currentUser.role === 'team_member' ? currentUser.id : null,
    }),
  ]);
  return {
    evaluations: list.rows,
    summary,
    options,
    pagination: {
      page: list.page,
      pageSize: list.pageSize,
      totalCount: list.count,
      totalPages: Math.max(Math.ceil(list.count / list.pageSize), 1),
    },
  };
}

export async function getEvaluationDashboardDetail(supabaseAdmin, evaluationId, currentUser) {
  assertActive(currentUser);
  optionalUuid(evaluationId, 'Evaluation id');
  const evaluation = await fetchEvaluationDetail(supabaseAdmin, evaluationId);
  if (!canReadEvaluation(currentUser, evaluation)) {
    const error = new Error('You do not have access to this employee evaluation.');
    error.statusCode = 403;
    throw error;
  }
  const sourceRecords = await fetchEvaluationDetailSources(supabaseAdmin, evaluation);
  if (currentUser.role === 'team_member') {
    evaluation.stipend_recommendations = (evaluation.stipend_recommendations || []).filter(
      (recommendation) => ['recommended', 'approved', 'rejected', 'superseded'].includes(recommendation.status)
    );
    evaluation.review_comments = (evaluation.review_comments || []).filter(
      (comment) => comment.visibility === 'employee_visible'
    );
  }
  return {
    ...evaluation,
    source_records: sourceRecords,
    review_permissions: evaluationReviewPermissions(currentUser, evaluation),
  };
}
