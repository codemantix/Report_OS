import { BadgeCheck, CircleDollarSign, Clock3, PauseCircle, ReceiptText } from 'lucide-react';
import styles from './StipendPayments.module.css';

export default function PaymentTrackingSummary({ summary }) {
  const cards = [
    { label: 'Visible approved stipends', value: summary.visibleApprovedStipends, icon: ReceiptText },
    { label: 'Visible pending', value: summary.pending, icon: Clock3 },
    { label: 'Visible approved', value: summary.approved, icon: BadgeCheck },
    { label: 'Visible paid', value: summary.paid, icon: CircleDollarSign },
    { label: 'Visible held', value: summary.held, icon: PauseCircle },
  ];
  return <section className={styles.summary}>{cards.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon /></span><div><p>{label}</p><strong>{value || 0}</strong></div></article>)}</section>;
}
