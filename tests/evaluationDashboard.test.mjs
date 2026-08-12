import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/evaluationDashboardConstants.js', import.meta.url), 'utf8');
const dashboard = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { componentScore, currentApproval, displayScore, humanApprovalStatus } = dashboard;

test('reads real component rows without inventing missing scores', () => {
  const evaluation = { component_scores: [{ component: 'task_performance', raw_score: '82.5' }] };
  assert.equal(componentScore(evaluation, 'task_performance'), 82.5);
  assert.equal(componentScore(evaluation, 'attendance'), null);
  assert.equal(displayScore(null), '—');
});

test('human approval status uses the current round instead of historical precedence', () => {
  assert.equal(humanApprovalStatus({ approvals: [] }), 'not_started');
  assert.equal(humanApprovalStatus({ current_approval_status: 'approved', approvals: [] }), 'approved');

  const evaluation = {
    review_rounds: [
      { id: 'round-2', round_number: 2, status: 'in_review' },
      { id: 'round-1', round_number: 1, status: 'changes_requested' },
    ],
    approvals: [
      { id: 'old-return', review_round_id: 'round-1', sequence_number: 1, status: 'changes_requested' },
      { id: 'current-pending', review_round_id: 'round-2', sequence_number: 1, status: 'pending' },
    ],
  };
  assert.equal(humanApprovalStatus(evaluation), 'pending');
  assert.equal(currentApproval(evaluation).id, 'current-pending');

  const reordered = {
    ...evaluation,
    approvals: [...evaluation.approvals].reverse(),
    review_rounds: [...evaluation.review_rounds].reverse(),
  };
  assert.equal(humanApprovalStatus(reordered), 'pending');
  assert.equal(currentApproval(reordered).id, 'current-pending');
});

test('a later successful round is not overridden by historical changes requested', () => {
  const evaluation = {
    review_rounds: [
      { id: 'round-1', round_number: 1, status: 'changes_requested' },
      { id: 'round-2', round_number: 2, status: 'approved' },
    ],
    approvals: [
      { review_round_id: 'round-1', sequence_number: 1, status: 'changes_requested' },
      { review_round_id: 'round-2', sequence_number: 1, status: 'approved' },
      { review_round_id: 'round-2', sequence_number: 2, status: 'approved' },
    ],
  };
  assert.equal(humanApprovalStatus(evaluation), 'approved');
});
