import { useState } from 'react';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import {
  COMPANY_GOAL_PRIORITY_OPTIONS,
  COMPANY_GOAL_STATUS_OPTIONS,
  MONTH_OPTIONS,
} from '../../utils/companyGoalConstants';
import ObjectivesListInput from './ObjectivesListInput';
import ExpectedOutcomesListInput from './ExpectedOutcomesListInput';
import styles from './Company.module.css';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear + i - 1);

export default function CompanyGoalForm({ initialData, users = [], onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    month: initialData?.month || new Date().getMonth() + 1,
    year: initialData?.year || currentYear,
    priority: initialData?.priority || 'high',
    status: initialData?.status || 'active',
    owner_id: initialData?.owner_id || '',
    success_metric: initialData?.success_metric || '',
    expected_summary: initialData?.expected_summary || '',
    objectives: initialData?.objectives || [],
    expected_outcomes: initialData?.expected_outcomes || [],
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleNumberChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.owner_id) payload.owner_id = null;
    onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* Title */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="cg-title">Goal Title</label>
        <input
          id="cg-title"
          name="title"
          type="text"
          className={styles.input}
          placeholder="e.g., Prepare Codemantix for August Bootcamp Launch"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      {/* Description */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="cg-description">Description</label>
        <textarea
          id="cg-description"
          name="description"
          className={styles.textarea}
          placeholder="Describe the company goal in detail..."
          value={formData.description}
          onChange={handleChange}
          required
        />
      </div>

      {/* Month / Year / Priority */}
      <div className={styles.rowThree}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cg-month">Month</label>
          <select
            id="cg-month"
            name="month"
            className={styles.select}
            value={formData.month}
            onChange={handleNumberChange}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cg-year">Year</label>
          <select
            id="cg-year"
            name="year"
            className={styles.select}
            value={formData.year}
            onChange={handleNumberChange}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cg-priority">Priority</label>
          <select
            id="cg-priority"
            name="priority"
            className={styles.select}
            value={formData.priority}
            onChange={handleChange}
          >
            {COMPANY_GOAL_PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status + Owner */}
      <div className={styles.row}>
        {initialData && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cg-status">Status</label>
            <select
              id="cg-status"
              name="status"
              className={styles.select}
              value={formData.status}
              onChange={handleChange}
            >
              {COMPANY_GOAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cg-owner">Owner</label>
          <select
            id="cg-owner"
            name="owner_id"
            className={styles.select}
            value={formData.owner_id}
            onChange={handleChange}
          >
            <option value="">Select owner</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {getProfileDisplayName(u, 'User')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Success Metric */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="cg-success-metric">Success Metric</label>
        <textarea
          id="cg-success-metric"
          name="success_metric"
          className={styles.textarea}
          placeholder="How will success be measured?"
          value={formData.success_metric}
          onChange={handleChange}
        />
      </div>

      {/* Expected Summary */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="cg-expected-summary">Expected Summary</label>
        <textarea
          id="cg-expected-summary"
          name="expected_summary"
          className={styles.textarea}
          placeholder="What should the state of the company look like by end of month?"
          value={formData.expected_summary}
          onChange={handleChange}
        />
      </div>

      {/* Objectives */}
      <ObjectivesListInput
        value={formData.objectives}
        onChange={(objectives) => setFormData((prev) => ({ ...prev, objectives }))}
      />

      {/* Expected Outcomes */}
      <ExpectedOutcomesListInput
        value={formData.expected_outcomes}
        onChange={(expected_outcomes) => setFormData((prev) => ({ ...prev, expected_outcomes }))}
      />

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Company Goal' : 'Create Company Goal'}
        </button>
      </div>
    </form>
  );
}
