import { useRouter } from 'next/router';
import { formatDate } from '../../utils/dateHelpers';
import styles from './Tasks.module.css';

const STATUS_STYLES = {
  todo: styles.statusTodo,
  in_progress: styles.statusInProgress,
  in_review: styles.statusInReview,
  completed: styles.statusCompleted,
  blocked: styles.statusBlocked,
  delayed: styles.statusDelayed,
  cancelled: styles.statusCancelled,
};

const PRIORITY_STYLES = {
  urgent: styles.priorityUrgent,
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
};

export default function MyTasksList({ tasks, emptyMessage = 'No tasks assigned to you yet.' }) {
  const router = useRouter();

  function isOverdue(dueDate, status) {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((item) => {
        const task = item.tasks;
        if (!task) return null;
        const overdue = isOverdue(task.due_date, task.status);

        return (
          <div
            key={item.id}
            className="rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{task.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`${styles.badge} ${STATUS_STYLES[task.status] || styles.statusTodo}`}>
                    {task.status?.replace(/_/g, ' ')}
                  </span>
                  <span className={`${styles.badge} ${PRIORITY_STYLES[task.priority] || styles.priorityLow}`}>
                    {task.priority}
                  </span>
                  {task.departments && (
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{task.departments.name}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {task.due_date && (
                  <span className={overdue ? styles.overdue : styles.dueDate}>
                    {formatDate(task.due_date)}
                    {overdue && ' (overdue)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
