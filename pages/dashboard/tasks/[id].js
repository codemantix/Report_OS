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

const STATUS_STYLES = {
  todo: styles.statusTodo, in_progress: styles.statusInProgress, in_review: styles.statusInReview,
  completed: styles.statusCompleted, blocked: styles.statusBlocked, delayed: styles.statusDelayed, cancelled: styles.statusCancelled,
};

const PRIORITY_STYLES = {
  urgent: styles.priorityUrgent, high: styles.priorityHigh, medium: styles.priorityMedium, low: styles.priorityLow,
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'completed', 'blocked', 'delayed', 'cancelled'];

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
    if (!canManage) return;
    const { error } = await updateTaskStatus(id, newStatus, user?.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Task status updated to ${newStatus.replace(/_/g, ' ')}`);
    loadData();
  }

  async function handleArchive() {
    if (!confirm('Archive this task?')) return;
    const { error } = await archiveTask(id, user?.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Task archived');
    router.push('/dashboard/tasks');
  }

  async function handleDelete() {
    if (!confirm('Delete this task permanently? This cannot be undone.')) return;
    const { error } = await deleteTask(id);
    if (error) { toast.error(error.message); return; }
    toast.success('Task deleted');
    router.push('/dashboard/tasks');
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
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/tasks')}>← Back to Tasks</button>

        <div className={styles.section}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className={styles.title}>{task.title}</h1>
              <p className={styles.subtitle}>Created {formatDateTime(task.created_at)}</p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className={styles.submitBtn}>Edit</button>
                <button onClick={handleArchive} className={styles.cancelBtn}>Archive</button>
                {user?.role === 'admin' && <button onClick={handleDelete} className={styles.cancelBtn} style={{ color: '#DC2626' }}>Delete</button>}
              </div>
            )}
          </div>
        </div>

        {/* Status quick change */}
        {canManage && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`${styles.badge} ${STATUS_STYLES[s]}`}
                  style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '13px' }}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
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
