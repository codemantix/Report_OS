// Audit history display constants shared by the management audit interface.

export const AUDIT_ENTITY_TYPE_LABELS = Object.freeze({
  weight_config: 'Evaluation Weights',
  evaluation_period: 'Evaluation Period',
  attendance: 'Attendance',
  employee_evaluation: 'Employee Evaluation',
  component_score: 'Component Score',
  stipend_recommendation: 'Stipend Recommendation',
  evaluation_approval: 'Evaluation Approval',
  payment: 'Payment',
  evaluation_review_round: 'Review Round',
  evaluation_review_comment: 'Review Feedback',
  stipend_base_config: 'Base Stipend Config',
});

export const AUDIT_EVENT_TYPE_LABELS = Object.freeze({
  evaluation_generated: 'Evaluation Generated',
  evaluation_recalculated: 'Evaluation Recalculated',
  record_created: 'Record Created',
  record_updated: 'Record Updated',
  record_deleted: 'Record Deleted',
  approval: 'Approved',
  manual_adjustment: 'Manual Adjustment',
  returned_for_review: 'Returned for Review',
  approval_rejected: 'Approval Rejected',
  approval_cancelled: 'Approval Cancelled',
  approval_stage_created: 'Approval Stage Created',
  manager_review: 'Manager Review',
  manager_feedback: 'Manager Feedback',
  stipend_recommendation_created: 'Stipend Recommended',
  stipend_approved: 'Stipend Approved',
  stipend_rejected: 'Stipend Rejected',
  stipend_superseded: 'Stipend Superseded',
  stipend_adjustment: 'Stipend Adjusted',
  payment_record_created: 'Payment Record Created',
  payment_approved: 'Payment Approved',
  payment_held: 'Payment Held',
  payment_marked_paid: 'Payment Marked Paid',
  payment_released: 'Payment Released',
  attendance_recorded: 'Attendance Recorded',
  attendance_updated: 'Attendance Updated',
  attendance_deleted: 'Attendance Deleted',
  period_created: 'Period Created',
  period_status_changed: 'Period Status Changed',
  weight_config_created: 'Weights Created',
  base_config_created: 'Base Config Created',
});

// Broad category used for summary cards and filtering.
export const AUDIT_EVENT_CATEGORY = Object.freeze({
  evaluation_generated: 'evaluation',
  evaluation_recalculated: 'evaluation',
  manual_adjustment: 'evaluation',
  approval: 'evaluation',
  returned_for_review: 'evaluation',
  approval_rejected: 'evaluation',
  approval_cancelled: 'evaluation',
  approval_stage_created: 'evaluation',
  manager_review: 'review',
  manager_feedback: 'review',
  stipend_recommendation_created: 'stipend',
  stipend_approved: 'stipend',
  stipend_rejected: 'stipend',
  stipend_superseded: 'stipend',
  stipend_adjustment: 'stipend',
  payment_record_created: 'payment',
  payment_approved: 'payment',
  payment_held: 'payment',
  payment_marked_paid: 'payment',
  payment_released: 'payment',
  attendance_recorded: 'attendance',
  attendance_updated: 'attendance',
  attendance_deleted: 'attendance',
  period_created: 'period',
  period_status_changed: 'period',
  weight_config_created: 'config',
  base_config_created: 'config',
  record_created: 'other',
  record_updated: 'other',
  record_deleted: 'other',
});

export const AUDIT_CATEGORY_LABELS = Object.freeze({
  evaluation: 'Evaluation Actions',
  review: 'Review & Feedback',
  stipend: 'Stipend Actions',
  payment: 'Payment Actions',
  attendance: 'Attendance',
  period: 'Periods',
  config: 'Configuration',
  other: 'Other',
});

export function auditCategory(eventType) {
  return AUDIT_EVENT_CATEGORY[eventType] || 'other';
}

export function auditEntityLabel(entityType) {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] || entityType || 'Unknown';
}

export function auditEventLabel(eventType) {
  return AUDIT_EVENT_TYPE_LABELS[eventType] || eventType || 'Unknown';
}
