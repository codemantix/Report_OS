import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../utils/evaluationPeriodValidation.js', import.meta.url),
  'utf8'
);
const validation = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const {
  addUtcDays,
  hasEvaluationPeriodErrors,
  normalizeEvaluationPeriodPayload,
  validateEvaluationPeriod,
} = validation;

function validPeriod(overrides = {}) {
  return {
    title: 'August Cycle 1',
    department_id: '10000000-0000-4000-8000-000000000001',
    start_date: '2026-08-03',
    end_date: '2026-08-16',
    evaluation_deadline: '2026-08-19T17:00:00.000Z',
    employee_ids: ['20000000-0000-4000-8000-000000000001'],
    ...overrides,
  };
}

test('accepts an inclusive 14-day period with employees and a later deadline', () => {
  assert.deepEqual(validateEvaluationPeriod(validPeriod()), {});
});

test('rejects periods that are not exactly 14 inclusive days', () => {
  const errors = validateEvaluationPeriod(validPeriod({ end_date: '2026-08-15' }));
  assert.match(errors.end_date, /exactly 14 days/i);
});

test('rejects an evaluation deadline before the period end', () => {
  const errors = validateEvaluationPeriod(validPeriod({
    evaluation_deadline: '2026-08-15T17:00:00.000Z',
  }));
  assert.match(errors.evaluation_deadline, /cannot be before/i);
});

test('rejects calendar-invalid date strings instead of normalizing them', () => {
  const errors = validateEvaluationPeriod(validPeriod({ start_date: '2026-02-31' }));
  assert.match(errors.start_date, /valid start date/i);
});

test('rejects malformed department and employee identifiers', () => {
  const errors = validateEvaluationPeriod(validPeriod({
    department_id: 'not-a-uuid',
    employee_ids: ['not-a-uuid'],
  }));
  assert.match(errors.department_id, /valid department/i);
  assert.match(errors.employee_ids, /valid identifier/i);
});

test('requires at least one applicable employee', () => {
  const errors = validateEvaluationPeriod(validPeriod({ employee_ids: [] }));
  assert.match(errors.employee_ids, /at least one/i);
  assert.equal(hasEvaluationPeriodErrors(errors), true);
});

test('normalizes title employees and deadline without changing period dates', () => {
  const payload = normalizeEvaluationPeriodPayload(validPeriod({
    title: '  August Cycle 1  ',
    employee_ids: [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
    ],
  }));
  assert.equal(payload.title, 'August Cycle 1');
  assert.deepEqual(payload.employee_ids, [
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
  ]);
  assert.equal(payload.start_date, '2026-08-03');
  assert.equal(payload.end_date, '2026-08-16');
});

test('malformed API values normalize safely for structured validation', () => {
  const payload = normalizeEvaluationPeriodPayload({
    title: null,
    evaluation_deadline: 'not-a-date',
    employee_ids: 'not-an-array',
  });
  assert.equal(payload.evaluation_deadline, null);
  assert.deepEqual(payload.employee_ids, []);
});

test('adds UTC days without local timezone date drift', () => {
  assert.equal(addUtcDays('2026-08-03', 13), '2026-08-16');
});
