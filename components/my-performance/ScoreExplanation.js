import { ClipboardCheck, FileText, UserCheck } from 'lucide-react';
import { displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './MyPerformance.module.css';

function component(evaluation, name) {
  return (evaluation.component_scores || []).find((score) => score.component === name) || {};
}

export default function ScoreExplanation({ evaluation }) {
  const task = component(evaluation, 'task_performance');
  const reporting = component(evaluation, 'reporting_performance');
  const attendance = component(evaluation, 'attendance');
  const taskSummary = task.evidence_metrics?.summary || {};
  const reportSummary = reporting.evidence_metrics?.summary || {};
  const reportSubmission = reporting.evidence_metrics?.submissionCompliance || {};
  const attendanceMetrics = attendance.evidence_metrics || {};
  const items = [
    {
      title: 'Task Performance', icon: ClipboardCheck, score: task.raw_score,
      text: `${taskSummary.scoredTaskCount ?? 0} eligible assigned tasks contributed. Status, deliverables, KPI progress, evidence, and manager review are scored for each actual task.`,
      details: [`${taskSummary.completedTaskCount ?? 0} completed`, `${taskSummary.tasksWithEvidence ?? 0} with evidence`, `${taskSummary.reviewedTaskCount ?? 0} reviewed`],
    },
    {
      title: 'Reporting Performance', icon: FileText, score: reporting.raw_score,
      text: `${reportSummary.reportCount ?? 0} existing reports contributed. Submission timing, completeness, task/goal alignment, progress, quality/evidence, and review state determine the score.`,
      details: [`${reportSubmission.submittedCount ?? reportSummary.reportCount ?? 0} submitted`, `${reportSubmission.onTimeCount ?? 0} on time`, `${reportSummary.reviewedReportCount ?? 0} reviewed`],
    },
    {
      title: 'Attendance', icon: UserCheck, score: attendance.raw_score,
      text: `${attendanceMetrics.totalApplicableSessions ?? 0} confirmed or corrected sessions contributed. Present, Late, Absent, and Excused use the configured attendance rules.`,
      details: [`${attendanceMetrics.present ?? 0} present`, `${attendanceMetrics.late ?? 0} late`, `${attendanceMetrics.absent ?? 0} absent`, `${attendanceMetrics.excused ?? 0} excused`],
    },
  ];
  return <section className={styles.explanationSection}><div className={styles.sectionHeader}><div><h2>How your scores were calculated</h2><p>Every value comes from existing Report OS records for this evaluation period.</p></div></div><div className={styles.explanationGrid}>{items.map(({ title, icon: Icon, score, text, details }) => <article key={title}><span><Icon /></span><div><div className={styles.explanationTitle}><h3>{title}</h3><strong>{displayScore(score)}</strong></div><p>{text}</p><div className={styles.metrics}>{details.map((detail) => <small key={detail}>{detail}</small>)}</div></div></article>)}</div></section>;
}
