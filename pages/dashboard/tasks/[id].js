import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TaskForm from '../../../components/tasks/TaskForm';
import TaskComments from '../../../components/tasks/TaskComments';
import { fetchTaskById, updateTask, updateTaskStatus, archiveTask, deleteTask } from '../../../services/taskService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchGoals } from '../../../services/goalService';
import { fetchPlans } from '../../../services/planService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { formatDate, formatDateTime } from '../../../utils/dateHelpers';
import { getProfileDisplayName } from '../../../utils/profileHelpers';
import styles from '../../../components/tasks/Tasks.module.css';
import { supabase } from '../../../lib/supabaseClient';

const STATUS_STYLES = {
  todo: styles.statusTodo, in_progress: styles.statusInProgress, in_review: styles.statusInReview,
  completed: styles.statusCompleted, blocked: styles.statusBlocked, delayed: styles.statusDelayed, cancelled: styles.statusCancelled,
};

const PRIORITY_STYLES = {
  urgent: styles.priorityUrgent, high: styles.priorityHigh, medium: styles.priorityMedium, low: styles.priorityLow,
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'completed', 'blocked', 'delayed', 'cancelled'];

function ArchiveConfirmModal({ onConfirm, onCancel, archiving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-gray-800">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">📦</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Archive Task</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Are you sure you want to archive this task? You can access it later in the archived tasks section.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            onClick={onCancel}
            disabled={archiving}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={archiving}
          >
            {archiving ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTaskConfirmModal({ onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-gray-800">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Delete Task</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Are you sure you want to delete this task permanently? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [task, setTask] = useState(null);
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    const profile = await getCurrentUserProfile();
    setUser(profile);

    try {
      const [taskRes, deptRes, goalRes, planRes, userRes] = await Promise.all([
        fetchTaskById(id),
        fetchDepartments(),
        fetchGoals(),
        fetchPlans(),
        fetchUsers({ status: 'active' }),
      ]);

      if (taskRes.error) throw taskRes.error;
      if (!taskRes.data) { setError('Task not found'); setLoading(false); return; }

      setTask(taskRes.data);
      setDepartments(deptRes.data || []);
      setGoals(goalRes.data || []);
      setPlans(planRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }

  const canManage = user && (user.role === 'admin' || user.role === 'department_lead');
  const isAssignee = user && (task?.task_assignees || []).some((a) => a.users?.id === user.id || a.user_id === user.id);

  const visibleStatuses = STATUS_OPTIONS.filter((s) => {
    if (s === 'completed') {
      return canManage;
    }
    return true;
  });

  async function handleUpdate(formData) {
    setSaving(true);
    const { error: updateError } = await updateTask(id, formData);
    if (updateError) {
      toast.error(updateError.message || 'Failed to update task');
      setSaving(false);
      return;
    }
    toast.success('Task updated');
    setEditing(false);
    loadData();
  }

  async function handleStatusChange(newStatus) {
    if (!canManage && !isAssignee) {
      toast.error('You do not have permission to update the status of this task');
      return;
    }
    if (newStatus === 'completed' && !canManage) {
      toast.error('Only department leads and admins can mark tasks as completed');
      return;
    }

    setUpdatingStatus(newStatus);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('Authentication session not found. Please log in again.');
        setUpdatingStatus(null);
        return;
      }

      const response = await fetch('/api/tasks/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: id,
          status: newStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update task status');
      }

      toast.success(`Task status updated to ${newStatus.replace(/_/g, ' ')}`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update task status');
    } finally {
      setUpdatingStatus(null);
    }
  }

  function handleArchive() {
    setShowArchiveModal(true);
  }

  async function handleConfirmArchive() {
    setArchiving(true);
    try {
      const { error } = await archiveTask(id, user?.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Task archived');
      router.push('/dashboard/tasks');
    } catch (err) {
      toast.error('Failed to archive task');
    } finally {
      setArchiving(false);
      setShowArchiveModal(false);
    }
  }

  function handleDelete() {
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const { error } = await deleteTask(id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Task deleted');
      router.push('/dashboard/tasks');
    } catch (err) {
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}><div className={styles.spinner} /></div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard/tasks')}>← Back to Tasks</button>
          <div className={styles.section}>
            <div className={styles.errorState}>
              <p className={styles.errorMessage}>{error}</p>
              <button className={styles.retryBtn} onClick={loadData}>Try Again</button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) return null;

  if (editing) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button className={styles.backBtn} onClick={() => setEditing(false)}>← Cancel Editing</button>
          <div className={styles.header}><h1 className={styles.title}>Edit Task</h1></div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Task Details</h2>
            <TaskForm initialData={task} departments={departments} goals={goals} plans={plans} users={users}
              onSubmit={handleUpdate} onCancel={() => setEditing(false)} loading={saving} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {showArchiveModal && (
          <ArchiveConfirmModal
            onConfirm={handleConfirmArchive}
            onCancel={() => setShowArchiveModal(false)}
            archiving={archiving}
          />
        )}
        {showDeleteModal && (
          <DeleteTaskConfirmModal
            onConfirm={handleConfirmDelete}
            onCancel={() => setShowDeleteModal(false)}
            deleting={deleting}
          />
        )}
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/tasks')}>← Back to Tasks</button>

        <div className={styles.section}>
            <div>
              <h1 className={styles.title}>{task.title}</h1>
              <p className={styles.subtitle}>Created {formatDateTime(task.created_at)}</p>
            </div>
          <div className="flex items-start justify-between max-sm:justify-end">
            {canManage && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => setEditing(true)} className={styles.submitBtn}>Edit</button>
                <button onClick={handleArchive} className={styles.cancelBtn}>Archive</button>
                {user?.role === 'admin' && <button onClick={handleDelete} className={styles.cancelBtn} style={{ color: '#DC2626' }}>Delete</button>}
              </div>
            )}
          </div>
        </div>

        {/* Status quick change */}
        {(canManage || isAssignee) && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Status</h2>
            <div className="flex flex-wrap gap-2">
              {visibleStatuses.map((s) => {
                const isCurrentUpdating = updatingStatus === s;
                const isDisabled = updatingStatus !== null;
                const isActive = task.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={isDisabled}
                    className={`${styles.badge} ${STATUS_STYLES[s]} flex items-center gap-1.5`}
                    style={{
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      padding: '6px 14px',
                      fontSize: '13px',
                      opacity: isDisabled && !isCurrentUpdating ? 0.5 : 1,
                      border: isActive ? '1px solid currentColor' : '1px solid transparent',
                    }}
                  >
                    {isCurrentUpdating && (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    {s.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Info */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Task Information</h2>
          <div className={styles.metaGrid}>
            <div><p className={styles.detailLabel}>Department</p><p className={styles.detailValue}>{task.departments?.name || 'N/A'}</p></div>
            <div><p className={styles.detailLabel}>Priority</p><span className={`${styles.badge} ${PRIORITY_STYLES[task.priority] || styles.priorityLow}`}>{task.priority}</span></div>
            <div><p className={styles.detailLabel}>Status</p><span className={`${styles.badge} ${STATUS_STYLES[task.status] || styles.statusTodo}`}>{task.status?.replace(/_/g, ' ')}</span></div>
            <div><p className={styles.detailLabel}>Due Date</p><p className={styles.detailValue}>{task.due_date ? formatDate(task.due_date) : 'No due date'}</p></div>
            <div><p className={styles.detailLabel}>Start Date</p><p className={styles.detailValue}>{task.start_date ? formatDate(task.start_date) : 'Not set'}</p></div>
            <div><p className={styles.detailLabel}>Created By</p><p className={styles.detailValue}>{getProfileDisplayName(task.created_by_user, 'Unknown')}</p></div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{task.description}</p>
          </div>
        )}

        {/* Expected Output */}
        {task.expected_output && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Expected Output</h2>
            <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{task.expected_output}</p>
          </div>
        )}

        {/* Goal & Plan */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Related Items</h2>
          <div className={styles.detailGrid}>
            <div><p className={styles.detailLabel}>Related Goal</p><p className={styles.detailValue}>{task.goals?.title || 'None'}</p></div>
            <div><p className={styles.detailLabel}>Related Plan</p><p className={styles.detailValue}>{task.plans?.title || 'None'}</p></div>
          </div>
        </div>

        {/* Assignees */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Assignees ({task.task_assignees?.length || 0})</h2>
          {(!task.task_assignees || task.task_assignees.length === 0) ? (
            <p style={{ color: 'var(--color-muted)' }}>No assignees.</p>
          ) : (
            <div className="space-y-2">
              {task.task_assignees.map((a) => (
                <div key={a.users?.id || Math.random()} className={styles.assigneeItem}>
                  <span className={styles.userAvatar}>{getProfileDisplayName(a.users, 'U').charAt(0)}</span>
                  <p className={styles.userName}>{getProfileDisplayName(a.users, 'User')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Comments ({task.task_comments?.length || 0})</h2>
          <TaskComments
            taskId={task.id}
            comments={task.task_comments}
            currentUserId={user?.id}
            onCommentAdded={loadData}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
