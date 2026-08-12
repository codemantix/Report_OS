import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/auditEventClassification.js', import.meta.url), 'utf8');
const utils = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { classifyAuditEvent, changedAuditFields, prettifyAuditField, formatAuditValue } = utils;

function evaluation(values = {}) {
  return {
    employee_evaluation: {
      status: 'scoring',
      current_approval_status: 'not_started',
      overall_score: null,
      calculation_status: 'not_calculated',
      calculation_revision: 0,
      approved_score: null,
      approved_stipend_percentage: null,
      approved_performance_band: null,
      ...values,
    },
  };
}

test('evaluation generation is classified from an insert', () => {
  assert.equal(classifyAuditEvent('employee_evaluation', 'insert', {}, evaluation().employee_evaluation), 'evaluation_generated');
});

test('evaluation recalculation is detected from calculation field changes', () => {
  const before = evaluation({ overall_score: null, calculation_status: 'incomplete' }).employee_evaluation;
  const after = evaluation({ overall_score: 82.5, calculation_status: 'complete', calculation_revision: 1 }).employee_evaluation;
  assert.equal(classifyAuditEvent('employee_evaluation', 'update', before, after), 'evaluation_recalculated');
});

test('component raw score changes count as recalculation', () => {
  assert.equal(
    classifyAuditEvent('component_score', 'update', { raw_score: null }, { raw_score: 88 }),
    'evaluation_recalculated'
  );
  assert.equal(classifyAuditEvent('component_score', 'update', { raw_score: 88 }, { raw_score: 88 }), 'record_updated');
});

test('approval is detected from evaluation status transition to approved', () => {
  const before = evaluation({ status: 'pending_approval', current_approval_status: 'pending' }).employee_evaluation;
  const after = evaluation({ status: 'approved', current_approval_status: 'approved' }).employee_evaluation;
  assert.equal(classifyAuditEvent('employee_evaluation', 'update', before, after), 'approval');
});

test('returned for review is detected from current_approval_status changes', () => {
  const before = evaluation({ current_approval_status: 'pending', status: 'pending_approval' }).employee_evaluation;
  const after = evaluation({ current_approval_status: 'changes_requested', status: 'scoring' }).employee_evaluation;
  assert.equal(classifyAuditEvent('employee_evaluation', 'update', before, after), 'returned_for_review');
});

test('manual adjustment is detected from approved result projection changes', () => {
  const before = evaluation({ approved_score: 80 }).employee_evaluation;
  const after = evaluation({ approved_score: 84 }).employee_evaluation;
  assert.equal(classifyAuditEvent('employee_evaluation', 'update', before, after), 'manual_adjustment');
});

test('approval with a score adjustment is classified as manual adjustment', () => {
  assert.equal(
    classifyAuditEvent('evaluation_approval', 'update', { status: 'pending' }, { status: 'approved', score_adjustment: 3 }),
    'manual_adjustment'
  );
  assert.equal(
    classifyAuditEvent('evaluation_approval', 'update', { status: 'pending' }, { status: 'approved', score_adjustment: 0 }),
    'approval'
  );
});

test('review round insert is manager review; comment insert is manager feedback', () => {
  assert.equal(classifyAuditEvent('evaluation_review_round', 'insert', {}, {}), 'manager_review');
  assert.equal(classifyAuditEvent('evaluation_review_comment', 'insert', {}, {}), 'manager_feedback');
});

test('stipend adjustment is detected from final amount changes', () => {
  const before = { status: 'recommended', final_approved_amount: null, amount_adjustment: null };
  const after = { status: 'approved', final_approved_amount: 480, amount_adjustment: -20 };
  assert.equal(classifyAuditEvent('stipend_recommendation', 'update', before, after), 'stipend_adjustment');
  assert.equal(
    classifyAuditEvent('stipend_recommendation', 'update', { status: 'recommended' }, { status: 'approved' }),
    'stipend_approved'
  );
});

test('payment lifecycle events are classified by status transitions', () => {
  assert.equal(classifyAuditEvent('payment', 'update', { status: 'pending' }, { status: 'approved' }), 'payment_approved');
  assert.equal(classifyAuditEvent('payment', 'update', { status: 'pending' }, { status: 'held' }), 'payment_held');
  assert.equal(classifyAuditEvent('payment', 'update', { status: 'approved' }, { status: 'paid' }), 'payment_marked_paid');
  assert.equal(classifyAuditEvent('payment', 'update', { status: 'held' }, { status: 'pending' }), 'payment_released');
});

test('generic fallbacks cover non-classified changes', () => {
  assert.equal(classifyAuditEvent('attendance', 'insert', {}, {}), 'attendance_recorded');
  assert.equal(classifyAuditEvent('evaluation_period', 'update', { status: 'draft' }, { status: 'active' }), 'period_status_changed');
  assert.equal(classifyAuditEvent('stipend_base_config', 'insert', {}, {}), 'base_config_created');
  assert.equal(classifyAuditEvent('employee_evaluation', 'update', { summary: 'a' }, { summary: 'b' }), 'record_updated');
  assert.equal(classifyAuditEvent('employee_evaluation', 'delete', {}, {}), 'record_deleted');
});

test('changedAuditFields reports only differing fields with before/after values', () => {
  const changes = changedAuditFields({ status: 'pending', score: 1 }, { status: 'approved', score: 1 });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, 'status');
  assert.equal(changes[0].oldValue, 'pending');
  assert.equal(changes[0].newValue, 'approved');
  assert.equal(changedAuditFields({ a: 1 }, { a: 1 }).length, 0);
});

test('display helpers format values and fields safely', () => {
  assert.equal(prettifyAuditField('final_approved_amount'), 'Final Approved Amount');
  assert.equal(formatAuditValue(null), '—');
  assert.equal(formatAuditValue('paid'), 'paid');
  assert.equal(formatAuditValue({ a: 1 }), '{"a":1}');
});
