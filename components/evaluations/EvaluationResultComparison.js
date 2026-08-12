import { CheckCircle2, Calculator, ShieldCheck } from 'lucide-react';
import { displayScore, EVALUATION_STATUS_LABELS, humanApprovalStatus } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

export default function EvaluationResultComparison({ evaluation }) {
  const approvalStatus = humanApprovalStatus(evaluation);
  const hasCurrentApprovedResult = ['approved', 'finalized'].includes(evaluation.status)
    && approvalStatus === 'approved'
    && evaluation.approved_score !== null
    && evaluation.approved_score !== undefined;

  return (
    <section className={styles.resultComparison}>
      <article className={styles.resultPanel}>
        <span className={styles.resultIcon}><Calculator aria-hidden="true" /></span>
        <p className={styles.resultEyebrow}>Calculated Result</p>
        <h2>{displayScore(evaluation.calculation_status === 'complete' ? evaluation.overall_score : null)} / 100</h2>
        <strong>{evaluation.performance_band || 'Not calculated'}</strong>
        <p>{evaluation.stipend_recommendation_mode === 'manual'
          ? 'Manual stipend decision recommended'
          : evaluation.calculated_stipend_percentage === null
            ? 'No stipend recommendation calculated'
            : `${Number(evaluation.calculated_stipend_percentage)}% stipend recommended`}</p>
        <small>System-calculated from stored Task, Reporting, and Attendance components.</small>
      </article>
      <article className={`${styles.resultPanel} ${styles.approvedPanel}`}>
        <span className={styles.resultIcon}>{approvalStatus === 'approved' ? <CheckCircle2 aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}</span>
        <p className={styles.resultEyebrow}>{hasCurrentApprovedResult ? 'Approved Result' : 'Approval Progress'}</p>
        <h2>{hasCurrentApprovedResult
          ? `${displayScore(evaluation.approved_score)} / 100`
          : EVALUATION_STATUS_LABELS[approvalStatus] || approvalStatus}</h2>
        <strong>{hasCurrentApprovedResult
          ? evaluation.approved_performance_band
          : 'No final approved performance band'}</strong>
        <p>{hasCurrentApprovedResult && evaluation.approved_stipend_mode === 'manual'
          ? 'Manual stipend decision approved'
          : hasCurrentApprovedResult && evaluation.approved_stipend_percentage !== null
            ? `${Number(evaluation.approved_stipend_percentage)}% stipend approved`
            : 'No final approved stipend result'}</p>
        <p>{hasCurrentApprovedResult && evaluation.approval_feedback
          ? evaluation.approval_feedback
          : 'Human authorization has not recorded a final decision note.'}</p>
        <small>Only human approval records constitute an approved result.</small>
      </article>
    </section>
  );
}
