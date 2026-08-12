import { CheckCircle2, Gauge, ListChecks, Users, WalletCards } from 'lucide-react';
import { displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

export default function EvaluationSummary({ summary }) {
  const cards = [
    { label: 'Evaluations', value: summary.totalEvaluations || 0, icon: Users },
    { label: 'Average Overall', value: displayScore(summary.averageOverallScore), suffix: '/100', icon: Gauge },
    { label: 'Complete', value: summary.completeEvaluations || 0, icon: ListChecks },
    { label: 'Approved', value: summary.approvedCount || 0, icon: CheckCircle2 },
    { label: 'Pending Approval', value: summary.pendingApprovalCount || 0, icon: WalletCards },
  ];
  return (
    <section className={styles.summaryGrid} aria-label="Evaluation summary">
      {cards.map(({ label, value, suffix, icon: Icon }) => (
        <article className={styles.summaryCard} key={label}>
          <span className={styles.summaryIcon}><Icon aria-hidden="true" /></span>
          <div><p>{label}</p><strong>{value}{suffix}</strong></div>
        </article>
      ))}
    </section>
  );
}
