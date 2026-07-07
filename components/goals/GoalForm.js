import { useMemo, useState } from 'react';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Goals.module.css';
import Image from 'next/image';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function GoalForm({ initialData, departments, users = [], onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    department_id: initialData?.department_id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'medium',
    start_date: initialData?.start_date ? initialData.start_date.slice(0, 10) : '',
    due_date: initialData?.due_date ? initialData.due_date.slice(0, 10) : '',
    success_metric: initialData?.success_metric || '',
    expected_deliverables: initialData?.expected_deliverables || '',
    status: initialData?.status || 'not_started',
    assignee_ids: initialData?.goal_assignees?.map((item) => item.users?.id || item.user_id).filter(Boolean) || [],
  });

  const availableAssignees = useMemo(() => {
    if (!formData.department_id) return users;
    return users.filter((user) => user.department_id === formData.department_id);
  }, [users, formData.department_id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'department_id') {
        const validUserIds = users
          .filter((user) => !value || user.department_id === value)
          .map((user) => user.id);

        return {
          ...prev,
          [name]: value,
          assignee_ids: prev.assignee_ids.filter((id) => validUserIds.includes(id)),
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
    if (!payload.department_id) payload.department_id = null;
    if (!payload.start_date) payload.start_date = null;
    if (!payload.due_date) payload.due_date = null;
    onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="department_id">
            Department
          </label>
          <select
            id="department_id"
            name="department_id"
            className={styles.select}
            value={formData.department_id}
            onChange={handleChange}
          >
            <option value="">Select a department</option>
            {(departments || []).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            className={styles.select}
            value={formData.priority}
            onChange={handleChange}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className={styles.input}
          placeholder="Enter goal title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          className={styles.textarea}
          placeholder="Describe the goal in detail"
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="start_date">
            Start Date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            className={styles.input}
            value={formData.start_date}
            onChange={handleChange}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="due_date">
            Due Date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            className={styles.input}
            value={formData.due_date}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.assigneeHeader}>
          <label className={styles.label}>Assignees</label>
          <span className={styles.assigneeCount}>{formData.assignee_ids.length} selected</span>
        </div>
        <div className={styles.assigneePicker}>
          {availableAssignees.length === 0 ? (
            <p className={styles.emptyText}>
              {formData.department_id
                ? 'No active team members are assigned to this department yet.'
                : 'Select a department or add team members to assign this goal.'}
            </p>
          ) : (
            availableAssignees.map((user) => {
              const displayName = getProfileDisplayName(user, 'User');
              const selected = formData.assignee_ids.includes(user.id);

              return (
                <label key={user.id} className={selected ? styles.assigneeOptionSelected : styles.assigneeOption}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => handleAssigneeToggle(user.id)}
                    className={styles.assigneeCheckbox}
                  />
                  <span className={styles.assigneeAvatar}>
                    {user.avatar_url ? (
                      <Image src={user.avatar_url} alt={displayName} className={styles.assigneeAvatarImage} width={36} height={36} />
                    ) : (
                      getProfileInitials(user, 'U')
                    )}
                  </span>
                  <span className={styles.assigneeTextWrap}>
                    <span className={styles.assigneeName}>{displayName}</span>
                    <span className={styles.assigneeMeta}>{user.job_title || user.email}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="success_metric">
          Success Metric
        </label>
        <textarea
          id="success_metric"
          name="success_metric"
          className={styles.textarea}
          placeholder="How will success be measured?"
          value={formData.success_metric}
          onChange={handleChange}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="expected_deliverables">
          Expected Deliverables
        </label>
        <textarea
          id="expected_deliverables"
          name="expected_deliverables"
          className={styles.textarea}
          placeholder="What deliverables are expected?"
          value={formData.expected_deliverables}
          onChange={handleChange}
        />
      </div>

      {initialData && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            className={styles.select}
            value={formData.status}
            onChange={handleChange}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Goal' : 'Create Goal'}
        </button>
      </div>
    </form>
  );
}
