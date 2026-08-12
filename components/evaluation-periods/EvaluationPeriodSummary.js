import { CalendarDays, CheckCircle2, Clock3, Users } from 'lucide-react';
import styles from './EvaluationPeriods.module.css';

export default function EvaluationPeriodSummary({ periods, totalCount }) {
  const active = periods.filter((period) => period.status === 'active').length;
  const review = periods.filter((period) => period.status === 'under_review').length;
  const employees = new Set(
    periods.flatMap((period) => (period.evaluations || []).map((evaluation) => evaluation.employee_id))
  ).size;
  const approved = periods.filter((period) => ['approved', 'closed'].includes(period.status)).length;
  const cards = [
    { label: 'Periods', value: totalCount, icon: CalendarDays },
    { label: 'Active', value: active, icon: Clock3 },
    { label: 'Under Review', value: review, icon: Users },
    { label: 'Approved / Closed', value: approved, icon: CheckCircle2, meta: `${employees} employees shown` },
  ];

  return (
    <section className={styles.summaryGrid} aria-label="Evaluation period summary">
      {cards.map(({ label, value, icon: Icon, meta }) => (
        <article key={label} className={styles.summaryCard}>
          <div className={styles.summaryIcon}><Icon aria-hidden="true" /></div>
          <div>
            <p>{label}</p>
            <strong>{value}</strong>
            {meta && <small>{meta}</small>}
          </div>
        </article>
      ))}
    </section>
  );
}
