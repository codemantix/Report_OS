import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/evaluationReviewRules.js', import.meta.url), 'utf8');
const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { reviewPermissions, validateEvaluationReviewInput } = rules;

const classifyBand = (score) => ({
  label: score >= 90 ? 'Excellent' : score >= 80 ? 'Very Good' : 'Good',
});

function evaluation(overrides = {}) {
  return {
    id: 'evaluation-1',
    employee_id: 'employee-1',
    department_id: 'department-1',
    status: 'pending_approval',
    calculation_status: 'complete',
    overall_score: 82,
    calculated_stipend_percentage: 90,
    stipend_recommendation_mode: 'percentage',
    approvals: [],
    review_rounds: [],
    ...overrides,
  };
}

const lead = {
  id: 'lead-1', role: 'department_lead', status: 'active', department_id: 'department-1',
};
const admin = {
  id: 'admin-1', role: 'admin', status: 'active', department_id: null,
};

test('employees, inactive users, and cross-department leads cannot decide evaluations', () => {
  assert.equal(reviewPermissions({ ...lead, id: 'employee-1' }, evaluation()).canApprove, false);
  assert.equal(reviewPermissions({ ...lead, status: 'inactive' }, evaluation()).canApprove, false);
  assert.equal(reviewPermissions({ ...lead, department_id: 'other' }, evaluation()).canApprove, false);
});

test('stage assignment and role are enforced independently from read access', () => {
  const administration = evaluation({
    review_rounds: [{ id: 'round-1', round_number: 1, status: 'in_review' }],
    approvals: [{
      id: 'approval-2', review_round_id: 'round-1', sequence_number: 2,
      approval_stage: 'administration', status: 'pending', assigned_approver_id: null,
    }],
  });
  assert.equal(reviewPermissions(lead, administration).canApprove, false);
  assert.equal(reviewPermissions(lead, administration).canFeedback, true);
  assert.equal(reviewPermissions(admin, administration).canApprove, true);
  assert.equal(reviewPermissions({ ...admin, id: 'other-admin' }, evaluation({
    ...administration,
    approvals: [{ ...administration.approvals[0], assigned_approver_id: 'admin-1' }],
  })).canApprove, false);
});

test('feedback and return require text while feedback does not carry adjustment fields', () => {
  assert.throws(
    () => validateEvaluationReviewInput({ decision: 'feedback', feedback: ' ' }, evaluation(), classifyBand),
    /Feedback is required/
  );
  assert.throws(
    () => validateEvaluationReviewInput({ decision: 'return', feedback: '' }, evaluation(), classifyBand),
    /reason is required/
  );
  assert.deepEqual(
    validateEvaluationReviewInput({ decision: 'feedback', feedback: 'Useful note' }, evaluation(), classifyBand),
    { decision: 'feedback', feedback: 'Useful note', adjustmentReason: null }
  );
});

test('approval validates values, mode, precision, and mandatory adjustment reasons', () => {
  const unchanged = validateEvaluationReviewInput({
    decision: 'approve', finalScore: '82', stipendMode: 'percentage',
    finalStipendPercentage: '90', feedback: '', adjustmentReason: '',
  }, evaluation(), classifyBand);
  assert.equal(unchanged.finalScore, 82);
  assert.equal(unchanged.finalBand, 'Very Good');
  assert.equal(unchanged.finalStipendPercentage, 90);

  assert.throws(() => validateEvaluationReviewInput({
    decision: 'approve', finalScore: 101, stipendMode: 'percentage', finalStipendPercentage: 90,
  }, evaluation(), classifyBand), /between 0 and 100/);
  assert.throws(() => validateEvaluationReviewInput({
    decision: 'approve', finalScore: 82, stipendMode: 'invalid', finalStipendPercentage: 90,
  }, evaluation(), classifyBand), /percentage or manual/);
  assert.throws(() => validateEvaluationReviewInput({
    decision: 'approve', finalScore: 85, stipendMode: 'percentage', finalStipendPercentage: 90,
  }, evaluation(), classifyBand), /reason is required/);
  assert.throws(() => validateEvaluationReviewInput({
    decision: 'approve', finalScore: 82, stipendMode: 'manual', adjustmentReason: '',
  }, evaluation(), classifyBand), /reason is required/);

  const adjusted = validateEvaluationReviewInput({
    decision: 'approve', finalScore: '85.1239', stipendMode: 'manual',
    adjustmentReason: 'Manager reviewed the canonical evidence.',
  }, evaluation(), classifyBand);
  assert.equal(adjusted.finalScore, 85.124);
  assert.equal(adjusted.finalStipendPercentage, null);
});

test('linked monetary recommendation terms cannot be silently changed during approval', () => {
  const linked = evaluation({
    approvals: [{
      id: 'approval-1', sequence_number: 1, status: 'pending', approval_stage: 'department',
      stipend_recommendation_id: 'recommendation-1',
    }],
    stipend_recommendations: [{
      id: 'recommendation-1', status: 'recommended', recommendation_mode: 'percentage',
      recommended_percentage: 90,
    }],
  });
  assert.throws(() => validateEvaluationReviewInput({
    decision: 'approve', finalScore: 82, stipendMode: 'percentage',
    finalStipendPercentage: 80, adjustmentReason: 'Requested adjustment.',
  }, linked, classifyBand), /Revise the linked monetary recommendation/);
});

test('later stages use the current round proposal as their unchanged baseline', () => {
  const reviewed = evaluation({
    review_rounds: [{
      id: 'round-1', round_number: 1, status: 'in_review', proposed_score: 85,
      proposed_stipend_percentage: 80, proposed_stipend_mode: 'percentage',
    }],
  });
  const result = validateEvaluationReviewInput({
    decision: 'approve', finalScore: 85, stipendMode: 'percentage', finalStipendPercentage: 80,
  }, reviewed, classifyBand);
  assert.equal(result.adjustmentReason, null);
});
