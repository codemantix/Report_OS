import { BarChart3, PieChart } from 'lucide-react';
import styles from './AdminDashboardCharts.module.css';

const GOAL_STATUS_CONFIG = [
  { key: 'completed', label: 'Completed', color: '#10B981' },
  { key: 'active', label: 'Active / Other', color: '#4F46E5' },
  { key: 'delayed', label: 'Delayed', color: '#F59E0B' },
  { key: 'blocked', label: 'Blocked', color: '#EF4444' },
];

function GoalStatusChart({ stats }) {
  const totalGoals = stats?.totalGoals || 0;
  const completed = stats?.completedGoals || 0;
  const delayed = stats?.delayedGoals || 0;
  const blocked = stats?.blockedGoals || 0;
  const active = Math.max(totalGoals - completed - delayed - blocked, 0);
  const values = { completed, active, delayed, blocked };
  let offset = 0;

  const segments = GOAL_STATUS_CONFIG.map((item) => {
    const value = values[item.key];
    const percentage = totalGoals > 0 ? (value / totalGoals) * 100 : 0;
    const segment = { ...item, value, percentage, offset };
    offset += percentage;
    return segment;
  });

  return (
    <article className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}><PieChart size={18} aria-hidden="true" /></span>
        <div>
          <h2 className={styles.cardTitle}>Goal status</h2>
          <p className={styles.cardDescription}>Portfolio distribution across all goals</p>
        </div>
      </div>

      {totalGoals === 0 ? (
        <div className={styles.emptyState}>No goal data available yet.</div>
      ) : (
        <div className={styles.pieContent}>
          <div className={styles.pieChart} role="img" aria-label={`Goal status distribution for ${totalGoals} goals`}>
            <svg viewBox="0 0 100 100" className={styles.pieSvg}>
              <circle cx="50" cy="50" r="36" pathLength="100" className={styles.pieTrack} />
              {segments.filter((segment) => segment.value > 0).map((segment) => (
                <circle
                  key={segment.key}
                  cx="50"
                  cy="50"
                  r="36"
                  pathLength="100"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="15"
                  strokeDasharray={`${segment.percentage} ${100 - segment.percentage}`}
                  strokeDashoffset={-segment.offset}
                  strokeLinecap="butt"
                  className={styles.pieSegment}
                />
              ))}
            </svg>
            <div className={styles.pieCenter}>
              <strong>{totalGoals}</strong>
              <span>Total goals</span>
            </div>
          </div>

          <div className={styles.legend}>
            {segments.map((segment) => (
              <div key={segment.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: segment.color }} />
                <span className={styles.legendLabel}>{segment.label}</span>
                <strong className={styles.legendValue}>{segment.value}</strong>
                <span className={styles.legendPercent}>{Math.round(segment.percentage)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function DepartmentBarChart({ departments }) {
  const chartData = [...departments]
    .sort((a, b) => b.avgSuccess - a.avgSuccess)
    .slice(0, 8);

  return (
    <article className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <span className={`${styles.cardIcon} ${styles.barIcon}`}><BarChart3 size={18} aria-hidden="true" /></span>
        <div>
          <h2 className={styles.cardTitle}>Department success</h2>
          <p className={styles.cardDescription}>Average success score by department</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className={styles.emptyState}>No department data available yet.</div>
      ) : (
        <div className={styles.barChartWrapper}>
          <div className={styles.barScale} aria-hidden="true">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
          <div className={styles.barChart} role="img" aria-label="Average department success scores">
            {chartData.map((department) => (
              <div key={department.id} className={styles.barColumn} title={`${department.name}: ${department.avgSuccess}%`}>
                <span className={styles.barValue}>{department.avgSuccess}%</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ height: `${Math.max(department.avgSuccess, department.avgSuccess > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={styles.barLabel}>{department.name}</span>
                <span className={styles.barMeta}>{department.reportCount} reports</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function AdminDashboardChartsSkeleton() {
  return (
    <section className={styles.chartsGrid} aria-hidden="true">
      {[...Array(2)].map((_, index) => (
        <article key={index} className={`${styles.chartCard} ${styles.skeletonCard}`}>
          <div className={styles.skeletonHeader}>
            <span className={styles.skeletonIcon} />
            <div className={styles.skeletonHeaderText}>
              <span className={styles.skeletonTitle} />
              <span className={styles.skeletonDescription} />
            </div>
          </div>
          <div className={styles.skeletonChart} />
        </article>
      ))}
    </section>
  );
}

export default function AdminDashboardCharts({ stats, departmentProgress }) {
  return (
    <section className={styles.chartsGrid} aria-label="Admin analytics charts">
      <GoalStatusChart stats={stats} />
      <DepartmentBarChart departments={departmentProgress} />
    </section>
  );
}
