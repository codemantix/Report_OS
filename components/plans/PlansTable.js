import { useRouter } from 'next/router';
import { formatDate } from '../../utils/dateHelpers';
import styles from './Plans.module.css';

const TYPE_COLORS = {
  daily: 'text-sky-700 bg-sky-100',
  weekly: 'text-indigo-700 bg-indigo-100',
  monthly: 'text-blue-700 bg-blue-100',
  quarterly: 'text-purple-700 bg-purple-100',
  project: 'text-emerald-700 bg-emerald-100',
};

export default function PlansTable({ plans }) {
  const router = useRouter();

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Title</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Start Date</th>
            <th className={styles.th}>End Date</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr
              key={plan.id}
              className={styles.tr}
              onClick={() => router.push(`/dashboard/plans/${plan.id}`)}
            >
              <td className={[styles.td, 'font-medium text-gray-900'].join(' ')}>
                {plan.title}
              </td>
              <td className={styles.td}>
                {plan.departments?.name || 'N/A'}
              </td>
              <td className={styles.td}>
                <span className={`${styles.typeBadge} ${TYPE_COLORS[plan.plan_type] || TYPE_COLORS.monthly}`}>
                  {plan.plan_type}
                </span>
              </td>
              <td className={styles.td}>{formatDate(plan.start_date)}</td>
              <td className={styles.td}>{formatDate(plan.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
