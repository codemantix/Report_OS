import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function attachmentCount(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (!value || typeof value !== 'string') return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

export default function EvaluationReportRecords({ evaluation, linkRecords = true }) {
  const reports = evaluation.source_records?.reports || [];
  const component = (evaluation.component_scores || []).find((score) => score.component === 'reporting_performance');
  const metrics = new Map((component?.evidence_metrics?.reports || []).map((report) => [report.reportId, report]));
  return <section className={styles.detailSection} id="reporting-performance"><div className={styles.sectionHeader}><div><h3>Reporting Performance</h3><p>Applicable reports from the existing Report OS reporting system.</p></div></div>{reports.length === 0 ? <p className={styles.noData}>No applicable reports were submitted in this period.</p> : <div className={styles.sourceList}>{reports.map((report) => {
    const contribution = metrics.get(report.id);
    const title = <><FileText aria-hidden="true" /> {report.project_name || 'Report'} {linkRecords && <ExternalLink aria-hidden="true" />}</>;
    return <article className={styles.sourceCard} key={report.id}><div className={styles.sourceHeader}><div>{linkRecords ? <Link href={`/dashboard/reports/${report.id}`}>{title}</Link> : <strong>{title}</strong>}<p>Submitted {new Date(report.submitted_at).toLocaleString()} · {report.reviewed ? 'Reviewed' : 'Awaiting review'}</p></div><div className={styles.contribution}><span>Report score</span><strong>{displayScore(contribution?.score)}</strong></div></div><div className={styles.dimensionRow}>{Object.entries(contribution?.dimensions || {}).map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, ' $1')} <strong>{displayScore(value)}</strong></span>)}</div><dl className={styles.recordGrid}><div><dt>Task alignment</dt><dd>{report.task?.title || 'No direct task link'}</dd></div><div><dt>Weekly plan</dt><dd>{report.plan?.title || 'Not linked'}</dd></div><div><dt>Goal / KPI</dt><dd>{report.goal?.success_metric || report.goal?.title || 'Not linked'}</dd></div><div><dt>Evidence</dt><dd>{attachmentCount(report.attachments) > 0 ? `${attachmentCount(report.attachments)} attachment${attachmentCount(report.attachments) === 1 ? '' : 's'}` : 'No attachments'}</dd></div><div><dt>Progress</dt><dd>{report.completion_percentage ?? '—'}%</dd></div><div><dt>AI analysis</dt><dd>{contribution?.analysisUsed || contribution?.existingAnalysis ? 'Existing analysis used' : 'No eligible analysis'}</dd></div></dl>{(report.manager_feedback || []).map((feedback) => <div className={styles.feedbackStrip} key={feedback.id}><strong>Manager feedback</strong><p>{feedback.comment}</p></div>)}</article>;
  })}</div>}</section>;
}
