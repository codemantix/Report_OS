import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Gauge } from 'lucide-react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import EvaluationAttendanceRecords from '../../../components/evaluations/EvaluationAttendanceRecords';
import EvaluationReportRecords from '../../../components/evaluations/EvaluationReportRecords';
import EvaluationTaskRecords from '../../../components/evaluations/EvaluationTaskRecords';
import MyCompensationStatus from '../../../components/my-performance/MyCompensationStatus';
import MyManagerFeedback from '../../../components/my-performance/MyManagerFeedback';
import MyPerformanceOverview from '../../../components/my-performance/MyPerformanceOverview';
import PerformanceHistory from '../../../components/my-performance/PerformanceHistory';
import ScoreExplanation from '../../../components/my-performance/ScoreExplanation';
import { fetchMyPerformance } from '../../../services/myPerformanceService';
import styles from '../../../components/my-performance/MyPerformance.module.css';

export default function MyPerformancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [failedEvaluationId, setFailedEvaluationId] = useState(null);
  const requestSequence = useRef(0);

  useEffect(() => { load(); }, []);

  async function load(evaluationId = null) {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    if (!data) setLoading(true);
    setLoadingId(evaluationId);
    setError('');
    const result = await fetchMyPerformance(evaluationId);
    if (requestId !== requestSequence.current) return;
    if (result.error) {
      setError(result.error.message);
      setFailedEvaluationId(evaluationId);
    } else {
      setData(result.data);
      setFailedEvaluationId(null);
    }
    setLoading(false);
    setLoadingId(null);
  }

  if (loading && !data) return <DashboardLayout><div className={styles.loading}>{[1, 2, 3, 4, 5].map((item) => <div className={styles.skeleton} key={item} />)}</div></DashboardLayout>;
  if (error && !data) return <DashboardLayout><div className={styles.state}><AlertCircle /><h2>Your performance could not be loaded</h2><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => load()}>Try again</button></div></DashboardLayout>;
  if (!data?.selectedEvaluation) return <DashboardLayout><div className={styles.page}><header className={styles.pageHeader}><h1>My Performance</h1><p>Your tasks, reports, attendance, and evaluation results in one place.</p></header><div className={styles.state}><Gauge /><h2>No evaluation is available yet</h2><p>{data?.currentPeriod ? `${data.currentPeriod.name} is active, but your evaluation record has not been created.` : 'There is no current or previous evaluation period assigned to you.'}</p></div></div></DashboardLayout>;

  const evaluation = {
    ...data.selectedEvaluation,
    source_records: data.sourceRecords,
  };
  const isHistorical = data.selectionKind === 'historical';

  return <DashboardLayout><div className={styles.page}>
    <header className={styles.pageHeader}><h1>My Performance</h1><p>Understand your result using the same assigned tasks, submitted reports, and official attendance already in Report OS.</p></header>
    {error && <div className={styles.state}><AlertCircle /><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => load(failedEvaluationId)}>Try again</button></div>}
    <MyPerformanceOverview evaluation={evaluation} currentPeriod={data.currentPeriod} isHistorical={isHistorical} />
    <ScoreExplanation evaluation={evaluation} />
    <EvaluationTaskRecords evaluation={evaluation} />
    <EvaluationReportRecords evaluation={evaluation} linkRecords={false} />
    <EvaluationAttendanceRecords evaluation={evaluation} showAdministrativeDetails={false} />
    <MyManagerFeedback evaluation={evaluation} sourceRecords={data.sourceRecords} />
    <MyCompensationStatus compensation={data.compensationStatus} />
    <PerformanceHistory history={data.history} selectedId={evaluation.id} loadingId={loadingId} onSelect={load} />
  </div></DashboardLayout>;
}
