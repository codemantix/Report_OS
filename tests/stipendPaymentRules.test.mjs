import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/stipendPaymentRules.js', import.meta.url), 'utf8');
const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { currentPaymentRecord, validatePaymentTrackingAction } = rules;

test('selects the latest internal payment tracking record without inventing one', () => {
  assert.equal(currentPaymentRecord({ payment_records: [] }), null);
  const latest = currentPaymentRecord({ payment_records: [
    { id: 'old', created_at: '2026-08-01T10:00:00Z' },
    { id: 'new', created_at: '2026-08-02T10:00:00Z' },
  ] });
  assert.equal(latest.id, 'new');
});

test('requires action-specific recommendation and payment identifiers', () => {
  assert.throws(() => validatePaymentTrackingAction({ action: 'create' }), /recommendation is required/);
  assert.throws(() => validatePaymentTrackingAction({ action: 'approve' }), /record is required/);
  assert.equal(validatePaymentTrackingAction({ action: 'create', recommendationId: 'rec-1' }).action, 'create');
});

test('hold actions require a reason', () => {
  assert.throws(() => validatePaymentTrackingAction({
    action: 'hold', paymentId: 'payment-1', reason: ' ',
  }), /reason is required/);
  const result = validatePaymentTrackingAction({
    action: 'hold', paymentId: 'payment-1', reason: 'Awaiting accounting confirmation.',
  });
  assert.equal(result.reason, 'Awaiting accounting confirmation.');
});

test('paid actions require a valid date and payment reference', () => {
  assert.throws(() => validatePaymentTrackingAction({
    action: 'paid', paymentId: 'payment-1', paymentDate: '2026-02-31', paymentReference: 'REF-1',
  }), /must be valid/);
  assert.throws(() => validatePaymentTrackingAction({
    action: 'paid', paymentId: 'payment-1', paymentDate: '2026-08-10', paymentReference: ' ',
  }), /reference is required/);
  const result = validatePaymentTrackingAction({
    action: 'paid', paymentId: 'payment-1', paymentDate: '2026-08-10',
    paymentReference: 'PAY-2026-001', notes: 'Recorded from internal ledger.',
  });
  assert.equal(result.paymentDate, '2026-08-10');
  assert.throws(() => validatePaymentTrackingAction({
    action: 'paid', paymentId: 'payment-1', paymentDate: '2999-01-01', paymentReference: 'REF-FUTURE',
  }), /cannot be in the future/);
  assert.equal(result.paymentReference, 'PAY-2026-001');
});

test('only supported internal actions are accepted', () => {
  assert.throws(() => validatePaymentTrackingAction({ action: 'refund', paymentId: 'payment-1' }), /must be create, approve, hold, paid, or release/);
  assert.equal(validatePaymentTrackingAction({ action: 'release', paymentId: 'payment-1' }).action, 'release');
});
