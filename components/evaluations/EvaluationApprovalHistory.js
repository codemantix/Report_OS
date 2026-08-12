import {
  currentApproval,
  EVALUATION_STATUS_LABELS,
  humanApprovalStatus,
} from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function displayPerson(person) {
  return person?.full_name || person?.display_name || person?.email || 'Unknown reviewer';
}

export default function EvaluationApprovalHistory({ evaluation }) {
  const approvalStatus = humanApprovalStatus(evaluation);
  const activeApproval = currentApproval(evaluation);
  const approvals = [...(evaluation.approvals || [])].sort((a, b) => {
    if (a.review_round_id === b.review_round_id) return a.sequence_number - b.sequence_number;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return (
    <section className={styles.detailSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Human Approval & Stipend Recommendations</h3>
          <p>Historical rounds remain visible; only the current final approval authorizes a result.</p>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${approvalStatus}`]}`}>
          {EVALUATION_STATUS_LABELS[approvalStatus] || approvalStatus}
        </span>
      </div>

      {(evaluation.stipend_recommendations || []).map((recommendation) => (
        <article className={styles.breakdownItem} key={recommendation.id}>
          <div className={styles.itemHeader}>
            <div>
              <h4>Stipend recommendation v{recommendation.version}</h4>
              <p>{recommendation.recommendation_source} · {recommendation.status}</p>
            </div>
            <strong>{recommendation.currency} {Number(recommendation.recommended_amount).toLocaleString()}</strong>
          </div>
          <p className={styles.muted}>{recommendation.rationale}</p>
        </article>
      ))}

      {approvals.length === 0 ? (
        <p className={styles.noData}>No human approval stages have been recorded.</p>
      ) : (
        <div className={styles.timeline}>
          {approvals.map((approval) => (
            <article key={approval.id}>
              <span className={styles.timelineDot} />
              <div>
                <h4>
                  {approval.approval_stage} approval
                  {activeApproval?.id === approval.id && approval.status === 'pending' ? ' · Current stage' : ''}
                </h4>
                <p>
                  {approval.status}
                  {approval.decision_maker ? ` by ${displayPerson(approval.decision_maker)}` : ''}
                </p>
                {approval.decision_note && <blockquote>{approval.decision_note}</blockquote>}
                {approval.score_adjustment !== null
                  && approval.score_adjustment !== undefined
                  && Number(approval.score_adjustment) !== 0
                  && <p>Score adjustment: {Number(approval.score_adjustment) > 0 ? '+' : ''}{Number(approval.score_adjustment).toFixed(3)}</p>}
                {approval.adjustment_reason && <blockquote>Adjustment reason: {approval.adjustment_reason}</blockquote>}
              </div>
            </article>
          ))}
        </div>
      )}

      {(evaluation.review_comments || []).length > 0 && (
        <div className={styles.timeline}>
          {[...evaluation.review_comments]
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((comment) => (
              <article key={comment.id}>
                <span className={styles.timelineDot} />
                <div>
                  <h4>Reviewer feedback · {displayPerson(comment.author)}</h4>
                  <p>{new Date(comment.created_at).toLocaleString()}</p>
                  <blockquote>{comment.body}</blockquote>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
