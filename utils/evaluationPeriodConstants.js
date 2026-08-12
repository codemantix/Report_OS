export const EVALUATION_PERIOD_STATUSES = Object.freeze([
  'draft',
  'active',
  'under_review',
  'approved',
  'closed',
  'cancelled',
]);

export const EVALUATION_PERIOD_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  active: 'Active',
  under_review: 'Under Review',
  approved: 'Approved',
  closed: 'Closed',
  cancelled: 'Cancelled',
});

export const EVALUATION_PERIOD_TRANSITIONS = Object.freeze({
  draft: [
    { status: 'active', label: 'Activate' },
  ],
  active: [
    { status: 'under_review', label: 'Start Review' },
  ],
  under_review: [
    { status: 'active', label: 'Return to Active' },
    { status: 'approved', label: 'Approve Period' },
  ],
  approved: [
    { status: 'closed', label: 'Close Period' },
  ],
  closed: [],
  cancelled: [],
});

export function canManageEvaluationPeriods(role) {
  return role === 'admin' || role === 'department_lead';
}
