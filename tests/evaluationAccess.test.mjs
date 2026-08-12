import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../lib/server/evaluations/evaluationAccess.js', import.meta.url),
  'utf8'
);
const access = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const { assertEvaluationPeriodCalculable } = access;

function evaluation(status, deadline) {
  return {
    period: {
      status,
      evaluation_deadline: deadline,
    },
  };
}

test('allows calculation during an active period before its deadline', () => {
  assert.doesNotThrow(() => assertEvaluationPeriodCalculable(
    evaluation('active', '2999-12-31T23:59:59.999Z'),
    'Employee evaluation'
  ));
});

test('allows calculation while a period is under review before its deadline', () => {
  assert.doesNotThrow(() => assertEvaluationPeriodCalculable(
    evaluation('under_review', '2999-12-31T23:59:59.999Z'),
    'Employee evaluation'
  ));
});

test('rejects calculation for draft approved or closed periods', () => {
  ['draft', 'approved', 'closed'].forEach((status) => {
    assert.throws(
      () => assertEvaluationPeriodCalculable(
        evaluation(status, '2999-12-31T23:59:59.999Z'),
        'Employee evaluation'
      ),
      /Active or Under Review/i
    );
  });
});

test('rejects calculation after the evaluation deadline', () => {
  assert.throws(
    () => assertEvaluationPeriodCalculable(
      evaluation('under_review', '2000-01-01T00:00:00.000Z'),
      'Employee evaluation'
    ),
    /after the evaluation deadline/i
  );
});
