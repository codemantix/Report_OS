import { useRouter } from 'next/router';
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

export default function GoalsTable({ goals }) {
  const router = useRouter();

  function getAssigneeCount(goal) {
    return goal.goal_assignees?.length || 0;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Title</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Priority</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Due Date</th>
            <th className={styles.th}>Assignees</th>
          </tr>
        </thead>
        <tbody>
          {goals.map((goal) => (
            <tr
              key={goal.id}
              className={styles.tr}
              onClick={() => router.push(`/dashboard/goals/${goal.id}`)}
            >
              <td className={[styles.td, 'font-medium text-gray-900'].join(' ')}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
