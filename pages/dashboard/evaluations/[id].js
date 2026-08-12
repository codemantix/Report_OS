import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import EvaluationActionPanel from '../../../components/evaluations/EvaluationActionPanel';
import EvaluationScoreOverview from '../../../components/evaluations/EvaluationScoreOverview';
import EvaluationResultComparison from '../../../components/evaluations/EvaluationResultComparison';
import EvaluationTaskRecords from '../../../components/evaluations/EvaluationTaskRecords';
import EvaluationReportRecords from '../../../components/evaluations/EvaluationReportRecords';
import EvaluationAttendanceRecords from '../../../components/evaluations/EvaluationAttendanceRecords';
import EvaluationManagerFeedback from '../../../components/evaluations/EvaluationManagerFeedback';
import EvaluationApprovalHistory from '../../../components/evaluations/EvaluationApprovalHistory';
import EvaluationReviewPanel from '../../../components/evaluations/EvaluationReviewPanel';
import { fetchEvaluationDetail, submitEvaluationReview } from '../../../services/evaluationDashboardService';
import { calculateBiweeklyEmployeeEvaluation } from '../../../services/biweeklyEvaluationService';
import { EVALUATION_STATUS_LABELS } from '../../../utils/evaluationDashboardConstants';
import styles from '../../../components/evaluations/Evaluations.module.css';

export default function EvaluationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewFieldErrors, setReviewFieldErrors] = useState({});

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    const result = await fetchEvaluationDetail(id);
    if (result.error) setError(result.error.message);
    else setEvaluation(result.data);
    setLoading(false);
  }

  async function calculate() {
    setCalculating(true);
    const result = await calculateBiweeklyEmployeeEvaluation(id);
    if (result.error) {
      toast.error(result.error.message || 'Evaluation could not be calculated.');
    } else {
      toast.success(result.data?.evaluation?.calculationStatus === 'complete'
        ? 'Evaluation calculated. Review the breakdown, then approve or adjust.'
        : 'Input scores calculated, but the evaluation is incomplete because some required inputs are missing.');
      await load();
    }
    setCalculating(false);
  }

  async function submitReview(payload) {
    setReviewSaving(true);
    setReviewFieldErrors({});
    const result = await submitEvaluationReview(id, payload);
    if (result.error) {
      setReviewFieldErrors(result.error.fields || {});
      toast.error(result.error.message || 'Review action could not be completed.');
    } else {
      toast.success(payload.decision === 'approve'
        ? result.data.finalized
          ? 'Final approval recorded.'
          : `Stage approved${result.data.nextStage ? `; awaiting ${result.data.nextStage}.` : '.'}`
        : payload.decision === 'return'
          ? 'Evaluation returned for review.'
          : 'Reviewer feedback appended.');
      await load();
    }
    setReviewSaving(false);
  }

  if (loading) {
    return <DashboardLayout><div className={styles.loading}>{[1, 2, 3, 4].map((item) => <div className={styles.skeleton} key={item} />)}</div></DashboardLayout>;
  }
  if (error || !evaluation) {
    return <DashboardLayout><div className={styles.state}><AlertCircle /><h2>Evaluation could not be loaded</h2><p>{error}</p><button className={styles.secondaryButton} onClick={load}>Try again</button></div></DashboardLayout>;
  }

  const employeeName = evaluation.employee?.full_name
    || evaluation.employee?.display_name
    || evaluation.employee_name_snapshot;

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href="/dashboard/evaluations" className={styles.backLink}>
          <ArrowLeft size={17} /> Back to evaluations
        </Link>
        <header className={styles.detailHeader}>
          <div>
            <h1>{employeeName}</h1>
            <p className={styles.muted}>
              {evaluation.department?.name || evaluation.department_name_snapshot}
              {' · '}{evaluation.period?.name}
              {' · '}{evaluation.period?.start_date} to {evaluation.period?.end_date}
            </p>
          </div>
          <div className={styles.headerBadges}>
            <span className={styles.bandBadge}>{evaluation.performance_band || 'Not calculated'}</span>
            <span className={`${styles.statusBadge} ${styles[`status_${evaluation.status}`]}`}>
              Evaluation workflow: {EVALUATION_STATUS_LABELS[evaluation.status]}
            </span>
          </div>
        </header>

        <EvaluationResultComparison evaluation={evaluation} />
        <EvaluationScoreOverview evaluation={evaluation} />
        <EvaluationActionPanel evaluation={evaluation} calculating={calculating} onCalculate={calculate} />
        <EvaluationTaskRecords evaluation={evaluation} />
        <EvaluationReportRecords evaluation={evaluation} />
        <EvaluationAttendanceRecords evaluation={evaluation} />
        <EvaluationManagerFeedback evaluation={evaluation} />
        {evaluation.review_permissions?.canReview && (
          <EvaluationReviewPanel
            evaluation={evaluation}
            saving={reviewSaving}
            fieldErrors={reviewFieldErrors}
            onSubmit={submitReview}
          />
        )}
        <EvaluationApprovalHistory evaluation={evaluation} />

        {(evaluation.source_records?.warnings || []).length > 0 && (
          <section className={styles.sourceWarning} role="note">
            <strong>Some live source records could not be loaded</strong>
            <ul>{evaluation.source_records.warnings.map((warning, index) => <li key={index}>{warning.source}: {warning.message}</li>)}</ul>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
