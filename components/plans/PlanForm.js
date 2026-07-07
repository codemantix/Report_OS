import { useState } from 'react';
import styles from './Plans.module.css';

const PLAN_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'project', label: 'Project' },
];

export default function PlanForm({ initialData, departments, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    department_id: initialData?.department_id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    plan_type: initialData?.plan_type || 'monthly',
    start_date: initialData?.start_date ? initialData.start_date.slice(0, 10) : '',
    end_date: initialData?.end_date ? initialData.end_date.slice(0, 10) : '',
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.department_id) payload.department_id = null;
    if (!payload.start_date) payload.start_date = null;
    if (!payload.end_date) payload.end_date = null;
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
          <label className={styles.label} htmlFor="plan_type">
            Plan Type
          </label>
          <select
            id="plan_type"
            name="plan_type"
            className={styles.select}
            value={formData.plan_type}
            onChange={handleChange}
          >
            {PLAN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className={styles.input}
          placeholder="Enter plan title"
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
          placeholder="Describe the plan in detail"
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
          <label className={styles.label} htmlFor="end_date">
            End Date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            className={styles.input}
            value={formData.end_date}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Plan' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
}
