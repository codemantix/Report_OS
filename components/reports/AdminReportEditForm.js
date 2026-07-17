import { useEffect, useState } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import { hasReportValidationErrors, validateEditableReportFields } from '../../utils/reportValidation';
import styles from './ReportDetails.module.css';

const REPORT_TYPES = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'project', label: 'Project Report' },
  { value: 'task_completion', label: 'Task Completion' },
  { value: 'blocker', label: 'Blocker Report' },
];

function normalizeReport(report = {}) {
  return {
    report_type: report.report_type || '',
    project_name: report.project_name || '',
    task_id: report.task_id || report.tasks?.id || '',
    worked_on: report.worked_on || '',
    completed_tasks: report.completed_tasks || '',
    pending_tasks: report.pending_tasks || '',
    blockers: report.blockers || '',
    support_needed: report.support_needed || '',
    hours_worked: report.hours_worked ?? '',
    completion_percentage: report.completion_percentage ?? '',
    additional_notes: report.additional_notes || '',
  };
}

export default function AdminReportEditForm({ report, tasks = [], saving, onSave, onCancel }) {
  const [values, setValues] = useState(() => normalizeReport(report));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues(normalizeReport(report));
    setErrors({});
  }, [report]);

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateEditableReportFields(values);
    setErrors(validationErrors);

    if (hasReportValidationErrors(validationErrors)) return;

    const result = await onSave(values);
    if (result?.error?.fields) {
      setErrors(result.error.fields);
    }
  }

  function fieldClass(field, baseClass) {
    return `${baseClass} ${errors[field] ? styles.editInputError : ''}`;
  }

  const availableTasks = report.tasks && !tasks.some((task) => task.id === report.tasks.id)
    ? [report.tasks, ...tasks]
    : tasks;

  return (
    <form className={styles.editForm} onSubmit={handleSubmit}>
      <div className={styles.editFormHeader}>
        <div>
          <h1 className={styles.editFormTitle}>Edit submitted report</h1>
          <p className={styles.editFormDescription}>Update the submitted content, related task, and metrics. Ownership, other relationships, and attachments remain unchanged.</p>
        </div>
        <span className={styles.editAdminBadge}>Admin only</span>
      </div>

      <div className={styles.editNotice}>
        <RefreshCw size={17} aria-hidden="true" />
        Saving changes invalidates the current AI analysis and automatically generates a fresh analysis.
      </div>

      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label htmlFor="edit-report-type" className={styles.editLabel}>Report type *</label>
          <select
            id="edit-report-type"
            value={values.report_type}
            onChange={(event) => updateField('report_type', event.target.value)}
            className={fieldClass('report_type', styles.editInput)}
            required
          >
            <option value="">Select report type</option>
            {REPORT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          {errors.report_type && <p className={styles.editError}>{errors.report_type}</p>}
        </div>

        <div className={styles.editField}>
          <label htmlFor="edit-project-name" className={styles.editLabel}>Report title *</label>
          <input
            id="edit-project-name"
            value={values.project_name}
            onChange={(event) => updateField('project_name', event.target.value)}
            className={fieldClass('project_name', styles.editInput)}
            required
          />
          {errors.project_name && <p className={styles.editError}>{errors.project_name}</p>}
        </div>
      </div>

      <div className={styles.editField}>
        <label htmlFor="edit-related-task" className={styles.editLabel}>Related task (optional)</label>
        <select
          id="edit-related-task"
          value={values.task_id}
          onChange={(event) => updateField('task_id', event.target.value)}
          className={fieldClass('task_id', styles.editInput)}
        >
          <option value="">Select related task</option>
          {availableTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} · {task.departments?.name || 'No department'}{task.archived ? ' · Archived' : ''}
            </option>
          ))}
        </select>

      </div>

      <div className={styles.editField}>
        <label htmlFor="edit-worked-on" className={styles.editLabel}>What was worked on? *</label>
        <textarea
          id="edit-worked-on"
          value={values.worked_on}
          onChange={(event) => updateField('worked_on', event.target.value)}
          className={fieldClass('worked_on', styles.editTextarea)}
          required
        />
        {errors.worked_on && <p className={styles.editError}>{errors.worked_on}</p>}
      </div>

      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label htmlFor="edit-completed" className={styles.editLabel}>Completed tasks *</label>
          <textarea id="edit-completed" value={values.completed_tasks} onChange={(event) => updateField('completed_tasks', event.target.value)} className={fieldClass('completed_tasks', styles.editTextarea)} required />
          {errors.completed_tasks && <p className={styles.editError}>{errors.completed_tasks}</p>}
        </div>
        <div className={styles.editField}>
          <label htmlFor="edit-pending" className={styles.editLabel}>Pending tasks *</label>
          <textarea id="edit-pending" value={values.pending_tasks} onChange={(event) => updateField('pending_tasks', event.target.value)} className={fieldClass('pending_tasks', styles.editTextarea)} required />
          {errors.pending_tasks && <p className={styles.editError}>{errors.pending_tasks}</p>}
        </div>
      </div>

      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label htmlFor="edit-blockers" className={styles.editLabel}>Blockers or challenges *</label>
          <textarea id="edit-blockers" value={values.blockers} onChange={(event) => updateField('blockers', event.target.value)} className={fieldClass('blockers', styles.editTextarea)} required />
          {errors.blockers && <p className={styles.editError}>{errors.blockers}</p>}
        </div>
        <div className={styles.editField}>
          <label htmlFor="edit-support" className={styles.editLabel}>Support needed *</label>
          <textarea id="edit-support" value={values.support_needed} onChange={(event) => updateField('support_needed', event.target.value)} className={fieldClass('support_needed', styles.editTextarea)} required />
          {errors.support_needed && <p className={styles.editError}>{errors.support_needed}</p>}
        </div>
      </div>

      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label htmlFor="edit-hours" className={styles.editLabel}>Hours worked *</label>
          <input id="edit-hours" type="number" min="0" step="0.5" value={values.hours_worked} onChange={(event) => updateField('hours_worked', event.target.value)} className={fieldClass('hours_worked', styles.editInput)} required />
          {errors.hours_worked && <p className={styles.editError}>{errors.hours_worked}</p>}
        </div>
        <div className={styles.editField}>
          <label htmlFor="edit-completion" className={styles.editLabel}>Completion percentage *</label>
          <input id="edit-completion" type="number" min="0" max="100" value={values.completion_percentage} onChange={(event) => updateField('completion_percentage', event.target.value)} className={fieldClass('completion_percentage', styles.editInput)} required />
          {errors.completion_percentage && <p className={styles.editError}>{errors.completion_percentage}</p>}
        </div>
      </div>

      <div className={styles.editField}>
        <label htmlFor="edit-notes" className={styles.editLabel}>Additional notes *</label>
        <textarea id="edit-notes" value={values.additional_notes} onChange={(event) => updateField('additional_notes', event.target.value)} className={fieldClass('additional_notes', styles.editTextarea)} required />
        {errors.additional_notes && <p className={styles.editError}>{errors.additional_notes}</p>}
      </div>

      <div className={styles.editActions}>
        <button type="button" className={styles.editCancelButton} onClick={onCancel} disabled={saving}>
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" className={styles.editSaveButton} disabled={saving}>
          <Save size={16} aria-hidden="true" />
          {saving ? 'Saving changes...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
