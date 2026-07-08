import { useRouter } from 'next/router';
import { useRef } from 'react';
import { formatDate } from '../../utils/dateHelpers';
import styles from './Plans.module.css';

const TYPE_COLORS = {
  daily: 'text-sky-700 bg-sky-100',
  weekly: 'text-indigo-700 bg-indigo-100',
  monthly: 'text-blue-700 bg-blue-100',
  quarterly: 'text-purple-700 bg-purple-100',
  project: 'text-emerald-700 bg-emerald-100',
};

export default function PlansTable({ plans, isAdmin = false, selectedIds = [], onSelectionChange }) {
  const router = useRouter();

  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(plans.map((p) => p.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (e, planId) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange([...selectedIds, planId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== planId));
    }
  };

  const startPress = (e, planId) => {
    if (!isAdmin) return;
    if (selectedIds.length > 0) return; // already in selection mode
    
    // Only handle left click on mouse
    if (e.type === 'mousedown' && e.button !== 0) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onSelectionChange([planId]);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleRowClick = (e, plan) => {
    // If a long press was triggered, reset status and ignore this click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (selectedIds.length > 0) {
      e.preventDefault();
      if (selectedIds.includes(plan.id)) {
        onSelectionChange(selectedIds.filter((id) => id !== plan.id));
      } else {
        onSelectionChange([...selectedIds, plan.id]);
      }
    } else {
      router.push(`/dashboard/plans/${plan.id}`);
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
                  id="select-all-plans"
                  checked={plans.length > 0 && selectedIds.length === plans.length}
                  onChange={handleSelectAll}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="Select all plans"
                />
              </th>
            )}
            <th className={styles.th}>Title</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Start Date</th>
            <th className={styles.th}>End Date</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const isSelected = selectedIds.includes(plan.id);
            return (
              <tr
                key={plan.id}
                className={`${styles.tr} ${isSelected ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                onMouseDown={(e) => startPress(e, plan.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={(e) => startPress(e, plan.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onClick={(e) => handleRowClick(e, plan)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {isSelectionActive && (
                  <td className={styles.td} style={{ paddingLeft: '16px' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      id={`checkbox-plan-${plan.id}`}
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(e, plan.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select plan ${plan.title}`}
                    />
                  </td>
                )}
                <td className={[styles.td, 'font-medium text-gray-900 dark:text-gray-100'].join(' ')}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
