import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  RotateCcw,
  Scale,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { currentReviewRound, REVIEW_TEXT_LIMIT } from '../../utils/evaluationReviewRules';
import { displayScore, EVALUATION_STATUS_LABELS } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function FieldLabel({ icon: Icon, children, hint }) {
  return (
    <span className={styles.reviewFieldLabel}>
      <span className={styles.reviewFieldLabelText}><Icon aria-hidden="true" />{children}</span>
      {hint && <small className={styles.reviewFieldHint}>{hint}</small>}
    </span>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <span className={styles.reviewFieldError} role="alert">{children}</span>;
}

export default function EvaluationReviewPanel({ evaluation, saving, fieldErrors = {}, onSubmit }) {
  const round = currentReviewRound(evaluation);
  const permissions = evaluation.review_permissions || {};
  const basis = {
    score: round?.proposed_score ?? evaluation.overall_score ?? '',
    stipend: round?.proposed_stipend_percentage ?? evaluation.calculated_stipend_percentage ?? '',
    mode: round?.proposed_stipend_mode ?? evaluation.stipend_recommendation_mode ?? 'percentage',
  };
  const [values, setValues] = useState({
    finalScore: basis.score,
    finalStipendPercentage: basis.stipend,
    stipendMode: basis.mode,
    feedback: '',
    adjustmentReason: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues({
      finalScore: basis.score,
      finalStipendPercentage: basis.stipend,
      stipendMode: basis.mode,
      feedback: '',
      adjustmentReason: '',
    });
    setErrors({});
  }, [evaluation.id, round?.id, round?.proposed_score, round?.proposed_stipend_percentage, round?.proposed_stipend_mode]);

  useEffect(() => setErrors((current) => ({ ...current, ...fieldErrors })), [fieldErrors]);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function submit(decision) {
    const nextErrors = {};
    if (decision !== 'approve' && !values.feedback.trim()) {
      nextErrors.feedback = decision === 'return' ? 'A return reason is required.' : 'Feedback is required.';
    }
    if (decision === 'approve') {
      const score = values.finalScore === '' ? Number.NaN : Number(values.finalScore);
      const stipend = values.stipendMode === 'manual'
        ? null
        : values.finalStipendPercentage === '' ? Number.NaN : Number(values.finalStipendPercentage);
      if (!Number.isFinite(score) || score < 0 || score > 100) nextErrors.finalScore = 'Enter a score from 0 to 100.';
      if (stipend !== null && (!Number.isFinite(stipend) || stipend < 0 || stipend > 100)) {
        nextErrors.finalStipendPercentage = 'Enter a percentage from 0 to 100.';
      }
      const adjusted = score !== Number(basis.score)
        || stipend !== (basis.stipend === null ? null : Number(basis.stipend))
        || values.stipendMode !== basis.mode;
      if (adjusted && !values.adjustmentReason.trim()) {
        nextErrors.adjustmentReason = 'A reason is mandatory for every adjustment.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (decision === 'feedback') {
      onSubmit({ decision, feedback: values.feedback });
    } else if (decision === 'return') {
      onSubmit({ decision, feedback: values.feedback });
    } else {
      onSubmit({
        decision,
        finalScore: values.finalScore,
        finalStipendPercentage: values.finalStipendPercentage,
        stipendMode: values.stipendMode,
        feedback: values.feedback,
        adjustmentReason: values.adjustmentReason,
      });
    }
  }

  const canDecide = Boolean(permissions.canApprove || permissions.canReturn);
  const notCalculated = evaluation.calculation_status !== 'complete';
  const feedbackCount = values.feedback.trim().length;
  const reasonCount = values.adjustmentReason.trim().length;
  const approvalLabel = EVALUATION_STATUS_LABELS[evaluation.current_approval_status] || 'Not started';

  const stageLabel = permissions.currentStage
    ? permissions.currentStage.replace(/\b\w/g, (ch) => ch.toUpperCase())
    : 'Workflow';
  const isFinalStage = canDecide && !permissions.nextStage;
  const approveText = permissions.currentStage
    ? isFinalStage
      ? `Approve ${stageLabel} Stage (Final)`
      : `Approve ${stageLabel} Stage`
    : 'Approve Current Stage';
  const hasNext = Boolean(canDecide && permissions.nextStage);

  return (
    <section className={`${styles.detailSection} ${styles.reviewPanel}`} id="human-review">
      <header className={styles.reviewHeader}>
        <div className={styles.reviewHeaderIcon}><UserCheck aria-hidden="true" /></div>
        <div className={styles.reviewHeaderText}>
          <h3>Manager Review & Approval{' — '}{stageLabel} Stage</h3>
          <p>
            {permissions.currentStage
              ? `Review the canonical source records and decide the ${stageLabel.toLowerCase()} stage.${hasNext ? ` After this stage, the evaluation advances to admin final authorization.` : ' This stage completes the evaluation approval chain.'}`
              : 'No active round · the first decision will open the sequential review workflow.'}
          </p>
        </div>
        <span className={`${styles.reviewStageBadge} ${styles[`status_${evaluation.current_approval_status}`] || ''}`}>
          {approvalLabel}
        </span>
      </header>

      <div className={styles.reviewBody}>
        {notCalculated && (
          <div className={styles.reviewPendingNotice} role="note">
            <AlertTriangle aria-hidden="true" />
            <p>
              This evaluation has not been calculated yet. Approval and return actions unlock after the
              evaluation engine has scored the employee's tasks, reports, and attendance.
            </p>
          </div>
        )}

        {canDecide && (
          <div className={styles.reviewSummaryStrip}>
            <div>
              <span>Calculated score</span>
              <strong>{displayScore(evaluation.overall_score)} / 100</strong>
            </div>
            <div>
              <span>Performance band</span>
              <strong>{evaluation.performance_band || '—'}</strong>
            </div>
            <div>
              <span>Stipend recommendation</span>
              <strong>
                {evaluation.stipend_recommendation_mode === 'manual'
                  ? 'Manual decision'
                  : evaluation.calculated_stipend_percentage === null
                    ? '—'
                    : `${Number(evaluation.calculated_stipend_percentage)}%`}
              </strong>
            </div>
            <div className={styles.reviewSummaryNote}>
              <Scale aria-hidden="true" />
              <p>Adjustments below become the approved result — the calculated result is never overwritten.</p>
            </div>
          </div>
        )}

        {canDecide && (
          <section className={styles.reviewSection}>
            <div className={styles.reviewSectionTitle}>
              <ClipboardCheck aria-hidden="true" />
              <div>
                <h4>Decision Details</h4>
                <p>Set the final approved score and stipend for this stage.</p>
              </div>
            </div>
            <div className={styles.reviewGrid}>
              <label className={styles.reviewField}>
                <FieldLabel icon={BadgeCheck} hint="0 – 100">Final approved score</FieldLabel>
                <input type="number" min="0" max="100" step="0.001" value={values.finalScore} onChange={(event) => update('finalScore', event.target.value)} />
                <FieldError>{errors.finalScore}</FieldError>
              </label>
              <label className={styles.reviewField}>
                <FieldLabel icon={ShieldCheck} hint="Percentage or manual">Stipend decision</FieldLabel>
                <select value={values.stipendMode} onChange={(event) => update('stipendMode', event.target.value)}>
                  <option value="percentage">Percentage recommendation</option>
                  <option value="manual">Manual stipend decision</option>
                </select>
                <FieldError>{errors.stipendMode}</FieldError>
              </label>
              {values.stipendMode !== 'manual' && (
                <label className={styles.reviewField}>
                  <FieldLabel icon={BadgeCheck} hint="0 – 100">Final stipend percentage</FieldLabel>
                  <input type="number" min="0" max="100" step="0.01" value={values.finalStipendPercentage} onChange={(event) => update('finalStipendPercentage', event.target.value)} />
                  <FieldError>{errors.finalStipendPercentage}</FieldError>
                </label>
              )}
              <label className={`${styles.reviewField} ${styles.reviewFull}`}>
                <FieldLabel icon={Scale} hint="Required whenever this stage changes the current reviewed proposal">Adjustment reason</FieldLabel>
                <textarea
                  maxLength={REVIEW_TEXT_LIMIT}
                  rows="3"
                  value={values.adjustmentReason}
                  onChange={(event) => update('adjustmentReason', event.target.value)}
                  placeholder="Explain any change to the score or stipend proposed at this stage…"
                />
                <span className={styles.reviewCharCount}>{reasonCount.toLocaleString()} / {REVIEW_TEXT_LIMIT.toLocaleString()}</span>
                <FieldError>{errors.adjustmentReason}</FieldError>
              </label>
            </div>
          </section>
        )}

        <section className={styles.reviewSection}>
          <div className={styles.reviewSectionTitle}>
            <MessageSquareText aria-hidden="true" />
            <div>
              <h4>Reviewer Feedback</h4>
              <p>{canDecide ? 'Add notes for the employee or justify a return.' : 'Leave feedback without changing workflow state.'}</p>
            </div>
          </div>
          <label className={`${styles.reviewField} ${styles.reviewFull}`}>
            <FieldLabel icon={MessageSquareText} hint={!canDecide && permissions.canFeedback ? 'Feedback is saved without advancing the workflow.' : undefined}>Feedback message</FieldLabel>
            <textarea
              maxLength={REVIEW_TEXT_LIMIT}
              rows="4"
              value={values.feedback}
              onChange={(event) => update('feedback', event.target.value)}
              placeholder={canDecide
                ? 'Share what you reviewed, what stood out, and any expectations for the next cycle…'
                : 'Append feedback without changing workflow state, or enter the reason for a return…'}
            />
            <span className={styles.reviewCharCount}>{feedbackCount.toLocaleString()} / {REVIEW_TEXT_LIMIT.toLocaleString()}</span>
            <FieldError>{errors.feedback}</FieldError>
          </label>
        </section>

        <footer className={styles.reviewActions}>
          <span className={styles.reviewActionsNote}>
            <ShieldCheck aria-hidden="true" />
            Automated scoring is advisory only. Your decision below records the official manager authorization.
          </span>
          <div className={styles.reviewActionButtons}>
            {permissions.canFeedback && (
              <button type="button" className={styles.reviewGhostButton} disabled={saving} onClick={() => submit('feedback')}>
                <MessageSquareText aria-hidden="true" /> Save Feedback
              </button>
            )}
            {permissions.canReturn && (
              <button type="button" className={styles.returnButton} disabled={saving} onClick={() => submit('return')}>
                <RotateCcw aria-hidden="true" /> Return for Review
              </button>
            )}
            {permissions.canApprove && (
              <button type="button" className={isFinalStage ? styles.approveFinalButton : styles.approveButton} disabled={saving} onClick={() => submit('approve')}>
                <CheckCircle2 aria-hidden="true" /> {approveText}
              </button>
            )}
          </div>
        </footer>
      </div>
    </section>
  );
}
