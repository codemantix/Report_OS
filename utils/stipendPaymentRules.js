export const STIPEND_PAYMENT_STATUSES = Object.freeze([
  'pending', 'approved', 'paid', 'held',
]);

export const STIPEND_PAYMENT_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  held: 'Held',
  not_started: 'Not Started',
});

export function currentPaymentRecord(recommendation) {
  return [...(recommendation?.payment_records || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

export function validatePaymentTrackingAction(input) {
  const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (!['create', 'approve', 'hold', 'paid', 'release'].includes(payload.action)) {
    throw new Error('Payment action must be create, approve, hold, paid, or release.');
  }
  if (payload.action === 'create' && !payload.recommendationId) {
    throw new Error('Approved stipend recommendation is required.');
  }
  if (payload.action !== 'create' && !payload.paymentId) {
    throw new Error('Payment tracking record is required.');
  }
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  const paymentReference = typeof payload.paymentReference === 'string'
    ? payload.paymentReference.trim()
    : '';
  const paymentDate = typeof payload.paymentDate === 'string' ? payload.paymentDate : '';
  if (notes.length > 5000 || reason.length > 5000) {
    throw new Error('Payment notes and reasons must be 5000 characters or fewer.');
  }
  if (payload.action === 'hold' && !reason) throw new Error('A reason is required when placing payment on hold.');
  if (payload.action === 'paid') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('Payment date is required.');
    const [year, month, day] = paymentDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('Payment date must be valid.');
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (date.getTime() > todayUtc) throw new Error('Payment date cannot be in the future.');
    if (!paymentReference) throw new Error('Payment reference is required.');
    if (paymentReference.length > 240) throw new Error('Payment reference must be 240 characters or fewer.');
  }
  return {
    action: payload.action,
    recommendationId: payload.recommendationId || null,
    paymentId: payload.paymentId || null,
    paymentDate: paymentDate || null,
    paymentReference: paymentReference || null,
    notes: notes || null,
    reason: reason || null,
  };
}
