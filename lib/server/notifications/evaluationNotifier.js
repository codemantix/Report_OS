import { getResendClient } from '../../resendClient.js';
import {
  EVALUATION_NOTIFICATION_TYPES,
  attendanceInputsMissing,
  canNotifyUser,
  isDuplicateNotification,
  notificationDestination,
  periodRecipients,
  reportingInputsMissing,
  reviewRecipients,
} from '../../../utils/evaluationNotificationRules.js';
import { buildEvaluationNotificationEmail } from '../../../utils/evaluationEmailTemplates.js';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL
  || process.env.FROM_EMAIL
  || 'hello@codemantixcollective.com';
const APP_URL = process.env.APP_URL || 'https://report.codemantixcollective.com/';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Codemantix Report OS';

function notifierError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

// Fetch previously sent notification logs for the same (type, entity) scope so
// the dispatcher can skip duplicates. RLS is bypassed intentionally here: the
// dispatcher runs with the trusted service-role client.
async function fetchSentLogs(supabaseAdmin, { type, entityType, entityId }) {
  if (!type || !entityType || !entityId) return [];
  const result = await supabaseAdmin
    .from('email_logs')
    .select('notification_type, entity_type, entity_id, user_id, status')
    .eq('notification_type', type)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'sent')
    .limit(500);
  if (result.error) {
    console.warn('Evaluation notification dedupe lookup failed:', result.error.message);
    return [];
  }
  return result.data || [];
}

function logResult(supabaseAdmin, {
  type,
  entityType,
  entityId,
  periodId,
  evaluationId,
  recipient,
  subject,
  status,
  providerResponse,
}) {
  return supabaseAdmin.from('email_logs').insert([{
    notification_type: type,
    entity_type: entityType,
    entity_id: entityId,
    period_id: periodId || null,
    evaluation_id: evaluationId || null,
    user_id: recipient.id,
    email: recipient.email,
    subject,
    status,
    provider_response: providerResponse || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }]);
}

// Send one evaluation notification to one recipient. Returns a result summary;
// never throws — failures are logged so the main evaluation flow is unaffected.
// The optional sender parameter (defaulting to the shared Resend client) lets
// tests inject a deterministic fake without touching the real email pipeline.
export async function sendEvaluationNotification(supabaseAdmin, notification, sender = null) {
  const {
    type,
    entityType = 'employee_evaluation',
    entityId,
    periodId,
    evaluationId,
    recipient,
    context = {},
  } = notification;

  if (!type || !entityId || !recipient?.id) {
    return { type, recipientId: recipient?.id, status: 'skipped', reason: 'missing_arguments' };
  }
  if (!canNotifyUser(recipient)) {
    return { type, recipientId: recipient.id, status: 'skipped', reason: 'recipient_not_notifiable' };
  }

  try {
    const sentLogs = await fetchSentLogs(supabaseAdmin, { type, entityType, entityId });
    if (isDuplicateNotification(sentLogs, {
      type,
      entityType,
      entityId,
      recipientUserId: recipient.id,
    })) {
      return { type, recipientId: recipient.id, status: 'skipped', reason: 'duplicate' };
    }

    const destination = notificationDestination(type, { evaluationId });
    const email = buildEvaluationNotificationEmail({
      type,
      recipientName: recipient.full_name || recipient.display_name || 'there',
      period: context.period,
      evaluation: context.evaluation,
      departmentName: context.departmentName,
      ctaUrl: destination,
      details: context.details,
    });

    const resendClient = sender || getResendClient();
    if (!resendClient) {
      // Email delivery is not configured; log the intent so the anti-spam
      // guardrail still prevents duplicates once email is enabled.
      await logResult(supabaseAdmin, {
        type, entityType, entityId, periodId, evaluationId,
        recipient, subject: email.subject, status: 'skipped',
        providerResponse: { reason: 'resend_not_configured' },
      });
      return { type, recipientId: recipient.id, status: 'skipped', reason: 'resend_not_configured' };
    }

    const emailResponse = await resendClient.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: recipient.email,
      subject: email.subject,
      html: email.html,
    });

    const status = emailResponse?.error ? 'failed' : 'sent';
    await logResult(supabaseAdmin, {
      type, entityType, entityId, periodId, evaluationId,
      recipient, subject: email.subject, status,
      providerResponse: emailResponse?.error
        ? { message: emailResponse.error.message || 'Email send failed' }
        : { id: emailResponse?.data?.id || null },
    });
    return {
      type,
      recipientId: recipient.id,
      status,
      error: emailResponse?.error?.message || null,
    };
  } catch (error) {
    console.error('Evaluation notification dispatch failed:', error);
    try {
      await logResult(supabaseAdmin, {
        type, entityType, entityId, periodId, evaluationId,
        recipient, subject: 'Evaluation notification', status: 'failed',
        providerResponse: { message: error.message || 'Notification dispatch failed' },
      });
    } catch (logError) {
      console.error('Evaluation notification failure could not be logged:', logError);
    }
    return { type, recipientId: recipient.id, status: 'failed', error: error.message };
  }
}

// Resolve a user record (id, email, names, status) for a notification recipient.
export async function fetchNotificationRecipient(supabaseAdmin, userId) {
  if (!userId) return null;
  const result = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, display_name, status, role, department_id')
    .eq('id', userId)
    .single();
  if (result.error || !result.data) return null;
  return result.data;
}

// Fetch active management users of a department (department lead + admins).
export async function fetchDepartmentReviewers(supabaseAdmin, departmentId) {
  const result = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, display_name, status, role, department_id')
    .eq('status', 'active')
    .limit(1000);
  if (result.error || !result.data) return [];
  return (result.data || []).filter((user) => (
    user.role === 'admin'
    || (user.role === 'department_lead' && user.department_id === departmentId)
  ));
}

const EVALUATION_CONTEXT_SELECT = `
  id,
  employee_id,
  department_id,
  evaluation_period_id,
  employee_name_snapshot,
  department_name_snapshot,
  employee:employee_id (id, email, full_name, display_name, status, role),
  period:evaluation_period_id (id, name, start_date, end_date, evaluation_deadline, status)
`;

async function fetchEvaluationContext(supabaseAdmin, evaluationId) {
  if (!evaluationId) return null;
  const result = await supabaseAdmin
    .from('employee_evaluations')
    .select(EVALUATION_CONTEXT_SELECT)
    .eq('id', evaluationId)
    .single();
  if (result.error || !result.data) return null;
  return result.data;
}

// Evaluation context for a stipend recommendation (used after approval).
export async function fetchRecommendationEvaluation(supabaseAdmin, recommendationId) {
  if (!recommendationId) return null;
  const result = await supabaseAdmin
    .from('stipend_recommendations')
    .select('id, evaluation_id, status, recommended_amount, currency, final_approved_amount')
    .eq('id', recommendationId)
    .single();
  if (result.error || !result.data) return null;
  const evaluation = await fetchEvaluationContext(supabaseAdmin, result.data.evaluation_id);
  return evaluation ? { recommendation: result.data, evaluation } : null;
}

// Evaluation context for a payment tracking record (used after creation).
export async function fetchPaymentEvaluation(supabaseAdmin, paymentId) {
  if (!paymentId) return null;
  const result = await supabaseAdmin
    .from('payment_records')
    .select('id, evaluation_id, status, amount, currency, payment_reference')
    .eq('id', paymentId)
    .single();
  if (result.error || !result.data) return null;
  const evaluation = await fetchEvaluationContext(supabaseAdmin, result.data.evaluation_id);
  return evaluation ? { payment: result.data, evaluation } : null;
}

export { notifierError };

// Dispatch multiple notifications in parallel. Never throws — each send is
// individually guarded and failures are logged. Returns a summary for tests.
export async function dispatchEvaluationNotifications(supabaseAdmin, notifications, sender = null) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, results: [] };
  }
  const results = await Promise.allSettled(
    notifications.map((notification) => sendEvaluationNotification(supabaseAdmin, notification, sender))
  );
  const normalized = results.map((result) => (
    result.status === 'fulfilled' ? result.value : { status: 'failed', error: result.reason?.message }
  ));
  return {
    sent: normalized.filter((item) => item.status === 'sent').length,
    skipped: normalized.filter((item) => item.status === 'skipped').length,
    failed: normalized.filter((item) => item.status === 'failed').length,
    results: normalized,
  };
}

// ---------------------------------------------------------------------------
// Notification builders (used by evaluation services after state changes)
// ---------------------------------------------------------------------------

// Employees of an evaluation period get a single "period opened" notification.
export function buildPeriodOpenedNotifications(period) {
  const recipients = periodRecipients(period);
  return recipients.map((recipient) => ({
    type: EVALUATION_NOTIFICATION_TYPES.periodOpened,
    entityType: 'evaluation_period',
    entityId: period.id,
    periodId: period.id,
    recipient,
    context: {
      period,
      departmentName: period.department?.name,
    },
  }));
}

// Missing report / missing attendance notifications for one evaluation.
export function buildMissingInputNotifications(evaluation, reportingBreakdown, attendanceBreakdown) {
  const notifications = [];
  if (reportingInputsMissing(reportingBreakdown)) {
    notifications.push({
      type: EVALUATION_NOTIFICATION_TYPES.reportMissing,
      entityType: 'employee_evaluation',
      entityId: evaluation.id,
      periodId: evaluation.evaluation_period_id,
      evaluationId: evaluation.id,
      recipient: evaluation.employee,
      context: {
        period: evaluation.period,
        evaluation,
        departmentName: evaluation.department_name_snapshot,
        details: `Missing reports: ${Number(reportingBreakdown?.submissionCompliance?.missingCount || 0)}.`,
      },
    });
  }
  if (attendanceInputsMissing(attendanceBreakdown)) {
    notifications.push({
      type: EVALUATION_NOTIFICATION_TYPES.attendanceMissing,
      entityType: 'employee_evaluation',
      entityId: evaluation.id,
      periodId: evaluation.evaluation_period_id,
      evaluationId: evaluation.id,
      recipient: evaluation.employee,
      context: {
        period: evaluation.period,
        evaluation,
        departmentName: evaluation.department_name_snapshot,
      },
    });
  }
  return notifications;
}

// Ready-for-review notification sent to department reviewers when an evaluation
// enters the pending approval state.
export async function buildReadyForReviewNotifications(supabaseAdmin, evaluation, { excludeUserId } = {}) {
  const reviewers = await fetchDepartmentReviewers(supabaseAdmin, evaluation.department_id);
  const recipients = reviewRecipients(reviewers, evaluation, { excludeUserId });
  return recipients.map((recipient) => ({
    type: EVALUATION_NOTIFICATION_TYPES.readyForReview,
    entityType: 'employee_evaluation',
    entityId: evaluation.id,
    periodId: evaluation.evaluation_period_id,
    evaluationId: evaluation.id,
    recipient,
    context: {
      period: evaluation.period,
      evaluation,
      departmentName: evaluation.department_name_snapshot,
    },
  }));
}

// Employee-facing notification builders.
export function buildEmployeeEvaluationNotification(type, evaluation, details) {
  return {
    type,
    entityType: 'employee_evaluation',
    entityId: evaluation.id,
    periodId: evaluation.evaluation_period_id,
    evaluationId: evaluation.id,
    recipient: evaluation.employee,
    context: {
      period: evaluation.period,
      evaluation,
      departmentName: evaluation.department_name_snapshot,
      details,
    },
  };
}

export function buildStipendApprovedNotification(evaluation, details) {
  return {
    type: EVALUATION_NOTIFICATION_TYPES.stipendApproved,
    entityType: 'employee_evaluation',
    entityId: evaluation.id,
    periodId: evaluation.evaluation_period_id,
    evaluationId: evaluation.id,
    recipient: evaluation.employee,
    context: {
      period: evaluation.period,
      evaluation,
      departmentName: evaluation.department_name_snapshot,
      details,
    },
  };
}

export function buildPaymentRecordedNotification(evaluation, details) {
  return {
    type: EVALUATION_NOTIFICATION_TYPES.paymentRecorded,
    entityType: 'employee_evaluation',
    entityId: evaluation.id,
    periodId: evaluation.evaluation_period_id,
    evaluationId: evaluation.id,
    recipient: evaluation.employee,
    context: {
      period: evaluation.period,
      evaluation,
      departmentName: evaluation.department_name_snapshot,
      details,
    },
  };
}
