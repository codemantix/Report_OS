import { Layers3 } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

const BAND_CLASS = {
  Excellent: styles.bandExcellent,
  'Very Good': styles.bandVeryGood,
  Good: styles.bandGood,
  'Needs Improvement': styles.bandNeedsImprovement,
  'Review Required': styles.bandReviewRequired,
};

export default function PerformanceBandDistribution({ bands }) {
  const total = bands.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeaderTitle}>
          <span><Layers3 size={18} aria-hidden="true" /></span>
          <div>
            <h3>Performance-band distribution</h3>
            <p>Approved score band, or calculated fallback</p>
          </div>
        </div>
      </header>
      {total === 0 ? (
        <div className={styles.chartEmpty}>No scored evaluations match these filters.</div>
      ) : (
        <>
          <div className={styles.bandStackedBar} title="Overall band proportions">
            {bands.map((item) => {
              const percentage = (Number(item.count) / total) * 100;
              if (percentage === 0) return null;
              return (
                <div
                  key={item.band}
                  className={`${styles.bandStackedSegment} ${BAND_CLASS[item.band] || styles.bandDefault}`}
                  style={{ width: `${percentage}%` }}
                  title={`${item.band}: ${item.count} (${percentage.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          <div className={styles.bandList}>
            {bands.map((item) => {
              const percentage = (Number(item.count) / total) * 100;
              return (
                <div className={styles.bandRow} key={item.band}>
                  <div className={styles.bandRowHeader}>
                    <div className={styles.bandRowLabel}>
                      <span className={`${styles.bandDot} ${BAND_CLASS[item.band] || styles.bandDefault}`} />
                      <strong>{item.band}</strong>
                    </div>
                    <small>{item.count} evals · {percentage.toFixed(1)}%</small>
                  </div>
                  <progress max="100" value={percentage} aria-label={`${item.band}: ${percentage.toFixed(1)} percent`} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
