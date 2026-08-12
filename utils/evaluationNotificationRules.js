// Pure evaluation notification rules: who receives which notification, whether a
// notification is a duplicate, and where it should link. No database access, so
// these rules are unit-testable and shared by the server dispatcher.

export const EVALUATION_NOTIFICATION_TYPES = Object.freeze({
  periodOpened: 'period_opened',
  reportMissing: 'report_missing',
  attendanceMissing: 'attendance_missing',
  readyForReview: 'ready_for_review',
  returnedForReview: 'returned_for_review',
  approved: 'approved',
  stipendApproved: 'stipend_approved',
  paymentRecorded: 'payment_recorded',
  reportCommentAdded: 'report_comment_added',
});

export const NOTIFICATION_LABELS = Object.freeze({
  period_opened: 'Evaluation period opened',
  report_missing: 'Report missing',
  attendance_missing: 'Attendance information missing',
  ready_for_review: 'Evaluation ready for review',
  returned_for_review: 'Evaluation returned for review',
  approved: 'Evaluation approved',
  stipend_approved: 'Stipend approved',
  payment_recorded: 'Payment recorded',
  report_comment_added: 'New comment on your report',
});

export function canNotifyUser(user) {
  return Boolean(
    user
    && user.status === 'active'
    && typeof user.email === 'string'
    && user.email.includes('@')
  );
}

// Dedupe key: one successful notification per (type, entity, recipient).
export function notificationKey({ type, entityType, entityId, recipientUserId }) {
  return [type, entityType, entityId, recipientUserId].filter(Boolean).join(':');
}

// Given previously logged sent notifications, decide whether a new notification
// with the same key would be a duplicate.
export function isDuplicateNotification(sentLogs, criteria) {
  if (!criteria || !criteria.type) return false;
  const key = notificationKey(criteria);
  return Boolean((sentLogs || []).some((log) => {
    if (log.status !== 'sent' || log.notification_type !== criteria.type) return false;
    if (log.entity_type !== criteria.entityType) return false;
    if (log.entity_id !== criteria.entityId) return false;
    if (log.user_id !== criteria.recipientUserId) return false;
    return true;
  })) || key === '';
}

// Destination path for each notification type.
export function notificationDestination(type, { evaluationId, reportId } = {}) {
  switch (type) {
    case EVALUATION_NOTIFICATION_TYPES.periodOpened:
      return '/dashboard/evaluation-periods';
    case EVALUATION_NOTIFICATION_TYPES.reportMissing:
      return '/dashboard/submit-report';
    case EVALUATION_NOTIFICATION_TYPES.attendanceMissing:
      return '/dashboard/attendance';
    case EVALUATION_NOTIFICATION_TYPES.readyForReview:
    case EVALUATION_NOTIFICATION_TYPES.returnedForReview:
    case EVALUATION_NOTIFICATION_TYPES.approved:
      return evaluationId ? `/dashboard/evaluations/${evaluationId}` : '/dashboard/evaluations';
    case EVALUATION_NOTIFICATION_TYPES.stipendApproved:
    case EVALUATION_NOTIFICATION_TYPES.paymentRecorded:
      return '/dashboard/my-performance';
    case EVALUATION_NOTIFICATION_TYPES.reportCommentAdded:
      return reportId ? `/dashboard/reports/${reportId}` : '/dashboard/reports';
    default:
      return '/dashboard';
  }
}

// Employees who should be notified about a period opening: the applicable
// employees attached to the period's evaluations.
export function periodRecipients(period) {
  return ((period?.evaluations || [])
    .map((evaluation) => evaluation.employee)
    .filter(Boolean));
}

// Reviewers who should be notified that an evaluation is ready for review:
// the department lead of the evaluation department plus admins, excluding the
// actor who just performed the action.
export function reviewRecipients(users, evaluation, { excludeUserId } = {}) {
  return (users || []).filter((user) => {
    if (!canNotifyUser(user)) return false;
    if (excludeUserId && user.id === excludeUserId) return false;
    if (user.role === 'admin') return true;
    return user.role === 'department_lead'
      && user.department_id === evaluation?.department_id;
  });
}

// Missing report detection from the reporting performance breakdown.
export function reportingInputsMissing(breakdown) {
  const compliance = breakdown?.submissionCompliance;
  if (!compliance) return false;
  return Number(compliance.missingCount || 0) > 0;
}

// Missing attendance detection from the attendance performance breakdown.
export function attendanceInputsMissing(breakdown) {
  return Number(breakdown?.totalApplicableSessions || 0) === 0;
}
