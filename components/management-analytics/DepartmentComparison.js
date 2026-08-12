import { Building2 } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

function value(score) {
  return score === null || score === undefined ? '—' : `${Number(score).toFixed(1)}%`;
}

export default function DepartmentComparison({ departments }) {
  return <article className={styles.panel}><header className={styles.panelHeader}><span><Building2 size={18} aria-hidden="true" /></span><div><h3>Department comparison</h3><p>Average effective overall score by department</p></div></header>{departments.length === 0 ? <div className={styles.chartEmpty}>No department evaluation data matches these filters.</div> : <div className={styles.departmentList}>{departments.map((department) => <div className={styles.departmentRow} key={department.departmentId}><div className={styles.departmentTitle}><strong>{department.departmentName}</strong><span>{department.evaluationCount} complete evaluation{department.evaluationCount === 1 ? '' : 's'}</span></div><div className={styles.progressLine}><progress max="100" value={Number(department.averageOverallScore) || 0} aria-label={`${department.departmentName} average score`} /><strong>{value(department.averageOverallScore)}</strong></div><div className={styles.componentMini}><span>Task {value(department.averageTaskScore)} · n={department.taskSampleSize}</span><span>Reports {value(department.averageReportingScore)} · n={department.reportingSampleSize}</span><span>Attendance {value(department.averageAttendanceScore)} · n={department.attendanceSampleSize}</span></div></div>)}</div>}</article>;
}
