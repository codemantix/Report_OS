import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquareText, RotateCcw } from 'lucide-react';
import { currentReviewRound, REVIEW_TEXT_LIMIT } from '../../utils/evaluationReviewRules';
import styles from './Evaluations.module.css';

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

  return (
    <section className={`${styles.detailSection} ${styles.reviewPanel}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Human Review Decision</h3>
          <p>
            {permissions.currentStage
              ? `${permissions.currentStage} stage · review the canonical source records before deciding.`
              : 'No active round · the first decision will open the sequential review workflow.'}
          </p>
        </div>
      </div>
      <div className={styles.reviewForm}>
        {(permissions.canApprove || permissions.canReturn) && (
          <div className={styles.reviewGrid}>
            <label><span>Proposed final score</span><input type="number" min="0" max="100" step="0.001" value={values.finalScore} onChange={(event) => update('finalScore', event.target.value)} />{errors.finalScore && <small>{errors.finalScore}</small>}</label>
            <label><span>Stipend decision</span><select value={values.stipendMode} onChange={(event) => update('stipendMode', event.target.value)}><option value="percentage">Percentage recommendation</option><option value="manual">Manual stipend decision</option></select>{errors.stipendMode && <small>{errors.stipendMode}</small>}</label>
            {values.stipendMode !== 'manual' && <label><span>Proposed stipend percentage</span><input type="number" min="0" max="100" step="0.01" value={values.finalStipendPercentage} onChange={(event) => update('finalStipendPercentage', event.target.value)} />{errors.finalStipendPercentage && <small>{errors.finalStipendPercentage}</small>}</label>}
            <label className={styles.reviewFull}><span>Adjustment reason</span><textarea maxLength={REVIEW_TEXT_LIMIT} rows="3" value={values.adjustmentReason} onChange={(event) => update('adjustmentReason', event.target.value)} placeholder="Required whenever this stage changes the current reviewed proposal" />{errors.adjustmentReason && <small>{errors.adjustmentReason}</small>}</label>
          </div>
        )}
        <label className={styles.reviewFull}><span>Reviewer feedback</span><textarea maxLength={REVIEW_TEXT_LIMIT} rows="4" value={values.feedback} onChange={(event) => update('feedback', event.target.value)} placeholder="Append feedback without changing workflow state, or enter the reason for a return" />{errors.feedback && <small>{errors.feedback}</small>}</label>
        <div className={styles.reviewActions}>
          {permissions.canFeedback && <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => submit('feedback')}><MessageSquareText aria-hidden="true" /> Save Feedback</button>}
          {permissions.canReturn && <button type="button" className={styles.returnButton} disabled={saving} onClick={() => submit('return')}><RotateCcw aria-hidden="true" /> Return for Review</button>}
          {permissions.canApprove && <button type="button" className={styles.approveButton} disabled={saving} onClick={() => submit('approve')}><CheckCircle2 aria-hidden="true" /> Approve Current Stage</button>}
        </div>
      </div>
    </section>
  );
}
