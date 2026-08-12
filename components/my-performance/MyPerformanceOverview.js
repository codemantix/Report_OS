import { CalendarRange, CheckCircle2, Gauge, Sparkles } from 'lucide-react';
import { componentScore, displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './MyPerformance.module.css';

export default function MyPerformanceOverview({ evaluation, currentPeriod, isHistorical = false }) {
  const approved = evaluation.approved_score !== null && evaluation.approved_score !== undefined;
  const overall = approved ? evaluation.approved_score : evaluation.overall_score;
  const band = approved ? evaluation.approved_performance_band : evaluation.performance_band;
  const period = evaluation.period || currentPeriod;
  const weight = (component) => {
    const row = (evaluation.component_scores || []).find((score) => score.component === component);
    return row ? `${Number(row.weight)}% evaluation weight` : 'Weight unavailable';
  };
  const cards = [
    ['Task Performance', componentScore(evaluation, 'task_performance'), weight('task_performance')],
    ['Reporting Performance', componentScore(evaluation, 'reporting_performance'), weight('reporting_performance')],
    ['Attendance', componentScore(evaluation, 'attendance'), weight('attendance')],
  ];
  return <>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}><CalendarRange /> {isHistorical ? 'Selected evaluation period' : 'Current evaluation period'}</span><h1>{period?.name || 'No active evaluation period'}</h1><p>{period ? `${period.start_date} to ${period.end_date}` : 'Your next evaluation period has not been opened.'}</p></div>
      <div className={styles.overall}><span>{approved ? <CheckCircle2 /> : <Gauge />}</span><div><small>{approved ? 'Approved overall score' : 'Calculated overall score'}</small><strong>{displayScore(overall)} / 100</strong><p>{band || 'Not calculated'}</p></div></div>
    </section>
    <section className={styles.scoreGrid}>{cards.map(([label, score, hint]) => <article key={label}><span><Sparkles /></span><div><p>{label}</p><strong>{displayScore(score)}</strong><small>{hint}</small></div></article>)}</section>
  </>;
}
