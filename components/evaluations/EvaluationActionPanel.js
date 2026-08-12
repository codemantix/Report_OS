import { Calculator, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { EVALUATION_STATUS_LABELS } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function WorkflowStep({ done, active, label }) {
  return (
    <div className={`${styles.workflowStep} ${done ? styles.workflowDone : ''} ${active ? styles.workflowActive : ''}`} aria-current={active ? 'step' : undefined}>
      <span className={styles.workflowDot}>{done ? <CheckCircle2 aria-hidden="true" /> : <span />}</span>
      <small>{label}</small>
    </div>
  );
}

/**
 * Action panel for management evaluators. Explains the current workflow
 * state of an evaluation and offers the Calculate / Recalculate CTA that
 * actually runs the bi-weekly engine against existing tasks, reports, and
 * attendance. Approval happens in the Human Review Decision panel below.
 */
export default function EvaluationActionPanel({
  evaluation,
  calculating = false,
  onCalculate,
}) {
  const permissions = evaluation.review_permissions || {};
  const canCalculate = Boolean(permissions.canCalculate || permissions.canRecalculate);
  const complete = evaluation.calculation_status === 'complete';
  const approvalStatus = evaluation.current_approval_status || 'not_started';

  if (!canCalculate) {
    return null;
  }

  const label = permissions.canRecalculate ? 'Recalculate Evaluation' : 'Calculate Evaluation';
  const ActionIcon = permissions.canRecalculate ? RefreshCw : Calculator;

  return (
    <section className={`${styles.detailSection} ${styles.actionPanel}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Evaluation Workflow</h3>
          <p>Run the evaluation engine against this employee's assigned tasks, submitted reports, and official attendance records.</p>
        </div>
        <button
          type="button"
          className={styles.calculateButton}
          onClick={onCalculate}
          disabled={calculating}
        >
          {calculating ? <Loader2 className={styles.spin} aria-hidden="true" /> : <ActionIcon aria-hidden="true" />}
          {calculating ? 'Calculating…' : label}
        </button>
      </div>

      <div className={styles.workflowTrack} aria-label="Evaluation workflow progress">
        <WorkflowStep done label="Record inputs (tasks, reports, attendance)" />
        <WorkflowStep done={complete} active={!complete} label={complete ? 'Scores calculated' : 'Calculate scores'} />
        <WorkflowStep done={['approved', 'finalized'].includes(evaluation.status)} active={!['approved', 'finalized'].includes(evaluation.status)} label={EVALUATION_STATUS_LABELS[approvalStatus] || 'Review & Approval'} />
        <WorkflowStep done={['approved', 'finalized'].includes(evaluation.status)} label="Approved result" />
      </div>

      <div className={styles.actionNotice} role="note">
        <ShieldCheck aria-hidden="true" />
        <p>
          {complete
            ? 'The evaluation is calculated. Review the breakdown below, then use the Review & Approval panel to approve, return, or adjust the result. Automated scoring only recommends — manager approval is always required.'
            : 'This evaluation has not been calculated yet. The engine reads the same assigned tasks, reports, and attendance already in Report OS — it never creates duplicate records. Run the calculation to produce the scores below.'}
        </p>
      </div>
    </section>
  );
}
