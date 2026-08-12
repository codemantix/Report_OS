import { componentScore, displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

export default function EvaluationScoreOverview({ evaluation }) {
  const weight = (component) => {
    const row = (evaluation.component_scores || []).find((score) => score.component === component);
    return row ? `${Number(row.weight)}%` : '—';
  };
  const items = [
    ['Task Performance', componentScore(evaluation, 'task_performance'), weight('task_performance')],
    ['Reporting Performance', componentScore(evaluation, 'reporting_performance'), weight('reporting_performance')],
    ['Attendance', componentScore(evaluation, 'attendance'), weight('attendance')],
    ['Overall Score', evaluation.calculation_status === 'complete' ? evaluation.overall_score : null, '100%'],
  ];
  return <section className={styles.scoreGrid}>{items.map(([label, score, weight]) => <article className={styles.scoreCard} key={label}><p>{label}</p><strong>{displayScore(score)}</strong><small>{weight} evaluation weight</small></article>)}</section>;
}
