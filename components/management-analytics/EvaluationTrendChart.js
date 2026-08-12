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
  const areaPolygon = points.length > 1
    ? `${points[0].x},${HEIGHT - BOTTOM} ${polyline} ${points[points.length - 1].x},${HEIGHT - BOTTOM}`
    : '';

  return (
    <article className={`${styles.panel} ${styles.trendPanel}`}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeaderTitle}>
          <span><TrendingUp size={18} aria-hidden="true" /></span>
          <div>
            <h3>Evaluation trend</h3>
            <p>Average effective overall score across evaluation periods</p>
          </div>
        </div>
      </header>
      {points.length === 0 ? (
        <div className={styles.chartEmpty}>No scored period data matches these filters.</div>
      ) : (
        <>
          <div className={styles.trendChart}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Average overall performance trend">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="18" y1={scoreY(100)} x2={WIDTH - 18} y2={scoreY(100)} />
              <line x1="18" y1={scoreY(50)} x2={WIDTH - 18} y2={scoreY(50)} />
              <line x1="18" y1={scoreY(0)} x2={WIDTH - 18} y2={scoreY(0)} />
              {points.length > 1 && (
                <>
                  <polygon points={areaPolygon} fill="url(#trendGradient)" />
                  <polyline points={polyline} />
                </>
              )}
              {points.map((point) => (
                <g key={point.periodId}>
                  <circle cx={point.x} cy={point.y} r="5" />
                  <title>{point.periodName}: {Number(point.averageOverallScore).toFixed(1)}% from {point.evaluationCount} evaluations</title>
                </g>
              ))}
            </svg>
          </div>
          <div className={styles.trendLabels}>
            {points.map((point) => (
              <div key={point.periodId}>
                <strong>{Number(point.averageOverallScore).toFixed(1)}%</strong>
                <span>{point.periodName}</span>
                <small>{point.evaluationCount} evaluation{point.evaluationCount === 1 ? '' : 's'}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
