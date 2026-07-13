import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, Layers3 } from 'lucide-react';
import { MONTH_NAMES } from '../../utils/companyGoalConstants';
import styles from './Tasks.module.css';

export default function TaskMonthCards({ tasks, selectedMonth, selectedYear, onSelectMonth }) {
  const monthGroups = useMemo(() => {
    const groups = new Map();

    tasks.forEach((task) => {
      if (!task.due_date) return;

      const dueDate = new Date(task.due_date);
      if (Number.isNaN(dueDate.getTime())) return;

      const month = dueDate.getUTCMonth() + 1;
      const year = dueDate.getUTCFullYear();
      const key = `${year}-${month}`;
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.count += 1;
      } else {
        groups.set(key, { key, month, year, count: 1 });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  }, [tasks]);

  if (monthGroups.length === 0) return null;

  const isShowingAllTasks = !selectedMonth && !selectedYear;

  return (
    <section className={styles.monthSection} aria-labelledby="task-months-title">
      <div className={styles.monthSectionHeader}>
        <div className={styles.monthSectionHeading}>
          <span className={styles.monthSectionIcon} aria-hidden="true">
            <CalendarDays size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="task-months-title" className={styles.monthSectionTitle}>Tasks by due month</h2>
            <p className={styles.monthSectionDescription}>Select a month to show its tasks in the table.</p>
          </div>
        </div>
      </div>

      <div className={styles.monthCards}>
        <button
          type="button"
          className={`${styles.monthCard} ${isShowingAllTasks ? styles.monthCardActive : ''}`}
          onClick={() => onSelectMonth('', '')}
          aria-pressed={isShowingAllTasks}
        >
          <span className={styles.monthCardGlow} aria-hidden="true" />
          <span className={styles.monthCardTop}>
            <span className={styles.monthCardIcon} aria-hidden="true">
              <Layers3 size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.monthCardStatus}>{isShowingAllTasks ? 'Selected' : 'Overview'}</span>
          </span>
          <span className={styles.monthCardContent}>
            <span className={styles.monthCardLabel}>All tasks</span>
            <span className={styles.monthCardYear}>Complete task overview</span>
          </span>
          <span className={styles.monthCardFooter}>
            <span className={styles.monthCardCount}><strong>{tasks.length}</strong> {tasks.length === 1 ? 'task' : 'tasks'}</span>
            <ArrowUpRight className={styles.monthCardArrow} size={16} aria-hidden="true" />
          </span>
        </button>

        {monthGroups.map((group) => {
          const isActive = Number(selectedMonth) === group.month && Number(selectedYear) === group.year;

          return (
            <button
              key={group.key}
              type="button"
              className={`${styles.monthCard} ${isActive ? styles.monthCardActive : ''}`}
              onClick={() => onSelectMonth(String(group.month), String(group.year))}
              aria-pressed={isActive}
              aria-label={`Show ${group.count} ${group.count === 1 ? 'task' : 'tasks'} due in ${MONTH_NAMES[group.month - 1]} ${group.year}`}
            >
              <span className={styles.monthCardGlow} aria-hidden="true" />
              <span className={styles.monthCardTop}>
                <span className={styles.monthCardIcon} aria-hidden="true">
                  <CalendarDays size={17} strokeWidth={1.8} />
                </span>
                <span className={styles.monthCardStatus}>{isActive ? 'Selected' : 'Due month'}</span>
              </span>
              <span className={styles.monthCardContent}>
                <span className={styles.monthCardLabel}>{MONTH_NAMES[group.month - 1]}</span>
                <span className={styles.monthCardYear}>{group.year}</span>
              </span>
              <span className={styles.monthCardFooter}>
                <span className={styles.monthCardCount}><strong>{group.count}</strong> {group.count === 1 ? 'task' : 'tasks'}</span>
                <ArrowUpRight className={styles.monthCardArrow} size={16} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
