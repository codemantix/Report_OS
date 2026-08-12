import { randomUUID } from 'crypto';
import { isUuid } from '../../../utils/evaluationPeriodValidation';
import {
  currentPaymentRecord,
  validatePaymentTrackingAction,
} from '../../../utils/stipendPaymentRules';
import {
  createPaymentTracking,
  fetchPaymentTrackingOptions,
  fetchPaymentTrackingRows,
  updatePaymentTracking,
} from './paymentRepository';
import {
  buildPaymentRecordedNotification,
  dispatchEvaluationNotifications,
  fetchPaymentEvaluation,
} from '../notifications/evaluationNotifier';

function paymentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertActiveUser(currentUser) {
  if (!currentUser || currentUser.status !== 'active'
    || !['admin', 'department_lead', 'team_member'].includes(currentUser.role)) {
    throw paymentError('You are not authorized to access stipend payment tracking.', 403);
  }
  if (currentUser.role === 'department_lead' && !currentUser.department_id) {
    throw paymentError('A department assignment is required.', 403);
  }
}

function optionalUuid(value, label) {
  if (value && !isUuid(value)) throw paymentError(`${label} is invalid.`);
  return value || null;
}

function scopeFilters(currentUser, filters = {}) {
  assertActiveUser(currentUser);
  const scoped = {
    departmentId: optionalUuid(filters.departmentId, 'Department'),
    employeeId: optionalUuid(filters.employeeId, 'Employee'),
    periodId: optionalUuid(filters.periodId, 'Evaluation period'),
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (currentUser.role === 'department_lead') scoped.departmentId = currentUser.department_id;
  if (currentUser.role === 'team_member') {
    scoped.employeeId = currentUser.id;
    scoped.departmentId = currentUser.department_id;
  }
  return scoped;
}

export async function getPaymentTracking(supabaseAdmin, filters, currentUser) {
  const scope = scopeFilters(currentUser, filters);
  const [list, options] = await Promise.all([
    fetchPaymentTrackingRows(supabaseAdmin, scope),
    fetchPaymentTrackingOptions(supabaseAdmin, {
      departmentId: currentUser.role === 'admin' ? null : currentUser.department_id,
      employeeId: currentUser.role === 'team_member' ? currentUser.id : null,
    }),
  ]);
  const rows = list.rows.map((recommendation) => {
    const payment = currentPaymentRecord(recommendation);
    return {
      ...recommendation,
      current_payment: payment,
      payment_status: payment?.status || 'not_started',
    };
  });
  return {
    rows,
    options,
    currentUserId: currentUser.id,
    permissions: {
      canCreate: currentUser.role === 'admin',
      canApprove: currentUser.role === 'admin',
      canHold: currentUser.role === 'admin',
      canMarkPaid: currentUser.role === 'admin',
    },
    summary: {
      visibleApprovedStipends: rows.length,
      pending: rows.filter((row) => row.payment_status === 'pending').length,
      approved: rows.filter((row) => row.payment_status === 'approved').length,
      paid: rows.filter((row) => row.payment_status === 'paid').length,
      held: rows.filter((row) => row.payment_status === 'held').length,
    },
    pagination: {
      page: list.page,
      pageSize: list.pageSize,
      totalCount: list.count,
      totalPages: Math.max(Math.ceil(list.count / list.pageSize), 1),
    },
  };
}

export async function managePaymentTracking(supabaseAdmin, input, currentUser) {
  assertActiveUser(currentUser);
  if (currentUser.role !== 'admin') {
    throw paymentError('Only administrators may change official stipend payment status.', 403);
  }
  let action;
  try {
    action = validatePaymentTrackingAction(input);
  } catch (error) {
    throw paymentError(error.message);
  }
  if (action.recommendationId) optionalUuid(action.recommendationId, 'Stipend recommendation');
  if (action.paymentId) optionalUuid(action.paymentId, 'Payment tracking record');
  if (action.action === 'create') {
    const paymentId = await createPaymentTracking(supabaseAdmin, {
      p_stipend_recommendation_id: action.recommendationId,
      p_actor_id: currentUser.id,
      p_notes: action.notes,
      p_request_id: randomUUID(),
    });

    // Notify the employee once per recorded payment. Delivery failures are
    // logged and never break the payment tracking response.
    try {
      const context = await fetchPaymentEvaluation(supabaseAdmin, paymentId);
      if (context) {
        await dispatchEvaluationNotifications(supabaseAdmin, [
          buildPaymentRecordedNotification(context.evaluation, context.payment?.amount != null
            ? `Recorded amount: ${context.payment.currency} ${context.payment.amount}.`
            : ''),
        ]);
      }
    } catch (error) {
      console.error('Payment-recorded notification could not be dispatched:', error);
    }
    return paymentId;
  }
  return updatePaymentTracking(supabaseAdmin, {
    p_payment_id: action.paymentId,
    p_action: action.action,
    p_actor_id: currentUser.id,
    p_payment_date: action.paymentDate,
    p_payment_reference: action.paymentReference,
    p_notes: action.notes,
    p_reason: action.reason,
    p_request_id: randomUUID(),
  });
}
