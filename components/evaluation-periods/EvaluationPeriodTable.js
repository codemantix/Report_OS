import { CalendarClock, Pencil } from 'lucide-react';
import {
  EVALUATION_PERIOD_STATUS_LABELS,
  EVALUATION_PERIOD_TRANSITIONS,
} from '../../utils/evaluationPeriodConstants';
import styles from './EvaluationPeriods.module.css';

function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function employeeName(evaluation) {
  return evaluation.employee?.full_name
    || evaluation.employee?.display_name
    || evaluation.employee?.email
    || 'Employee';
}

function PeriodActions({ period, busyId, onEdit, onTransition }) {
  const transitions = EVALUATION_PERIOD_TRANSITIONS[period.status] || [];
  return (
    <div className={styles.actions}>
      {period.status === 'draft' && (
        <button type="button" className={styles.iconButton} onClick={() => onEdit(period)} aria-label={`Edit ${period.name}`}>
          <Pencil aria-hidden="true" />
        </button>
      )}
      {transitions.map((transition) => (
        <button
          key={transition.status}
          type="button"
          className={transition.status === 'active' && period.status === 'under_review'
            ? styles.secondarySmallButton
            : styles.primarySmallButton}
          disabled={busyId === period.id}
          onClick={() => onTransition(period, transition)}
        >
          {busyId === period.id ? 'Updating…' : transition.label}
        </button>
      ))}
    </div>
  );
}

export default function EvaluationPeriodTable({ periods, busyId, onEdit, onTransition }) {
  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Period</th>
              <th>Department</th>
              <th>Window</th>
              <th>Deadline</th>
              <th>Employees</th>
              <th>Status</th>
              <th>Created</th>
              <th><span className={styles.srOnly}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td><strong>{period.name}</strong></td>
                <td>{period.department?.name || '—'}</td>
                <td className={styles.nowrap}>{formatDate(period.start_date)} – {formatDate(period.end_date)}</td>
                <td className={styles.nowrap}>{formatDate(period.evaluation_deadline, true)}</td>
                <td>
                  <div className={styles.employeeStack}>
                    <strong>{(period.evaluations || []).length}</strong>
                    <span>{(period.evaluations || []).slice(0, 2).map(employeeName).join(', ') || 'None'}</span>
                  </div>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[`status_${period.status}`] || ''}`}>
                    {EVALUATION_PERIOD_STATUS_LABELS[period.status] || period.status}
                  </span>
                </td>
                <td>
                  <div className={styles.employeeStack}>
                    <strong>{formatDate(period.created_at)}</strong>
                    <span>{period.creator?.full_name || period.creator?.display_name || period.creator?.email || 'System'}</span>
                  </div>
                </td>
                <td><PeriodActions period={period} busyId={busyId} onEdit={onEdit} onTransition={onTransition} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {periods.map((period) => (
          <article key={period.id} className={styles.mobileCard}>
            <div className={styles.mobileHeader}>
              <div>
                <span className={`${styles.statusBadge} ${styles[`status_${period.status}`] || ''}`}>
                  {EVALUATION_PERIOD_STATUS_LABELS[period.status] || period.status}
                </span>
                <h3>{period.name}</h3>
                <p>{period.department?.name}</p>
              </div>
              <CalendarClock aria-hidden="true" />
            </div>
            <dl className={styles.mobileDetails}>
              <div><dt>Evaluation window</dt><dd>{formatDate(period.start_date)} – {formatDate(period.end_date)}</dd></div>
              <div><dt>Deadline</dt><dd>{formatDate(period.evaluation_deadline, true)}</dd></div>
              <div><dt>Employees</dt><dd>{(period.evaluations || []).length}</dd></div>
              <div><dt>Created by</dt><dd>{period.creator?.full_name || period.creator?.display_name || 'System'}</dd></div>
            </dl>
            <PeriodActions period={period} busyId={busyId} onEdit={onEdit} onTransition={onTransition} />
          </article>
        ))}
      </div>
    </>
  );
}
