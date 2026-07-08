import { useMemo, useState } from 'react';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Tasks.module.css';
import Image from 'next/image';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TaskForm({ initialData, departments, goals, plans, users, companyGoals = [], onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    company_goal_id: initialData?.company_goal_id || '',
    department_id: initialData?.department_id || '',
    goal_id: initialData?.goal_id || '',
    plan_id: initialData?.plan_id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    expected_output: initialData?.expected_output || '',
    priority: initialData?.priority || 'medium',
    status: initialData?.status || 'todo',
    start_date: initialData?.start_date ? initialData.start_date.slice(0, 10) : '',
    due_date: initialData?.due_date ? initialData.due_date.slice(0, 10) : '',
    assignee_ids: initialData?.task_assignees?.map((item) => item.users?.id || item.user_id).filter(Boolean) || [],
  });

  const availableAssignees = useMemo(() => {
    if (!formData.department_id) return users || [];
    return (users || []).filter((user) => user.department_id === formData.department_id);
  }, [users, formData.department_id]);

  const filteredGoals = useMemo(() => {
    if (!formData.department_id) return goals || [];
    return (goals || []).filter((g) => g.department_id === formData.department_id);
  }, [goals, formData.department_id]);

  const filteredPlans = useMemo(() => {
    if (!formData.department_id) return plans || [];
    return (plans || []).filter((p) => p.department_id === formData.department_id);
  }, [plans, formData.department_id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'department_id') {
        const validIds = (users || [])
          .filter((u) => u.department_id === value)
          .map((u) => u.id);
        return {
          ...prev,
          [name]: value,
          goal_id: '',
          plan_id: '',
          assignee_ids: prev.assignee_ids.filter((id) => validIds.includes(id)),
        };
      }
      return { ...prev, [name]: value };
    });
  }

  function handleAssigneeToggle(userId) {
    setFormData((prev) => {
      const isSelected = prev.assignee_ids.includes(userId);
      return {
        ...prev,
        assignee_ids: isSelected
          ? prev.assignee_ids.filter((id) => id !== userId)
          : [...prev.assignee_ids, userId],
      };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.company_goal_id) payload.company_goal_id = null;
    if (!payload.department_id) payload.department_id = null;
    if (!payload.goal_id) payload.goal_id = null;
    if (!payload.plan_id) payload.plan_id = null;
    if (!payload.start_date) payload.start_date = null;
    if (!payload.due_date) payload.due_date = null;
    onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {companyGoals.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company_goal_id">Related Company Goal</label>
          <select id="company_goal_id" name="company_goal_id" className={styles.select} value={formData.company_goal_id} onChange={handleChange}>
            <option value="">None</option>
            {companyGoals.map((cg) => (
              <option key={cg.id} value={cg.id}>{cg.title} ({cg.month}/{cg.year})</option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="department_id">Department</label>
          <select id="department_id" name="department_id" className={styles.select} value={formData.department_id} onChange={handleChange}>
            <option value="">Select department</option>
            {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className={styles.select} value={formData.priority} onChange={handleChange}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">Task Title</label>
        <input id="title" name="title" type="text" className={styles.input} placeholder="Enter task title" value={formData.title} onChange={handleChange} required />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">Description</label>
        <textarea id="description" name="description" className={styles.textarea} placeholder="Describe the task" value={formData.description} onChange={handleChange} rows={3} />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="goal_id">Related Goal</label>
          <select id="goal_id" name="goal_id" className={styles.select} value={formData.goal_id} onChange={handleChange}>
            <option value="">No goal</option>
            {filteredGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="plan_id">Related Plan</label>
          <select id="plan_id" name="plan_id" className={styles.select} value={formData.plan_id} onChange={handleChange}>
            <option value="">No plan</option>
            {filteredPlans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="expected_output">Expected Output</label>
        <textarea id="expected_output" name="expected_output" className={styles.textarea} placeholder="What should be delivered?" value={formData.expected_output} onChange={handleChange} rows={2} />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="start_date">Start Date</label>
          <input id="start_date" name="start_date" type="date" className={styles.input} value={formData.start_date} onChange={handleChange} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="due_date">Due Date</label>
          <input id="due_date" name="due_date" type="date" className={styles.input} value={formData.due_date} onChange={handleChange} />
        </div>
      </div>

      {initialData && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="status">Status</label>
          <select id="status" name="status" className={styles.select} value={formData.status} onChange={handleChange}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      <div className={styles.field}>
        <div className={styles.assigneeHeader}>
          <label className={styles.label}>Assignees</label>
          <span className={styles.assigneeCount}>{formData.assignee_ids.length} selected</span>
        </div>
        <div className={styles.assigneePicker}>
          {availableAssignees.length === 0 ? (
            <p className={styles.emptyText}>
              {formData.department_id
                ? 'No active team members in this department.'
                : 'Select a department to see available assignees.'}
            </p>
          ) : (
            availableAssignees.map((user) => {
              const selected = formData.assignee_ids.includes(user.id);
              return (
                <label key={user.id} className={selected ? styles.assigneeOptionSelected : styles.assigneeOption}>
                  <input type="checkbox" checked={selected} onChange={() => handleAssigneeToggle(user.id)} className={styles.assigneeCheckbox} />
                  <span className={styles.userAvatar}>
                    {user.avatar_url ? <Image src={user.avatar_url} alt="" className={styles.userAvatarImage} width={32} height={32} /> : getProfileInitials(user, 'U')}
                  </span>
                  <span className={styles.userName}>{getProfileDisplayName(user, 'User')}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {onCancel && <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
