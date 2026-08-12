import { AlertCircle, CalendarClock, ClipboardCheck, FileText, Target, UserCheck } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

function score(value) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
}

function formatSample(count) {
  const n = Number(count) || 0;
  return `${n} evaluation${n === 1 ? '' : 's'}`;
}

const SCORE_METRICS = [
  { key: 'averageOverallScore', sampleKey: 'overallSampleSize', label: 'Average overall', icon: Target, iconClass: styles.metricIconIndigo, detail: 'Approved final score (or calculated rate)' },
  { key: 'averageTaskScore', sampleKey: 'taskSampleSize', label: 'Task Performance', icon: ClipboardCheck, iconClass: styles.metricIconEmerald, detail: 'Calculated from completed tasks' },
  { key: 'averageReportingScore', sampleKey: 'reportingSampleSize', label: 'Reporting Performance', icon: FileText, iconClass: styles.metricIconCyan, detail: 'Calculated from team reports' },
  { key: 'averageAttendanceScore', sampleKey: 'attendanceSampleSize', label: 'Attendance Performance', icon: UserCheck, iconClass: styles.metricIconBlue, detail: 'Calculated from attendance records' },
];

export default function ManagementMetricGrid({ summary }) {
  const metrics = [
    ...SCORE_METRICS.map((metric) => ({
      ...metric,
      value: score(summary[metric.key]),
      detail: `${metric.detail} · ${formatSample(summary[metric.sampleKey])}`,
    })),
    { label: 'Pending evaluations', icon: CalendarClock, iconClass: styles.metricIconAmber, value: summary.pendingEvaluations ?? 0, detail: 'Draft, scoring, or incomplete' },
    { label: 'Pending approvals', icon: AlertCircle, iconClass: styles.metricIconViolet, value: summary.pendingApprovals ?? 0, detail: 'Awaiting manager approval', warning: Number(summary.pendingApprovals) > 0 },
  ];

  return (
    <section className={styles.metricGrid} aria-label="Evaluation performance summary">
      {metrics.map(({ label, icon: Icon, iconClass, value, detail, warning }) => (
        <article className={`${styles.metricCard} ${warning ? styles.warningCard : ''}`} key={label}>
          <div className={styles.metricTop}>
            <small>{label}</small>
            <span className={`${styles.metricIcon} ${iconClass}`}><Icon size={19} aria-hidden="true" /></span>
          </div>
          <strong>{value}</strong>
          <p>{detail}</p>
        </article>
      ))}
    </section>
  );
}
