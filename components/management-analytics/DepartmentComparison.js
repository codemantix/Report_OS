import { Building2 } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

function value(score) {
  return score === null || score === undefined ? '—' : `${Number(score).toFixed(1)}%`;
}

export default function DepartmentComparison({ departments }) {
  const sorted = [...departments].sort((a, b) => (Number(b.averageOverallScore) || 0) - (Number(a.averageOverallScore) || 0));

  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeaderTitle}>
          <span><Building2 size={18} aria-hidden="true" /></span>
          <div>
            <h3>Department comparison</h3>
            <p>Average effective overall score by department</p>
          </div>
        </div>
      </header>
      {sorted.length === 0 ? (
        <div className={styles.chartEmpty}>No department evaluation data matches these filters.</div>
      ) : (
        <div className={styles.departmentList}>
          {sorted.map((department, index) => (
            <div className={styles.departmentRow} key={department.departmentId}>
              <div className={styles.departmentTitle}>
                <div className={styles.departmentRank}>
                  <span className={styles.rankBadge}>#{index + 1}</span>
                  <strong>{department.departmentName}</strong>
                </div>
                <span>{department.evaluationCount} complete evaluation{department.evaluationCount === 1 ? '' : 's'}</span>
              </div>
              <div className={styles.progressLine}>
                <progress max="100" value={Number(department.averageOverallScore) || 0} aria-label={`${department.departmentName} average score`} />
                <strong>{value(department.averageOverallScore)}</strong>
              </div>
              <div className={styles.componentMini}>
                <span className={styles.miniChip}>Task {value(department.averageTaskScore)} ({department.taskSampleSize || 0} evals)</span>
                <span className={styles.miniChip}>Reports {value(department.averageReportingScore)} ({department.reportingSampleSize || 0} evals)</span>
                <span className={styles.miniChip}>Attendance {value(department.averageAttendanceScore)} ({department.attendanceSampleSize || 0} evals)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
