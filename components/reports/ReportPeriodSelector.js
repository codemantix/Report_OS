import { Calendar, Loader2 } from 'lucide-react';
import { formatPeriodLabel } from '../../utils/reportDateRange';
import styles from './ReportForm.module.css';

/**
 * Reporting period date selector with contextual badge and item counts.
 *
 * Props:
 *  - periodStart (string)     YYYY-MM-DD
 *  - periodEnd (string)       YYYY-MM-DD
 *  - onStartChange (fn)       called with YYYY-MM-DD string
 *  - onEndChange (fn)         called with YYYY-MM-DD string
 *  - goalsCount (number)
 *  - plansCount (number)
 *  - tasksCount (number)
 *  - loadingRelated (boolean) show spinner while data refetches
 *  - disabled (boolean)
 */
export default function ReportPeriodSelector({
  periodStart,
  periodEnd,
  onStartChange,
  onEndChange,
  goalsCount = 0,
  plansCount = 0,
  tasksCount = 0,
  loadingRelated = false,
  disabled = false,
  errors = {},
  submitted = false,
}) {
  const periodLabel = formatPeriodLabel(periodStart, periodEnd);

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Reporting Period</h2>

      {/* Period badge */}
      {periodLabel && (
        <div className={styles.periodBadge}>
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>{periodLabel}</span>
        </div>
      )}

      {/* Date pickers */}
      <div className={styles.periodRow}>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="report-period-start">Period Start</label>
          <input
            id="report-period-start"
            type="date"
            value={periodStart}
            onChange={(e) => onStartChange(e.target.value)}
            className={`${styles.input} ${errors.period_start && submitted ? styles.inputError : ''}`}
            disabled={disabled}
            required
          />
          {errors.period_start && submitted && <p className={styles.fieldError}>{errors.period_start}</p>}
        </div>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="report-period-end">Period End</label>
          <input
            id="report-period-end"
            type="date"
            value={periodEnd}
            onChange={(e) => onEndChange(e.target.value)}
            className={`${styles.input} ${errors.period_end && submitted ? styles.inputError : ''}`}
            disabled={disabled}
            required
          />
          {errors.period_end && submitted && <p className={styles.fieldError}>{errors.period_end}</p>}
        </div>
      </div>

      {/* Item counts */}
      <div className={styles.periodMeta}>
        {loadingRelated ? (
          <span className={styles.periodMetaLoading}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading items for this period…
          </span>
        ) : (
          <span>
            {goalsCount} {goalsCount === 1 ? 'goal' : 'goals'} · {plansCount}{' '}
            {plansCount === 1 ? 'plan' : 'plans'} · {tasksCount}{' '}
            {tasksCount === 1 ? 'task' : 'tasks'} in this period
          </span>
        )}
      </div>
    </div>
  );
}
