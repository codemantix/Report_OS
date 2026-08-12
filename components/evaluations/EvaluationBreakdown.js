import { COMPONENT_LABELS, displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function TaskDetails({ metrics }) {
  return <div className={styles.breakdownList}>{(metrics.tasks || []).map((task) => <article key={task.taskId} className={styles.breakdownItem}><div className={styles.itemHeader}><div><h4>{task.title}</h4><p>{task.status} · {task.priority} priority</p></div><strong>{task.includedInScore ? displayScore(task.score) : 'Excluded'}</strong></div><div className={styles.dimensionRow}>{Object.entries(task.dimensions || {}).map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, ' $1')} <strong>{displayScore(value)}</strong></span>)}</div><ul>{(task.reasons || []).map((reason, index) => <li key={index}>{reason}</li>)}</ul></article>)}</div>;
}
function ReportDetails({ metrics }) {
  return <div className={styles.breakdownList}>{(metrics.reports || []).map((report) => <article key={report.reportId} className={styles.breakdownItem}><div className={styles.itemHeader}><div><h4>{report.title || report.projectName || 'Report'}</h4><p>{report.submittedAt ? new Date(report.submittedAt).toLocaleString() : 'Submission date unavailable'}</p></div><strong>{displayScore(report.score)}</strong></div><div className={styles.dimensionRow}>{Object.entries(report.dimensions || {}).map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, ' $1')} <strong>{displayScore(value)}</strong></span>)}</div><ul>{(report.reasons || []).map((reason, index) => <li key={index}>{reason}</li>)}</ul></article>)}</div>;
}
function AttendanceDetails({ metrics }) {
  return <div className={styles.attendanceGrid}>{['totalApplicableSessions', 'present', 'late', 'absent', 'excused'].map((key) => <div key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{metrics[key] ?? 0}</strong></div>)}</div>;
}

export default function EvaluationBreakdown({ component }) {
  const metrics = component.evidence_metrics || {};
  return <section className={styles.detailSection}><div className={styles.sectionHeader}><div><h3>{COMPONENT_LABELS[component.component]}</h3><p>{component.calculation_version || 'Not calculated'}</p></div><strong>{displayScore(component.raw_score)} / 100</strong></div>{component.raw_score === null ? <p className={styles.noData}>{metrics.noDataReason || 'This component has not been scored.'}</p> : component.component === 'task_performance' ? <TaskDetails metrics={metrics} /> : component.component === 'reporting_performance' ? <ReportDetails metrics={metrics} /> : <AttendanceDetails metrics={metrics} />}</section>;
}
