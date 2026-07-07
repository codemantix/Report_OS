import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import GoalForm from '../../../components/goals/GoalForm';
import { fetchGoalById, updateGoal, deleteGoal } from '../../../services/goalService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { formatDate, formatDateForInput } from '../../../utils/dateHelpers';
import { getProfileDisplayName, getProfileInitials } from '../../../utils/profileHelpers';
import styles from '../../../components/goals/Goals.module.css';

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

export default function GoalDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [goal, setGoal] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [goalResult, deptResult, usersResult] = await Promise.all([
        fetchGoalById(id),
        fetchDepartments(),
        fetchUsers({ status: 'active' }),
      ]);

      if (goalResult.error) {
        setError(goalResult.error.message);
        return;
      }

      if (!goalResult.data) {
        setError('Goal not found');
        return;
      }

      setGoal(goalResult.data);
      setDepartments(deptResult.data || []);
      setUsers(usersResult.data || []);
    } catch {
      setError('Failed to load goal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadUser() {
      const profile = await getCurrentUserProfile();
      setUser(profile);
    }
    loadUser();
  }, []);

  const canManage = user && (user.role === 'admin' || user.role === 'department_lead');

  async function handleUpdate(formData) {
    setSaving(true);
    try {
      const { error } = await updateGoal(id, formData);
      if (error) {
        toast.error(error.message || 'Failed to update goal');
        return;
      }
      toast.success('Goal updated successfully');
      setEditing(false);
      loadData();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await deleteGoal(id);
      if (error) {
        toast.error(error.message || 'Failed to delete goal');
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      toast.success('Goal deleted successfully');
      router.push('/dashboard/goals');
    } catch {
      toast.error('An unexpected error occurred');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/dashboard/goals')}
          >
            &larr; Back to Goals
          </button>
          <div className={styles.errorState}>
            <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className={styles.errorText}>Something went wrong</p>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retryBtn} onClick={loadData}>
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!goal) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/dashboard/goals')}
          >
            &larr; Back to Goals
          </button>
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={styles.emptyText}>Goal not found</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (editing) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => setEditing(false)}
          >
            &larr; Cancel Editing
          </button>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Edit Goal</h1>
              <p className={styles.subtitle}>Update goal details</p>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Goal Details</h2>
            <GoalForm
              initialData={goal}
              departments={departments}
              users={users}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
              loading={saving}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <button
          className={styles.backBtn}
          onClick={() => router.push('/dashboard/goals')}
        >
          &larr; Back to Goals
        </button>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{goal.title}</h1>
            <p className={styles.subtitle}>
              {goal.departments?.name || 'No department'}
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                className={styles.editBtn}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <div className={styles.detailGrid}>
            <div>
              <p className={styles.detailLabel}>Priority</p>
              <p className={styles.detailValue}>
                <span className={`${styles.badge} ${PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.low}`}>
                  {goal.priority}
                </span>
              </p>
            </div>
            <div>
              <p className={styles.detailLabel}>Status</p>
              <p className={styles.detailValue}>
                <span className={`${styles.badge} ${STATUS_COLORS[goal.status] || STATUS_COLORS.not_started}`}>
                  {goal.status?.replace(/_/g, ' ')}
                </span>
              </p>
            </div>
            <div>
              <p className={styles.detailLabel}>Start Date</p>
              <p className={styles.detailValue}>{formatDate(goal.start_date) || 'N/A'}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>Due Date</p>
              <p className={styles.detailValue}>{formatDate(goal.due_date) || 'N/A'}</p>
            </div>
          </div>
        </div>

        {goal.description && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{goal.description}</p>
          </div>
        )}

        {goal.success_metric && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Success Metric</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{goal.success_metric}</p>
          </div>
        )}

        {goal.expected_deliverables && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Expected Deliverables</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{goal.expected_deliverables}</p>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Assignees ({goal.goal_assignees?.length || 0})
          </h2>
          {goal.goal_assignees && goal.goal_assignees.length > 0 ? (
            <div className={styles.assigneesList}>
              {goal.goal_assignees.map((assignee) => (
                <div key={assignee.users?.id || Math.random()} className={styles.assigneeItem}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                    {getProfileInitials(assignee.users, '?')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getProfileDisplayName(assignee.users, 'Unknown User')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {assignee.users?.email || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No assignees yet.</p>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>Delete Goal</h3>
            <p className={styles.confirmModalText}>
              Are you sure you want to delete &quot;{goal.title}&quot;? This action cannot be undone.
            </p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
