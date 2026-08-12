import { AlertCircle, BarChart3, Database, RefreshCw } from 'lucide-react';
import useManagementAnalytics from '../../hooks/useManagementAnalytics';
import CompensationWorkflowMetrics from './CompensationWorkflowMetrics';
import DepartmentComparison from './DepartmentComparison';
import EvaluationTrendChart from './EvaluationTrendChart';
import ManagementAnalyticsFilters from './ManagementAnalyticsFilters';
import ManagementMetricGrid from './ManagementMetricGrid';
import PerformanceBandDistribution from './PerformanceBandDistribution';
import styles from './ManagementAnalytics.module.css';

const TRACE_LABELS = [
  ['performanceCohort', 'Performance cohort'],
  ['overallScoreBasis', 'Overall score'],
  ['componentScoreBasis', 'Components'],
  ['stipendBasis', 'Stipends'],
  ['paymentBasis', 'Payments'],
];

function LoadingState() {
  return <div className={styles.loading} aria-label="Loading evaluation analytics">{[1, 2, 3, 4, 5, 6].map((item) => <div className={styles.skeleton} key={item} />)}</div>;
}

export default function ManagementAnalyticsSection({ role }) {
  const enabled = role === 'admin' || role === 'department_lead';
  const { data, loading, error, filters, changeFilter, clearFilters, retry } = useManagementAnalytics(enabled);
  if (!enabled) return null;

  const analytics = data?.analytics;
  return <section className={styles.section} aria-labelledby="management-analytics-title"><header className={styles.sectionHeader}><div><span className={styles.eyebrow}><BarChart3 size={15} aria-hidden="true" />Evaluation intelligence</span><h1 id="management-analytics-title">Management performance analytics</h1><p>Decision-ready metrics derived from stored evaluations, component scores, stipends, approvals, and payment records.</p></div>{analytics && <div className={styles.recordCount}><Database size={17} aria-hidden="true" /><span><strong>{analytics.summary?.totalEvaluations ?? 0}</strong> matching evaluations</span></div>}</header>
    {data && <ManagementAnalyticsFilters filters={filters} appliedFilters={data.appliedFilters} options={data.options || {}} role={role} onChange={changeFilter} onClear={clearFilters} />}
    {loading ? <LoadingState /> : error ? <div className={styles.errorState}><AlertCircle size={28} aria-hidden="true" /><div><h3>Evaluation analytics could not be loaded</h3><p>{error}</p></div><button type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Try again</button></div> : analytics ? <div className={styles.analyticsContent}><ManagementMetricGrid summary={analytics.summary || {}} /><div className={styles.chartGrid}><DepartmentComparison departments={analytics.departmentComparison || []} /><PerformanceBandDistribution bands={analytics.performanceBands || []} /><EvaluationTrendChart trends={analytics.trends || []} /></div><CompensationWorkflowMetrics stipends={analytics.stipends || {}} payments={analytics.payments || {}} /><footer className={styles.traceNote}><Database size={15} aria-hidden="true" /><span>{TRACE_LABELS.map(([key, label]) => analytics.trace?.[key] ? `${label}: ${analytics.trace[key]}` : null).filter(Boolean).join(' · ')}. No synthetic values are generated.</span></footer></div> : null}
  </section>;
}
