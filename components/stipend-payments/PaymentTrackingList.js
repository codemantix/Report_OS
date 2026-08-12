import { useState } from 'react';
import { BadgeCheck, CircleDollarSign, LockKeyhole, PauseCircle, PlayCircle } from 'lucide-react';
import { STIPEND_PAYMENT_STATUS_LABELS } from '../../utils/stipendPaymentRules';
import styles from './StipendPayments.module.css';

function personName(person) {
  return person?.full_name || person?.display_name || person?.email || '—';
}

function employeeName(row) {
  return row.evaluation?.employee?.full_name
    || row.evaluation?.employee?.display_name
    || row.evaluation?.employee_name_snapshot;
}

function money(row) {
  return `${row.currency} ${Number(row.final_approved_amount).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export default function PaymentTrackingList({ rows, permissions, currentUserId, savingId, onAction }) {
  const [active, setActive] = useState(null);
  const [values, setValues] = useState({ paymentDate: '', paymentReference: '', notes: '', reason: '' });
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  function open(id, action) {
    setActive({ id, action });
    setValues({ paymentDate: '', paymentReference: '', notes: '', reason: '' });
    setError('');
  }

  async function submit(row) {
    const payment = row.current_payment;
    if (active.action === 'hold' && !values.reason.trim()) return setError('A hold reason is required.');
    if (active.action === 'paid' && (!values.paymentDate || !values.paymentReference.trim())) {
      return setError('Payment date and reference are required.');
    }
    const result = await onAction({
      action: active.action,
      recommendationId: active.action === 'create' ? row.id : undefined,
      paymentId: active.action === 'create' ? undefined : payment.id,
      paymentDate: values.paymentDate || undefined,
      paymentReference: values.paymentReference || undefined,
      notes: values.notes || undefined,
      reason: values.reason || undefined,
    });
    if (result?.error) setError(result.error.message);
    else setActive(null);
  }

  if (rows.length === 0) return <div className={styles.empty}><CircleDollarSign /><strong>No approved stipend decisions found</strong><p>Payment tracking records can originate only from approved evaluations and approved stipend recommendations.</p></div>;

  return <div className={styles.list}>{rows.map((row) => {
    const payment = row.current_payment;
    const status = row.payment_status;
    const isSaving = savingId === row.id || savingId === payment?.id;
    const isOwnPayment = row.evaluation?.employee_id === currentUserId;
    return <article className={styles.card} key={row.id}>
      <div className={styles.cardHeader}>
        <div className={styles.person}><span>{employeeName(row)?.slice(0, 1)?.toUpperCase()}</span><div><h3>{employeeName(row)}</h3><p>{row.evaluation?.department?.name || row.evaluation?.department_name_snapshot} · {row.evaluation?.period?.name}</p></div></div>
        <span className={`${styles.status} ${styles[`status_${status}`]}`}>{STIPEND_PAYMENT_STATUS_LABELS[status]}</span>
      </div>
      <div className={styles.detailGrid}>
        <div><span>Approved amount</span><strong>{money(row)}</strong></div>
        <div><span>Performance result</span><strong>{Number(row.evaluation?.approved_score).toFixed(1)}</strong><small>{row.evaluation?.approved_performance_band}</small></div>
        <div><span>Payment approved by</span><strong>{personName(payment?.payment_approver)}</strong><small>{payment?.approved_at ? new Date(payment.approved_at).toLocaleString() : 'Not approved'}</small></div>
        <div><span>Paid / recorded by</span><strong>{personName(payment?.payment_recorder)}</strong><small>{payment?.payment_date || 'Not recorded'}</small></div>
        <div><span>Payment reference</span><strong>{payment?.payment_reference || '—'}</strong></div>
      </div>
      {payment?.hold_reason && <div className={styles.holdNote}><strong>On hold</strong><p>{payment.hold_reason}</p><small>Recorded by {personName(payment.hold_actor)}</small></div>}
      {payment?.notes && <div className={styles.notes}><strong>Notes</strong><p>{payment.notes}</p></div>}

      {active?.id === row.id && <div className={styles.actionForm}>
        <h4>{active.action === 'create' ? 'Create pending tracking record' : active.action === 'approve' ? 'Approve payment' : active.action === 'hold' ? 'Place payment on hold' : active.action === 'release' ? 'Release payment hold' : 'Record payment as paid'}</h4>
        {active.action === 'paid' && <div className={styles.formGrid}><label><span>Payment date</span><input type="date" max={today} value={values.paymentDate} onChange={(event) => setValues((current) => ({ ...current, paymentDate: event.target.value }))} /></label><label><span>Payment reference</span><input maxLength="240" value={values.paymentReference} onChange={(event) => setValues((current) => ({ ...current, paymentReference: event.target.value }))} /></label></div>}
        {active.action === 'hold' && <label><span>Hold reason</span><textarea rows="3" maxLength="5000" value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} /></label>}
        <label><span>Notes</span><textarea rows="3" maxLength="5000" value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal payment note" /></label>
        {error && <p className={styles.formError}>{error}</p>}
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setActive(null)}>Cancel</button><button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => submit(row)}>{isSaving ? 'Saving…' : 'Confirm action'}</button></div>
      </div>}

      {!isOwnPayment && <div className={styles.actions}>
        {!payment && permissions.canCreate && <button type="button" onClick={() => open(row.id, 'create')}><CircleDollarSign /> Create pending record</button>}
        {payment?.status === 'pending' && permissions.canApprove && <button type="button" className={styles.approveButton} onClick={() => open(row.id, 'approve')}><BadgeCheck /> Approve payment</button>}
        {['pending', 'approved'].includes(payment?.status) && permissions.canHold && <button type="button" className={styles.holdButton} onClick={() => open(row.id, 'hold')}><PauseCircle /> Hold</button>}
        {payment?.status === 'held' && permissions.canApprove && <><button type="button" onClick={() => open(row.id, 'release')}><PlayCircle /> Release to pending</button><button type="button" className={styles.approveButton} onClick={() => open(row.id, 'approve')}><BadgeCheck /> Approve payment</button></>}
        {payment?.status === 'approved' && permissions.canMarkPaid && <button type="button" className={styles.paidButton} onClick={() => open(row.id, 'paid')}><LockKeyhole /> Mark as paid</button>}
      </div>}
    </article>;
  })}</div>;
}
