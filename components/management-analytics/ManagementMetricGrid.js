import { AlertCircle, CalendarClock, ClipboardCheck, FileText, Target, UserCheck } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

function score(value) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
}

const SCORE_METRICS = [
  { key: 'averageOverallScore', sampleKey: 'overallSampleSize', label: 'Average overall', icon: Target, detail: 'Human-approved score, with legacy calculated fallback' },
  { key: 'averageTaskScore', sampleKey: 'taskSampleSize', label: 'Task Performance', icon: ClipboardCheck, detail: 'Original calculated task components' },
  { key: 'averageReportingScore', sampleKey: 'reportingSampleSize', label: 'Reporting Performance', icon: FileText, detail: 'Original calculated reporting components' },
  { key: 'averageAttendanceScore', sampleKey: 'attendanceSampleSize', label: 'Attendance Performance', icon: UserCheck, detail: 'Original calculated attendance components' },
];

export default function ManagementMetricGrid({ summary }) {
  const metrics = [
    ...SCORE_METRICS.map((metric) => ({
      ...metric,
      value: score(summary[metric.key]),
      detail: `${metric.detail} · n=${summary[metric.sampleKey] ?? 0}`,
    })),
    { label: 'Pending evaluations', icon: CalendarClock, value: summary.pendingEvaluations ?? 0, detail: 'Draft, scoring, or incomplete' },
    { label: 'Pending approvals', icon: AlertCircle, value: summary.pendingApprovals ?? 0, detail: 'Awaiting human authorization', warning: Number(summary.pendingApprovals) > 0 },
  ];
  return <section className={styles.metricGrid} aria-label="Evaluation performance summary">{metrics.map(({ label, icon: Icon, value, detail, warning }) => <article className={`${styles.metricCard} ${warning ? styles.warningCard : ''}`} key={label}><span className={styles.metricIcon}><Icon size={19} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>)}</section>;
}
