import { Target, CheckCircle2, Building2, CheckSquare, FileText, Landmark } from 'lucide-react';
import styles from './Company.module.css';

/**
 * Dashboard-style summary cards showing company goal progress metrics.
 */
export default function CompanyProgressSummary({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      label: 'Active Goals',
      value: summary.activeGoals ?? 0,
      icon: Landmark,
      color: '#3B82F6',
    },
    {
      label: 'Outcomes Done',
      value: `${summary.completedOutcomes ?? 0}/${summary.totalOutcomes ?? 0}`,
      icon: CheckCircle2,
      color: '#10B981',
    },
    {
      label: 'Dept. Goals Linked',
      value: summary.linkedDepartmentGoals ?? 0,
      icon: Building2,
      color: '#8B5CF6',
    },
    {
      label: 'Tasks Connected',
      value: summary.linkedTasks ?? 0,
      icon: CheckSquare,
      color: '#F59E0B',
    },
    {
      label: 'Reports Connected',
      value: summary.linkedReports ?? 0,
      icon: FileText,
      color: '#06B6D4',
    },
    {
      label: 'Total Goals',
      value: summary.totalGoals ?? 0,
      icon: Target,
      color: '#EC4899',
    },
  ];

  return (
    <div className={styles.summaryGrid}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={styles.summaryCard}>
            <Icon className="w-5 h-5 mx-auto mb-2" style={{ color: card.color }} />
            <p className={styles.summaryValue}>{card.value}</p>
            <p className={styles.summaryLabel}>{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
