import {
  fetchAuditCount,
  fetchAuditHistory,
  fetchAuditOptions,
} from './auditRepository';
import { auditCategory } from '../../../utils/auditConstants';
import { isUuid } from '../../../utils/evaluationPeriodValidation';

function auditError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function optionalUuid(value, label) {
  if (value && !isUuid(value)) throw auditError(`${label} is invalid.`);
  return value || null;
}

function optionalDate(value, label) {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw auditError(`${label} is invalid.`);
  return value || null;
}

function optionalEnum(value, allowed, label) {
  if (value && !allowed.includes(value)) throw auditError(`${label} is invalid.`);
  return value || null;
}

const ENTITY_TYPES = [
  'weight_config',
  'evaluation_period',
  'attendance',
  'employee_evaluation',
  'component_score',
  'stipend_recommendation',
  'evaluation_approval',
  'payment',
  'evaluation_review_round',
  'evaluation_review_comment',
  'stipend_base_config',
];

const EVENT_TYPES = [
  'evaluation_generated',
  'evaluation_recalculated',
  'record_created',
  'record_updated',
  'record_deleted',
  'approval',
  'manual_adjustment',
  'returned_for_review',
  'approval_rejected',
  'approval_cancelled',
  'approval_stage_created',
  'manager_review',
  'manager_feedback',
  'stipend_recommendation_created',
  'stipend_approved',
  'stipend_rejected',
  'stipend_superseded',
  'stipend_adjustment',
  'payment_record_created',
  'payment_approved',
  'payment_held',
  'payment_marked_paid',
  'payment_released',
  'attendance_recorded',
  'attendance_updated',
  'attendance_deleted',
  'period_created',
  'period_status_changed',
  'weight_config_created',
  'base_config_created',
];

function authorizeAuditReader(currentUser) {
  if (!currentUser || currentUser.status !== 'active') {
    throw auditError('An active account is required.', 403);
  }
  if (!['admin', 'department_lead', 'team_member'].includes(currentUser.role)) {
    throw auditError('You are not authorized to view audit history.', 403);
  }
}

export function scopeAuditFilters(currentUser, filters = {}) {
  authorizeAuditReader(currentUser);
  const scoped = {
    entityType: optionalEnum(filters.entityType, ENTITY_TYPES, 'Entity type'),
    eventType: optionalEnum(filters.eventType, EVENT_TYPES, 'Event type'),
    departmentId: optionalUuid(filters.departmentId, 'Department'),
    employeeId: optionalUuid(filters.employeeId, 'Employee'),
    actorId: optionalUuid(filters.actorId, 'Actor'),
    dateFrom: optionalDate(filters.dateFrom, 'Start date'),
    dateTo: optionalDate(filters.dateTo, 'End date'),
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (currentUser.role === 'department_lead') scoped.departmentId = currentUser.department_id;
  if (currentUser.role === 'team_member') {
    // Employees see only rows where they are the subject or actor; the
    // restrictive RLS policy enforces the same boundary at the database level.
    scoped.selfId = currentUser.id;
  }
  return scoped;
}

function buildSummary(count, rows) {
  const byCategory = {};
  (rows || []).forEach((row) => {
    const category = auditCategory(row.event_type);
    byCategory[category] = (byCategory[category] || 0) + 1;
  });
  return {
    total: count,
    categories: byCategory,
  };
}

function auditResponse(list, count, options, currentUser) {
  return {
    rows: list.rows,
    summary: buildSummary(count, list.rows),
    options,
    permissions: {
      canViewFullHistory: currentUser.role === 'admin',
      canFilterByDepartment: currentUser.role === 'admin',
    },
    pagination: {
      page: list.page,
      pageSize: list.pageSize,
      totalCount: list.count,
      totalPages: Math.max(Math.ceil(list.count / list.pageSize), 1),
    },
  };
}

export async function getAuditHistory(supabaseAdmin, filters, currentUser) {
  const scope = scopeAuditFilters(currentUser, filters);
  const selfFilter = scope.selfId
    ? { subjectId: scope.selfId, actorId: scope.selfId }
    : null;
  if (selfFilter) delete scope.selfId;
  const [list, count, options] = await Promise.all([
    fetchAuditHistory(supabaseAdmin, selfFilter ? { ...scope, selfFilter } : scope),
    fetchAuditCount(supabaseAdmin, selfFilter ? { ...scope, selfFilter } : scope),
    fetchAuditOptions(supabaseAdmin, {
      departmentId: currentUser.role === 'admin' ? null : currentUser.department_id,
    }),
  ]);
  return auditResponse(list, count, options, currentUser);
}
