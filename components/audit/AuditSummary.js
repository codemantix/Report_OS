import { Activity, BadgeCheck, Banknote, MessageSquare, ReceiptText, Scale } from 'lucide-react';
import { AUDIT_CATEGORY_LABELS } from '../../utils/auditConstants';
import styles from './Audit.module.css';

const CATEGORY_ICONS = {
  evaluation: Scale,
  review: MessageSquare,
  stipend: Banknote,
  payment: ReceiptText,
  attendance: Activity,
  period: Activity,
  config: Activity,
  other: Activity,
};

export default function AuditSummary({ summary }) {
  const categories = Object.entries(summary?.categories || {})
    .sort(([left], [right]) => (summary.categories[right] || 0) - (summary.categories[left] || 0));

  const primary = categories[0]?.[0] || 'other';
  const PrimaryIcon = CATEGORY_ICONS[primary] || Activity;

  return (
    <section className={styles.summary}>
      <article>
        <span><PrimaryIcon /></span>
        <div><p>Total audit records</p><strong>{summary?.total || 0}</strong></div>
      </article>
      {categories.slice(0, 4).map(([category, count]) => {
        const Icon = CATEGORY_ICONS[category] || Activity;
        return (
          <article key={category}>
            <span><Icon /></span>
            <div><p>{AUDIT_CATEGORY_LABELS[category] || category}</p><strong>{count}</strong></div>
          </article>
        );
      })}
      {categories.length === 0 && (
        <article>
          <span><BadgeCheck /></span>
          <div><p>Category breakdown</p><strong>0</strong></div>
        </article>
      )}
    </section>
  );
}
