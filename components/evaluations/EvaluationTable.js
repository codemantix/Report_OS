import { useRouter } from 'next/router';
import { ChevronRight } from 'lucide-react';
import {
  componentScore,
  displayScore,
  EVALUATION_STATUS_LABELS,
  humanApprovalStatus,
} from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function name(evaluation) {
  return evaluation.employee?.full_name || evaluation.employee?.display_name || evaluation.employee_name_snapshot;
}
function Score({ value }) {
  return <span className={value === null ? styles.mutedScore : styles.score}>{displayScore(value)}</span>;
}

export default function EvaluationTable({ evaluations }) {
  const router = useRouter();
  const open = (id) => router.push(`/dashboard/evaluations/${id}`);
  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Employee</th><th>Department</th><th>Task</th><th>Reporting</th><th>Attendance</th><th>Overall</th><th>Band</th><th>Stipend</th><th>Approval</th><th /></tr></thead>
          <tbody>{evaluations.map((evaluation) => {
            const task = componentScore(evaluation, 'task_performance');
            const reporting = componentScore(evaluation, 'reporting_performance');
            const attendance = componentScore(evaluation, 'attendance');
            return (
              <tr key={evaluation.id} tabIndex={0} onClick={() => open(evaluation.id)} onKeyDown={(e) => e.key === 'Enter' && open(evaluation.id)}>
                <td><div className={styles.person}><span className={styles.avatar}>{name(evaluation)?.slice(0, 1)}</span><span><strong>{name(evaluation)}</strong><small>{evaluation.employee?.job_title || evaluation.employee?.email}</small></span></div></td>
                <td>{evaluation.department?.name || evaluation.department_name_snapshot}</td>
                <td><Score value={task} /></td><td><Score value={reporting} /></td><td><Score value={attendance} /></td>
                <td><Score value={evaluation.calculation_status === 'complete' ? evaluation.overall_score : null} /></td>
                <td><span className={`${styles.bandBadge} ${styles[`band_${evaluation.performance_band?.toLowerCase().replaceAll(' ', '_')}`] || ''}`}>{evaluation.performance_band || 'Not calculated'}</span></td>
                <td>{evaluation.stipend_recommendation_mode === 'manual' ? 'Manual' : evaluation.calculated_stipend_percentage === null ? '—' : `${Number(evaluation.calculated_stipend_percentage)}%`}</td>
                <td>{(() => { const approval = humanApprovalStatus(evaluation); return <span className={`${styles.statusBadge} ${styles[`status_${approval}`]}`}>{EVALUATION_STATUS_LABELS[approval] || approval}</span>; })()}</td>
                <td><ChevronRight aria-hidden="true" size={17} /></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className={styles.mobileList}>{evaluations.map((evaluation) => (
        <button type="button" className={styles.mobileCard} key={evaluation.id} onClick={() => open(evaluation.id)}>
          <div className={styles.mobileTop}><div className={styles.person}><span className={styles.avatar}>{name(evaluation)?.slice(0, 1)}</span><span><strong>{name(evaluation)}</strong><small>{evaluation.department?.name}</small></span></div><ChevronRight aria-hidden="true" /></div>
          <div className={styles.mobileScores}><span>Task <strong>{displayScore(componentScore(evaluation, 'task_performance'))}</strong></span><span>Reporting <strong>{displayScore(componentScore(evaluation, 'reporting_performance'))}</strong></span><span>Attendance <strong>{displayScore(componentScore(evaluation, 'attendance'))}</strong></span><span>Overall <strong>{displayScore(evaluation.calculation_status === 'complete' ? evaluation.overall_score : null)}</strong></span></div>
          <div className={styles.mobileBadges}><span className={styles.bandBadge}>{evaluation.performance_band || 'Not calculated'}</span><span className={`${styles.statusBadge} ${styles[`status_${humanApprovalStatus(evaluation)}`]}`}>{EVALUATION_STATUS_LABELS[humanApprovalStatus(evaluation)]}</span></div>
        </button>
      ))}</div>
    </>
  );
}
