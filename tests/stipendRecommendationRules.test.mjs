import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/stipendRecommendationRules.js', import.meta.url), 'utf8');
const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  calculateRecommendedPayment,
  currentStipendRecommendation,
  requiresManualStipendDecision,
  resolveBaseStipend,
  validateBaseStipendInput,
  validateRecommendationAction,
} = rules;

test('calculates recommended payment from configurable base and approved percentage', () => {
  assert.equal(calculateRecommendedPayment(1000, 90), 900);
  assert.equal(calculateRecommendedPayment('1234.56', '80'), 987.65);
  assert.throws(() => calculateRecommendedPayment(0, 90), /positive/);
  assert.throws(() => calculateRecommendedPayment(1000, 101), /between 0 and 100/);
});

test('below-60 and manual approved evaluations require manual stipend decisions', () => {
  assert.equal(requiresManualStipendDecision({ approved_score: 59.999, approved_stipend_mode: 'percentage' }), true);
  assert.equal(requiresManualStipendDecision({ approved_score: 75, approved_stipend_mode: 'manual' }), true);
  assert.equal(requiresManualStipendDecision({ approved_score: 75, approved_stipend_mode: 'percentage' }), false);
});

test('employee base overrides department and global configurations', () => {
  const evaluation = {
    employee_id: 'employee-1', department_id: 'department-1', period: { end_date: '2026-08-10' },
  };
  const configs = [
    { id: 'global', status: 'active', employee_id: null, department_id: null, effective_from: '2026-01-01' },
    { id: 'department', status: 'active', employee_id: null, department_id: 'department-1', effective_from: '2026-01-01' },
    { id: 'employee', status: 'active', employee_id: 'employee-1', department_id: null, effective_from: '2026-01-01' },
  ];
  assert.equal(resolveBaseStipend(configs, evaluation).id, 'employee');
});

test('base resolution respects evaluation-period dates and latest effective version', () => {
  const evaluation = {
    employee_id: 'employee-1', department_id: 'department-1', period: { end_date: '2026-08-10' },
  };
  const configs = [
    { id: 'old', status: 'active', employee_id: null, department_id: 'department-1', effective_from: '2026-01-01', effective_to: '2026-06-30' },
    { id: 'current', status: 'active', employee_id: null, department_id: 'department-1', effective_from: '2026-07-01' },
    { id: 'future', status: 'active', employee_id: 'employee-1', department_id: null, effective_from: '2026-09-01' },
  ];
  assert.equal(resolveBaseStipend(configs, evaluation).id, 'current');
});

test('rejected recommendations do not block a revised current recommendation', () => {
  assert.equal(currentStipendRecommendation({
    stipend_recommendations: [{ id: 'rejected', version: 1, status: 'rejected' }],
  }), null);
});

test('current recommendation uses latest non-cancelled version', () => {
  const evaluation = { stipend_recommendations: [
    { id: 'v1', version: 1, status: 'superseded' },
    { id: 'v2', version: 2, status: 'recommended' },
  ] };
  assert.equal(currentStipendRecommendation(evaluation).id, 'v2');
});

test('base stipend validation prevents invalid money, currency, dates, and ambiguous scope', () => {
  const valid = validateBaseStipendInput({
    name: 'Department base', amount: '1500.50', currency: 'ngn',
    effectiveFrom: '2026-08-01', departmentId: 'department-1',
  });
  assert.equal(valid.amount, 1500.5);
  assert.equal(valid.currency, 'NGN');
  assert.throws(() => validateBaseStipendInput({
    name: 'Invalid', amount: 100, currency: 'USD', effectiveFrom: '2026-08-01',
    departmentId: 'department-1', employeeId: 'employee-1',
  }), /either a department or employee/);
  assert.throws(() => validateBaseStipendInput({
    name: 'Invalid date', amount: 100, currency: 'USD', effectiveFrom: '2026-02-31',
  }), /must be valid/);
  assert.throws(() => validateBaseStipendInput({
    name: 'Invalid status', amount: 100, currency: 'USD', effectiveFrom: '2026-08-01', status: 'disabled',
  }), /active or inactive/);
});

test('recommendation actions require their action-specific identifier and allow zero final amount', () => {
  assert.throws(() => validateRecommendationAction({ action: 'create' }), /Evaluation is required/);
  assert.throws(() => validateRecommendationAction({ action: 'approve' }), /recommendation is required/);
  const approval = validateRecommendationAction({
    action: 'approve', recommendationId: 'recommendation-1', finalAmount: 0,
  });
  assert.equal(approval.finalAmount, 0);
});
