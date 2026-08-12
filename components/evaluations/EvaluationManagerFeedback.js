import { MessageSquareText } from 'lucide-react';
import styles from './Evaluations.module.css';

export default function EvaluationManagerFeedback({ evaluation }) {
  const taskFeedback = (evaluation.source_records?.tasks || []).flatMap((task) => [
    ...(task.manager_feedback || []).map((feedback) => ({ ...feedback, context: task.title })),
    ...(task.reports || []).flatMap((report) => (report.manager_feedback || []).map((feedback) => ({ ...feedback, context: report.project_name || task.title }))),
  ]);
  const reportFeedback = (evaluation.source_records?.reports || []).flatMap((report) => (report.manager_feedback || []).map((feedback) => ({ ...feedback, context: report.project_name || 'Report' })));
  const unique = [...new Map([...taskFeedback, ...reportFeedback].map((feedback) => [feedback.id, feedback])).values()];
  return <section className={styles.detailSection}><div className={styles.sectionHeader}><div><h3>Manager Feedback</h3><p>Feedback attached to the actual tasks and reports used by this evaluation.</p></div><MessageSquareText aria-hidden="true" /></div>{unique.length === 0 ? <p className={styles.noData}>No manager feedback is attached to the applicable source records.</p> : <div className={styles.feedbackList}>{unique.map((feedback) => <article key={feedback.id}><strong>{feedback.context}</strong><p>{feedback.comment}</p><small>{feedback.author?.full_name || feedback.author?.display_name || 'Manager'} · {feedback.created_at ? new Date(feedback.created_at).toLocaleString() : ''}</small></article>)}</div>}</section>;
}
