export const PERFORMANCE_BANDS = Object.freeze([
  'Excellent',
  'Very Good',
  'Good',
  'Needs Improvement',
  'Review Required',
]);

export const EVALUATION_APPROVAL_STATUSES = Object.freeze([
  'not_started',
  'pending',
  'approved',
  'rejected',
  'changes_requested',
  'cancelled',
]);

export const EVALUATION_STATUS_LABELS = Object.freeze({
  not_started: 'Not Started',
  pending: 'Pending',
  changes_requested: 'Changes Requested',
  draft: 'Draft',
  scoring: 'Scoring',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  finalized: 'Finalized',
  cancelled: 'Cancelled',
});

export const COMPONENT_LABELS = Object.freeze({
  task_performance: 'Task Performance',
  reporting_performance: 'Reporting Performance',
  attendance: 'Attendance',
});

export function componentScore(evaluation, component) {
  const row = (evaluation.component_scores || []).find((score) => score.component === component);
  return row?.raw_score === null || row?.raw_score === undefined ? null : Number(row.raw_score);
}

export function currentApproval(evaluation) {
  const rounds = [...(evaluation.review_rounds || [])]
    .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));
  const currentRoundId = rounds[0]?.id;
  const approvals = (evaluation.approvals || []).filter((approval) => (
    !currentRoundId || !approval.review_round_id || approval.review_round_id === currentRoundId
  ));
  return approvals.find((approval) => approval.status === 'pending')
    || [...approvals].sort((a, b) => Number(b.sequence_number || 0) - Number(a.sequence_number || 0))[0]
    || null;
}

export function humanApprovalStatus(evaluation) {
  if (evaluation.current_approval_status) return evaluation.current_approval_status;
  const currentRound = [...(evaluation.review_rounds || [])]
    .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0))[0];
  if (currentRound) return currentRound.status === 'in_review' ? 'pending' : currentRound.status;
  return currentApproval(evaluation)?.status || 'not_started';
}

export function displayScore(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(1);
}
