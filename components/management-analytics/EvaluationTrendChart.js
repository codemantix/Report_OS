import { TrendingUp } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

const WIDTH = 640;
const HEIGHT = 180;
const TOP = 18;
const BOTTOM = 32;

function scoreY(score) {
  return TOP + ((100 - Number(score)) / 100) * (HEIGHT - TOP - BOTTOM);
}

export default function EvaluationTrendChart({ trends }) {
  const scored = trends.filter((item) => item.averageOverallScore !== null && item.averageOverallScore !== undefined);
  const points = scored.map((item, index) => {
    const x = scored.length === 1 ? WIDTH / 2 : 18 + (index / (scored.length - 1)) * (WIDTH - 36);
    return { ...item, x, y: scoreY(item.averageOverallScore) };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');

  return <article className={`${styles.panel} ${styles.trendPanel}`}><header className={styles.panelHeader}><span><TrendingUp size={18} aria-hidden="true" /></span><div><h3>Evaluation trend</h3><p>Average effective overall score across evaluation periods</p></div></header>{points.length === 0 ? <div className={styles.chartEmpty}>No scored period data matches these filters.</div> : <><div className={styles.trendChart}><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Average overall performance trend"><line x1="18" y1={scoreY(100)} x2={WIDTH - 18} y2={scoreY(100)} /><line x1="18" y1={scoreY(50)} x2={WIDTH - 18} y2={scoreY(50)} /><line x1="18" y1={scoreY(0)} x2={WIDTH - 18} y2={scoreY(0)} />{points.length > 1 && <polyline points={polyline} />}{points.map((point) => <g key={point.periodId}><circle cx={point.x} cy={point.y} r="5" /><title>{point.periodName}: {Number(point.averageOverallScore).toFixed(1)}% from {point.evaluationCount} evaluations</title></g>)}</svg></div><div className={styles.trendLabels}>{points.map((point) => <div key={point.periodId}><strong>{Number(point.averageOverallScore).toFixed(1)}%</strong><span>{point.periodName}</span><small>{point.evaluationCount} evaluations</small></div>)}</div></>}</article>;
}
