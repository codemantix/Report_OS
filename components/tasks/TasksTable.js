import { useRouter } from 'next/router';
import { formatDate } from '../../utils/dateHelpers';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Tasks.module.css';

const PRIORITY_STYLES = {
  urgent: styles.priorityUrgent,
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
};

const STATUS_STYLES = {
  todo: styles.statusTodo,
  in_progress: styles.statusInProgress,
  in_review: styles.statusInReview,
  completed: styles.statusCompleted,
  blocked: styles.statusBlocked,
  delayed: styles.statusDelayed,
  cancelled: styles.statusCancelled,
};

export default function TasksTable({ tasks, emptyMessage = 'No tasks found.' }) {
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
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Title</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Assignees</th>
            <th className={styles.th}>Priority</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Due Date</th>
            <th className={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            return (
              <tr
                key={task.id}
                className={styles.tr}
                onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td className={`${styles.td} ${styles.userName}`}>{task.title}</td>
                <td className={styles.td}>{task.departments?.name || 'N/A'}</td>
                <td className={styles.td}>
                  <div className="flex items-center gap-1">
                    {(task.task_assignees || []).slice(0, 3).map((assignee) => (
                      <span key={assignee.users?.id || Math.random()} className={styles.userAvatar} title={getProfileDisplayName(assignee.users, 'User')}>
                        {assignee.users?.avatar_url ? (
                          <img src={assignee.users.avatar_url} alt="" className={styles.userAvatarImage} />
                        ) : (
                          getProfileInitials(assignee.users, 'U')
                        )}
                      </span>
                    ))}
                    {(task.task_assignees || []).length > 3 && (
                      <span className="text-xs ml-1" style={{ color: 'var(--color-muted)' }}>+{task.task_assignees.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${PRIORITY_STYLES[task.priority] || styles.priorityLow}`}>{task.priority}</span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${STATUS_STYLES[task.status] || styles.statusTodo}`}>{task.status?.replace(/_/g, ' ')}</span>
                </td>
                <td className={styles.td}>
                  <span className={overdue ? styles.overdue : styles.dueDate}>
                    {task.due_date ? formatDate(task.due_date) : '—'}
                    {overdue && ' (overdue)'}
                  </span>
                </td>
                <td className={styles.td}>{formatDate(task.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
