import { ChevronRight, History } from 'lucide-react';
import { displayScore } from '../../utils/evaluationDashboardConstants';
import styles from './MyPerformance.module.css';

export default function PerformanceHistory({ history, selectedId, loadingId, onSelect }) {
  const previous = history.filter((item) => item.id !== selectedId);
  return <section className={styles.historySection}><div className={styles.sectionHeader}><div><h2>Other evaluation periods</h2><p>Switch between your current and previous calculated or human-approved results.</p></div><History /></div>{previous.length === 0 ? <p className={styles.emptyText}>No other evaluation periods are available.</p> : <div className={styles.historyList}>{previous.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item.id)} disabled={loadingId === item.id}><div><strong>{item.period?.name || 'Evaluation period'}</strong><span>{item.period?.start_date} to {item.period?.end_date}</span></div><div className={styles.historyResult}><strong>{displayScore(item.score)}</strong><span>{item.performance_band || 'Not calculated'} · {item.result_type}</span></div><ChevronRight /></button>)}</div>}</section>;
}
