import { BadgeCheck, Calculator, Clock3, Users } from 'lucide-react';
import styles from './Stipends.module.css';

export default function StipendSummary({ summary }) {
  const cards = [
    { label: 'Visible approved evaluations', value: summary.approvedEvaluations, icon: Users },
    { label: 'Visible awaiting recommendation', value: summary.awaitingRecommendation, icon: Calculator },
    { label: 'Visible awaiting stipend approval', value: summary.awaitingApproval, icon: Clock3 },
    { label: 'Visible approved recommendations', value: summary.approvedRecommendations, icon: BadgeCheck },
  ];
  return <section className={styles.summaryGrid}>{cards.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon aria-hidden="true" /></span><div><p>{label}</p><strong>{value || 0}</strong></div></article>)}</section>;
}
