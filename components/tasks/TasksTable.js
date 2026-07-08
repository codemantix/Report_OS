import { useRouter } from 'next/router';
import { useRef } from 'react';
import { formatDate } from '../../utils/dateHelpers';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Tasks.module.css';
import Image from 'next/image';

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

export default function TasksTable({ tasks, emptyMessage = 'No tasks found.', isAdmin = false, selectedIds = [], onSelectionChange }) {
  const router = useRouter();
  
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  function isOverdue(dueDate, status) {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(tasks.map((t) => t.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (e, taskId) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange([...selectedIds, taskId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== taskId));
    }
  };

  const startPress = (e, taskId) => {
    if (!isAdmin) return;
    if (selectedIds.length > 0) return; // already in selection mode
    
    // Only handle left click on mouse
    if (e.type === 'mousedown' && e.button !== 0) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onSelectionChange([taskId]);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleRowClick = (e, task) => {
    // If a long press was triggered, reset status and ignore this click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (selectedIds.length > 0) {
      e.preventDefault();
      if (selectedIds.includes(task.id)) {
        onSelectionChange(selectedIds.filter((id) => id !== task.id));
      } else {
        onSelectionChange([...selectedIds, task.id]);
      }
    } else {
      router.push(`/dashboard/tasks/${task.id}`);
    }
  };

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

  const isSelectionActive = isAdmin && selectedIds.length > 0;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isSelectionActive && (
              <th className={styles.th} style={{ width: '40px', paddingLeft: '16px' }}>
                <input
                  type="checkbox"
                  id="select-all-tasks"
                  checked={tasks.length > 0 && selectedIds.length === tasks.length}
                  onChange={handleSelectAll}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="Select all tasks"
                />
              </th>
            )}
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
            const isSelected = selectedIds.includes(task.id);
            return (
              <tr
                key={task.id}
                className={`${styles.tr} ${isSelected ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                onMouseDown={(e) => startPress(e, task.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={(e) => startPress(e, task.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onClick={(e) => handleRowClick(e, task)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {isSelectionActive && (
                  <td className={styles.td} style={{ paddingLeft: '16px' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      id={`checkbox-task-${task.id}`}
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(e, task.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select task ${task.title}`}
                    />
                  </td>
                )}
                <td className={`${styles.td} ${styles.userName}`}>{task.title}</td>
                <td className={styles.td}>{task.departments?.name || 'N/A'}</td>
                <td className={styles.td}>
                  <div
                    className="text-sm truncate max-w-[180px]"
                    style={{ color: 'var(--color-text)' }}
                    title={
                      task.task_assignees && task.task_assignees.length > 0
                        ? task.task_assignees.map((a) => getProfileDisplayName(a.users, 'User')).join(', ')
                        : 'Unassigned'
                    }
                  >
                    {task.task_assignees && task.task_assignees.length > 0
                      ? task.task_assignees.map((a) => getProfileDisplayName(a.users, 'User')).join(', ')
                      : 'Unassigned'}
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
