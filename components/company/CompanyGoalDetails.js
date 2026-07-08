import { formatMonthYear, PRIORITY_COLORS, STATUS_COLORS } from '../../utils/companyGoalConstants';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from './Company.module.css';

/**
 * Renders the full detail view for a company goal.
 * Includes overview grid, description, success metric, objectives, expected outcomes, and owner.
 */
export default function CompanyGoalDetails({ goal }) {
  if (!goal) return null;

  const objectives = goal.objectives || [];
  const outcomes = goal.expected_outcomes || [];
  const completedOutcomes = outcomes.filter((o) => o.completed).length;
  const outcomeProgress = outcomes.length > 0 ? Math.round((completedOutcomes / outcomes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Grid */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.detailGrid}>
          <div>
            <p className={styles.detailLabel}>Month / Year</p>
            <p className={styles.detailValue}>{formatMonthYear(goal.month, goal.year)}</p>
          </div>
          <div>
            <p className={styles.detailLabel}>Priority</p>
            <p className={styles.detailValue}>
              <span className={`${styles.badge} ${PRIORITY_COLORS[goal.priority] || ''}`}>
                {goal.priority}
              </span>
            </p>
          </div>
          <div>
            <p className={styles.detailLabel}>Status</p>
            <p className={styles.detailValue}>
              <span className={`${styles.badge} ${STATUS_COLORS[goal.status] || ''}`}>
                {goal.status?.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
          <div>
            <p className={styles.detailLabel}>Owner</p>
            <p className={styles.detailValue}>
              {goal.owner ? getProfileDisplayName(goal.owner, 'Unassigned') : 'Not assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {goal.description && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Description</h2>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
            {goal.description}
          </p>
        </div>
      )}

      {/* Success Metric */}
      {goal.success_metric && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Success Metric</h2>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
            {goal.success_metric}
          </p>
        </div>
      )}

      {/* Expected Summary */}
      {goal.expected_summary && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Expected Summary</h2>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
            {goal.expected_summary}
          </p>
        </div>
      )}

      {/* Objectives */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Objectives ({objectives.length})</h2>
        {objectives.length === 0 ? (
          <p className={styles.emptyText}>No objectives defined.</p>
        ) : (
          <div className="space-y-3">
            {objectives.map((obj, index) => (
              <div key={index} className={styles.listItem}>
                <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                  {index + 1}
                </div>
                <div className={styles.listItemFields}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{obj.title || 'Untitled'}</p>
                  {obj.description && (
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{obj.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expected Outcomes */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Expected Outcomes ({completedOutcomes}/{outcomes.length} completed)
        </h2>
        {outcomes.length > 0 && (
          <div className="mb-4">
            <div className={styles.progressBar}>
              <div
                className={outcomeProgress === 100 ? styles.progressFillSuccess : styles.progressFill}
                style={{ width: `${outcomeProgress}%` }}
              />
            </div>
          </div>
        )}
        {outcomes.length === 0 ? (
          <p className={styles.emptyText}>No expected outcomes defined.</p>
        ) : (
          <div className="space-y-2">
            {outcomes.map((outcome, index) => (
              <div key={index} className={styles.checklistItem}>
                <input
                  type="checkbox"
                  checked={outcome.completed || false}
                  readOnly
                  className={styles.checklistCheckbox}
                />
                <div>
                  <p className={`${styles.checklistTitle} ${outcome.completed ? styles.checklistDone : ''}`}>
                    {outcome.title || 'Untitled'}
                  </p>
                  {outcome.target && (
                    <p className={`${styles.checklistTarget} ${outcome.completed ? styles.checklistDone : ''}`}>
                      Target: {outcome.target}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
