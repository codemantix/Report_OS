import { useRouter } from 'next/router';
import { formatMonthYear, PRIORITY_COLORS, STATUS_COLORS } from '../../utils/companyGoalConstants';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from './Company.module.css';

/**
 * Renders a grid of strategic company goal cards.
 */
export default function CompanyGoalsTable({ goals = [] }) {
  const router = useRouter();

  if (goals.length === 0) {
    return (
      <div className={styles.emptyState}>
        <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
        <p className={styles.emptyText}>No company goals found.</p>
      </div>
    );
  }

  return (
    <div className={styles.goalsGrid}>
      {goals.map((goal) => {
        const outcomes = goal.expected_outcomes || [];
        const completedOutcomes = outcomes.filter((o) => o.completed).length;
        const outcomeProgress = outcomes.length > 0 ? Math.round((completedOutcomes / outcomes.length) * 100) : 0;
        const objectives = goal.objectives || [];

        return (
          <div
            key={goal.id}
            className={styles.goalCard}
            onClick={() => router.push(`/dashboard/company-goals/${goal.id}`)}
          >
            <div className={styles.goalCardHeader}>
              <div>
                <h3 className={styles.goalCardTitle}>{goal.title}</h3>
                <div className={styles.goalCardMeta}>
                  <span>{formatMonthYear(goal.month, goal.year)}</span>
                  {goal.owner && (
                    <>
                      <span>•</span>
                      <span>{getProfileDisplayName(goal.owner, 'Unassigned')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={`${styles.badge} ${PRIORITY_COLORS[goal.priority] || ''}`}>
                {goal.priority}
              </span>
              <span className={`${styles.badge} ${STATUS_COLORS[goal.status] || ''}`}>
                {goal.status?.replace(/_/g, ' ')}
              </span>
            </div>

            {goal.description && (
              <p className={styles.goalCardBody}>{goal.description}</p>
            )}

            {/* Outcome progress */}
            {outcomes.length > 0 && (
              <div className="mb-3">
                <div className={styles.progressLabel}>
                  <span>Outcomes</span>
                  <span>{completedOutcomes}/{outcomes.length}</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={outcomeProgress === 100 ? styles.progressFillSuccess : styles.progressFill}
                    style={{ width: `${outcomeProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className={styles.goalCardFooter}>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {objectives.length} objective{objectives.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {outcomes.length} outcome{outcomes.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
