import { Banknote, CircleDollarSign } from 'lucide-react';
import styles from './MyPerformance.module.css';

function money(currency, amount) {
  return amount === null || amount === undefined
    ? '—'
    : `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MyCompensationStatus({ compensation }) {
  if (!compensation) return null;
  return <section className={styles.compensation}><div className={styles.sectionHeader}><div><h2>Stipend and payment status</h2><p>Only your issued recommendation and high-level payment status are shown.</p></div><Banknote /></div><div className={styles.compensationGrid}><article><span><Banknote /></span><div><small>Stipend recommendation</small><strong>{compensation.stipend.status}</strong><p>{compensation.stipend.recommendation_mode === 'manual' ? 'Manual decision' : `${Number(compensation.stipend.recommended_percentage)}% recommendation`}</p><p>{money(compensation.stipend.currency, compensation.stipend.final_approved_amount ?? compensation.stipend.recommended_amount)}</p></div></article><article><span><CircleDollarSign /></span><div><small>Payment tracking</small><strong>{compensation.payment?.status || 'Not started'}</strong><p>{compensation.payment ? money(compensation.payment.currency, compensation.payment.amount) : 'No payment record has been issued.'}</p>{compensation.payment?.payment_date && <p>Payment date: {compensation.payment.payment_date}</p>}</div></article></div></section>;
}
