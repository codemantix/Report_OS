import { MessageSquareText } from 'lucide-react';
import styles from './MyPerformance.module.css';

function authorName(author) {
  return author?.full_name || author?.display_name || 'Manager';
}

export default function MyManagerFeedback({ evaluation, sourceRecords }) {
  const taskFeedback = (sourceRecords?.tasks || []).flatMap((task) => [
    ...(task.manager_feedback || []).map((feedback) => ({ ...feedback, context: task.title })),
    ...(task.reports || []).flatMap((report) => (report.manager_feedback || []).map((feedback) => ({ ...feedback, context: report.project_name || task.title }))),
  ]);
  const reportFeedback = (sourceRecords?.reports || []).flatMap((report) => (
    report.manager_feedback || []
  ).map((feedback) => ({ ...feedback, context: report.project_name || 'Report' })));
  const reviewFeedback = (evaluation.employee_visible_comments || []).map((feedback) => ({
    ...feedback, context: 'Evaluation review',
  }));
  const feedback = [...new Map([...taskFeedback, ...reportFeedback, ...reviewFeedback]
    .map((item) => [item.id, item])).values()];
  return <section className={styles.feedbackSection}><div className={styles.sectionHeader}><div><h2>Manager feedback</h2><p>Feedback shared with you from the tasks, reports, and evaluation review used in this result.</p></div><MessageSquareText /></div>{feedback.length === 0 ? <p className={styles.emptyText}>No employee-visible manager feedback is attached to this evaluation.</p> : <div className={styles.feedbackGrid}>{feedback.map((item) => <article key={item.id}><strong>{item.context}</strong><p>{item.comment}</p><small>{authorName(item.author)}{item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ''}</small></article>)}</div>}</section>;
}
