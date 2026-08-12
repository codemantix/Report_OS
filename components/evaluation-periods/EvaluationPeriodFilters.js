import { EVALUATION_PERIOD_STATUSES, EVALUATION_PERIOD_STATUS_LABELS } from '../../utils/evaluationPeriodConstants';
import styles from './EvaluationPeriods.module.css';

export default function EvaluationPeriodFilters({ filters, departments, role, onChange, onClear }) {
  return (
    <section className={styles.filters} aria-label="Evaluation period filters">
      <div className={styles.filterGrid}>
        <label className={styles.field}>
          <span>Department</span>
          <select
            value={filters.department_id}
            onChange={(event) => onChange('department_id', event.target.value)}
            disabled={role === 'department_lead'}
          >
            {role === 'admin' && <option value="">All departments</option>}
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
            <option value="">All statuses</option>
            {EVALUATION_PERIOD_STATUSES.map((status) => (
              <option key={status} value={status}>{EVALUATION_PERIOD_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className={styles.secondaryButton} onClick={onClear}>Clear filters</button>
    </section>
  );
}
