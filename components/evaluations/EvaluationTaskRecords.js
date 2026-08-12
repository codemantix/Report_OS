import Link from 'next/link';
import { ExternalLink, Paperclip } from 'lucide-react';
import { displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

function taskEvaluationMetrics(evaluation) {
  const component = (evaluation.component_scores || []).find((score) => score.component === 'task_performance');
  return {
    componentWeight: Number(component?.weight || 0),
    byTask: new Map((component?.evidence_metrics?.tasks || []).map((task) => [task.taskId, task])),
  };
}

export default function EvaluationTaskRecords({ evaluation }) {
  const tasks = evaluation.source_records?.tasks || [];
  const metrics = taskEvaluationMetrics(evaluation);
  return (
    <section className={styles.detailSection} id="task-performance">
      <div className={styles.sectionHeader}><div><h3>Task Performance</h3><p>Actual assigned tasks from the existing task assignment system.</p></div></div>
      {tasks.length === 0 ? <p className={styles.noData}>No applicable assigned tasks were found for this period.</p> : (
        <div className={styles.sourceList}>{tasks.map((task) => {
          const contribution = metrics.byTask.get(task.id);
          const overallContribution = contribution?.includedInScore
            ? (Number(contribution.normalizedContribution) * metrics.componentWeight) / 100
            : null;
          const reportCount = (task.reports || []).length;
          const attachments = (task.reports || []).reduce((count, report) => {
            try { const parsed = typeof report.attachments === 'string' ? JSON.parse(report.attachments) : report.attachments; return count + (Array.isArray(parsed) ? parsed.length : 0); } catch { return count; }
          }, 0);
          return <article className={styles.sourceCard} key={task.id}>
            <div className={styles.sourceHeader}><div><Link href={`/dashboard/tasks/${task.id}`}>{task.title} <ExternalLink aria-hidden="true" /></Link><p>{task.status} · {task.priority || 'medium'} priority</p></div><div className={styles.contribution}><span>Contribution</span><strong>{overallContribution === null ? 'Excluded' : `${displayScore(overallContribution)} pts`}</strong></div></div>
            <dl className={styles.recordGrid}>
              <div><dt>Weekly plan</dt><dd>{task.plan ? <Link href={`/dashboard/plans/${task.plan.id}`}>{task.plan.title}</Link> : 'Not linked'}</dd></div>
              <div><dt>Expected deliverable</dt><dd>{task.expected_output || task.goal?.expected_deliverables || 'Not configured'}</dd></div>
              <div><dt>KPI</dt><dd>{task.goal?.success_metric || 'Not configured'}</dd></div>
              <div><dt>Due date</dt><dd>{task.due_date || 'No due date'}</dd></div>
              <div><dt>Completion</dt><dd>{task.completed_at ? new Date(task.completed_at).toLocaleString() : `${task.status}`}</dd></div>
              <div><dt>Evidence</dt><dd><Paperclip aria-hidden="true" /> {reportCount} submission{reportCount === 1 ? '' : 's'}, {attachments} attachment{attachments === 1 ? '' : 's'}</dd></div>
            </dl>
            {contribution?.reasons?.length > 0 && <div className={styles.explanation}><strong>Why it contributed this result</strong><ul>{contribution.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>}
            {(task.manager_feedback || []).length > 0 && <div className={styles.feedbackStrip}><strong>Manager feedback</strong>{task.manager_feedback.map((feedback) => <p key={feedback.id}>{feedback.comment}</p>)}</div>}
          </article>;
        })}</div>
      )}
    </section>
  );
}
