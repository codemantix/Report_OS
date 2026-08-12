import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Calculator, ChevronRight, ShieldCheck } from 'lucide-react';
import { requiresManualStipendDecision } from '../../utils/stipendRecommendationRules';
import styles from './Stipends.module.css';

function money(currency, amount) {
  return amount === null || amount === undefined
    ? '—'
    : `${currency || ''} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function employeeName(evaluation) {
  return evaluation.employee?.full_name
    || evaluation.employee?.display_name
    || evaluation.employee_name_snapshot;
}

export default function StipendRecommendationList({ evaluations, permissions, savingId, onAction }) {
  const [active, setActive] = useState(null);
  const [values, setValues] = useState({ amount: '', reason: '' });
  const [error, setError] = useState('');

  function open(id, type, amount = '') {
    setActive({ id, type });
    setValues({ amount, reason: '' });
    setError('');
  }

  async function submit(evaluation, recommendation) {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || (active.type === 'manual' ? amount <= 0 : amount < 0)) {
      return setError(active.type === 'manual' ? 'Enter a positive amount.' : 'Final amount cannot be negative.');
    }
    if (active.type === 'manual' && !values.reason.trim()) return setError('A reason is required for a manual stipend decision.');
    if (active.type === 'approve' && amount !== Number(recommendation.recommended_amount) && !values.reason.trim()) {
      return setError('A reason is required when changing the recommended amount.');
    }
    const result = await onAction(active.type === 'manual' ? {
      action: 'create', evaluationId: evaluation.id,
      baseConfigId: evaluation.applicable_base_config?.id,
      manualAmount: values.amount, reason: values.reason,
    } : {
      action: 'approve', recommendationId: recommendation.id,
      finalAmount: values.amount, reason: values.reason,
    });
    if (result?.error) setError(result.error.message);
    else setActive(null);
  }

  if (evaluations.length === 0) return <section className={styles.panel}><div className={styles.empty}><Calculator /><strong>No approved evaluations found</strong><p>Stipend recommendations become available only after human evaluation approval.</p></div></section>;

  return (
    <section className={styles.recommendationList}>
      {evaluations.map((evaluation) => {
        const recommendation = evaluation.current_recommendation;
        const manual = requiresManualStipendDecision(evaluation);
        const currency = recommendation?.currency || evaluation.applicable_base_config?.currency;
        const isSaving = savingId === evaluation.id || savingId === recommendation?.id;
        return (
          <article className={styles.recommendationCard} key={evaluation.id}>
            <div className={styles.cardHeader}>
              <div className={styles.person}><span>{employeeName(evaluation)?.slice(0, 1)?.toUpperCase()}</span><div><h3>{employeeName(evaluation)}</h3><p>{evaluation.department?.name || evaluation.department_name_snapshot} · {evaluation.period?.name}</p></div></div>
              <span className={`${styles.statusBadge} ${styles[`status_${evaluation.recommendation_status}`]}`}>{evaluation.recommendation_status.replace('_', ' ')}</span>
            </div>
            <div className={styles.amountGrid}>
              <div><span>Base stipend</span><strong>{money(currency, recommendation?.base_stipend_amount ?? evaluation.applicable_base_config?.amount)}</strong></div>
              <div><span>Approved score</span><strong>{Number(evaluation.approved_score).toFixed(1)}</strong><small>{evaluation.approved_performance_band}</small></div>
              <div><span>Recommended percentage</span><strong>{manual ? 'Manual' : `${Number(evaluation.approved_stipend_percentage)}%`}</strong></div>
              <div><span>Recommended amount</span><strong>{money(currency, recommendation?.recommended_amount ?? evaluation.calculated_recommended_amount)}</strong></div>
              <div><span>Final approved amount</span><strong>{money(currency, recommendation?.final_approved_amount)}</strong></div>
            </div>
            {recommendation?.amount_adjustment_reason && <div className={styles.reason}><strong>Adjustment reason</strong><p>{recommendation.amount_adjustment_reason}</p></div>}
            {!evaluation.applicable_base_config && !recommendation && <div className={styles.warning}>No applicable base stipend configuration exists for this evaluation period.</div>}
            {manual && !recommendation && <div className={styles.warning}>Scores below 60 require an explicit manual stipend amount and reason.</div>}

            {active?.id === evaluation.id && (
              <div className={styles.actionForm}>
                <label><span>{active.type === 'manual' ? 'Manual recommended amount' : 'Final approved amount'}</span><input type="number" min={active.type === 'manual' ? '0.01' : '0'} step="0.01" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} /></label>
                <label><span>{active.type === 'manual' ? 'Manual decision reason' : 'Adjustment reason'}</span><textarea rows="3" maxLength="5000" value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} placeholder={active.type === 'approve' ? 'Required only when final amount differs from recommendation' : 'Required'} /></label>
                {error && <p className={styles.formError}>{error}</p>}
                <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setActive(null)}>Cancel</button><button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => submit(evaluation, recommendation)}>{isSaving ? 'Saving…' : active.type === 'approve' ? 'Approve final amount' : 'Save manual recommendation'}</button></div>
              </div>
            )}

            <div className={styles.cardActions}>
              <Link href={`/dashboard/evaluations/${evaluation.id}`}>View evaluation <ChevronRight aria-hidden="true" /></Link>
              {!recommendation && !manual && permissions.canCreateRecommendations && <button type="button" className={styles.primaryButton} disabled={!evaluation.applicable_base_config || isSaving} onClick={() => onAction({ action: 'create', evaluationId: evaluation.id, baseConfigId: evaluation.applicable_base_config?.id })}><Calculator aria-hidden="true" /> {isSaving ? 'Calculating…' : 'Generate recommendation'}</button>}
              {!recommendation && manual && permissions.canCreateRecommendations && <button type="button" className={styles.primaryButton} disabled={!evaluation.applicable_base_config || isSaving} onClick={() => open(evaluation.id, 'manual')}><ShieldCheck aria-hidden="true" /> Manual decision</button>}
              {recommendation?.status === 'recommended' && permissions.canApproveRecommendations && <button type="button" className={styles.approveButton} disabled={isSaving} onClick={() => open(evaluation.id, 'approve', recommendation.recommended_amount)}><BadgeCheck aria-hidden="true" /> Review & approve</button>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
