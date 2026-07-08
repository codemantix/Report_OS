import styles from './Company.module.css';

/**
 * Small alignment card showing company goal alignment score and summary.
 * Reusable on report/task detail views.
 */
export default function CompanyAlignmentCard({ score, outcomeScore, summary, goalTitle }) {
  const hasData = score !== null && score !== undefined;

  if (!hasData && !goalTitle) return null;

  return (
    <div className={styles.alignmentCard}>
      <p className={styles.alignmentTitle}>Company Goal Alignment</p>

      {goalTitle && (
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          {goalTitle}
        </p>
      )}

      {hasData && (
        <div className="flex items-center gap-6 mb-2">
          <div>
            <p className={styles.alignmentScore}>{score}<span className="text-base font-normal" style={{ color: 'var(--color-muted)' }}>%</span></p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Alignment</p>
          </div>
          {outcomeScore !== null && outcomeScore !== undefined && (
            <div>
              <p className={styles.alignmentScore}>{outcomeScore}<span className="text-base font-normal" style={{ color: 'var(--color-muted)' }}>%</span></p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Outcome Progress</p>
            </div>
          )}
        </div>
      )}

      {summary && (
        <p className={styles.alignmentSummary}>{summary}</p>
      )}
    </div>
  );
}
