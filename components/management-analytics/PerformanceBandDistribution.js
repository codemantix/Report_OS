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
  return <article className={styles.panel}><header className={styles.panelHeader}><span><Layers3 size={18} aria-hidden="true" /></span><div><h3>Performance-band distribution</h3><p>Stored approved band, or calculated fallback</p></div></header>{total === 0 ? <div className={styles.chartEmpty}>No scored evaluations match these filters.</div> : <div className={styles.bandList}>{bands.map((item) => { const percentage = (Number(item.count) / total) * 100; return <div className={styles.bandRow} key={item.band}><div><span className={`${styles.bandDot} ${BAND_CLASS[item.band] || styles.bandDefault}`} /><strong>{item.band}</strong><small>{item.count} · {percentage.toFixed(1)}%</small></div><progress max="100" value={percentage} aria-label={`${item.band}: ${percentage.toFixed(1)} percent`} /></div>; })}</div>}</article>;
}
