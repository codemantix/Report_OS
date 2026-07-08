import { useRouter } from 'next/router';
import { useRef } from 'react';
import { formatDate } from '../../utils/dateHelpers';
import styles from './Goals.module.css';

const PRIORITY_COLORS = {
  low: 'text-gray-700 bg-gray-100',
  medium: 'text-amber-700 bg-amber-100',
  high: 'text-red-700 bg-red-100',
  urgent: 'text-purple-700 bg-purple-100',
};

const STATUS_COLORS = {
  not_started: 'text-gray-700 bg-gray-100',
  in_progress: 'text-blue-700 bg-blue-100',
  completed: 'text-green-700 bg-green-100',
  delayed: 'text-red-700 bg-red-100',
  blocked: 'text-orange-700 bg-orange-100',
  cancelled: 'text-gray-500 bg-gray-100',
};

export default function GoalsTable({ goals, isAdmin = false, selectedIds = [], onSelectionChange }) {
  const router = useRouter();

  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  function getAssigneeCount(goal) {
    return goal.goal_assignees?.length || 0;
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(goals.map((g) => g.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (e, goalId) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange([...selectedIds, goalId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== goalId));
    }
  };

  const startPress = (e, goalId) => {
    if (!isAdmin) return;
    if (selectedIds.length > 0) return; // already in selection mode
    
    // Only handle left click on mouse
    if (e.type === 'mousedown' && e.button !== 0) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onSelectionChange([goalId]);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleRowClick = (e, goal) => {
    // If a long press was triggered, reset status and ignore this click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (selectedIds.length > 0) {
      e.preventDefault();
      if (selectedIds.includes(goal.id)) {
        onSelectionChange(selectedIds.filter((id) => id !== goal.id));
      } else {
        onSelectionChange([...selectedIds, goal.id]);
      }
    } else {
      router.push(`/dashboard/goals/${goal.id}`);
    }
  };

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
                  id="select-all-goals"
                  checked={goals.length > 0 && selectedIds.length === goals.length}
                  onChange={handleSelectAll}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="Select all goals"
                />
              </th>
            )}
            <th className={styles.th}>Title</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Priority</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Due Date</th>
            <th className={styles.th}>Assignees</th>
          </tr>
        </thead>
        <tbody>
          {goals.map((goal) => {
            const isSelected = selectedIds.includes(goal.id);
            return (
              <tr
                key={goal.id}
                className={`${styles.tr} ${isSelected ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                onMouseDown={(e) => startPress(e, goal.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={(e) => startPress(e, goal.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onClick={(e) => handleRowClick(e, goal)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {isSelectionActive && (
                  <td className={styles.td} style={{ paddingLeft: '16px' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      id={`checkbox-goal-${goal.id}`}
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(e, goal.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select goal ${goal.title}`}
                    />
                  </td>
                )}
                <td className={[styles.td, 'font-medium text-gray-900 dark:text-gray-100'].join(' ')}>
                  {goal.title}
                </td>
                <td className={styles.td}>
                  {goal.departments?.name || 'N/A'}
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.low}`}>
                    {goal.priority}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${STATUS_COLORS[goal.status] || STATUS_COLORS.not_started}`}>
                    {goal.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={styles.td}>{formatDate(goal.due_date)}</td>
                <td className={styles.td}>{getAssigneeCount(goal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
