import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  addUtcDays,
  hasEvaluationPeriodErrors,
  validateEvaluationPeriod,
} from '../../utils/evaluationPeriodValidation';
import styles from './EvaluationPeriods.module.css';

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialValues(period, profile) {
  if (period) {
    return {
      title: period.name,
      department_id: period.department_id,
      start_date: period.start_date,
      end_date: period.end_date,
      evaluation_deadline: localDateTime(period.evaluation_deadline),
      employee_ids: (period.evaluations || []).map((evaluation) => evaluation.employee_id),
    };
  }
  return {
    title: '',
    department_id: profile.role === 'department_lead' ? profile.department_id || '' : '',
    start_date: '',
    end_date: '',
    evaluation_deadline: '',
    employee_ids: [],
  };
}

function employeeName(employee) {
  return employee.full_name || employee.display_name || employee.email;
}

export default function EvaluationPeriodForm({
  period,
  profile,
  departments,
  employees,
  saving,
  onSubmit,
  onCancel,
}) {
  const [values, setValues] = useState(() => initialValues(period, profile));
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    setValues(initialValues(period, profile));
    setErrors({});
    setSearch('');
  }, [period, profile]);

  const availableEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => (
      employee.department_id === values.department_id
      && (!term || `${employeeName(employee)} ${employee.email || ''}`.toLowerCase().includes(term))
    ));
  }, [employees, search, values.department_id]);

  function update(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === 'department_id') next.employee_ids = [];
      if (name === 'start_date') {
        next.end_date = value ? addUtcDays(value, 13) : '';
        if (value) {
          const deadlineDate = new Date(`${addUtcDays(value, 16)}T17:00:00`);
          next.evaluation_deadline = localDateTime(deadlineDate);
        }
      }
      return next;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function toggleEmployee(employeeId) {
    const selected = values.employee_ids.includes(employeeId);
    update('employee_ids', selected
      ? values.employee_ids.filter((id) => id !== employeeId)
      : [...values.employee_ids, employeeId]);
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateEvaluationPeriod(values);
    setErrors(nextErrors);
    if (hasEvaluationPeriodErrors(nextErrors)) return;
    onSubmit(values);
  }

  return (
    <section className={styles.formCard} aria-labelledby="period-form-title">
      <div className={styles.formHeader}>
        <div>
          <h2 id="period-form-title">{period ? 'Edit Draft Period' : 'Create Evaluation Period'}</h2>
          <p>Set one unambiguous 14-day window and choose the employees evaluated within it.</p>
        </div>
        <button type="button" className={styles.iconButton} onClick={onCancel} disabled={saving} aria-label="Close form">
          <X aria-hidden="true" />
        </button>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Title</span>
            <input
              value={values.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="e.g. August Cycle 1"
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <small className={styles.fieldError}>{errors.title}</small>}
          </label>
          <label className={styles.field}>
            <span>Department</span>
            <select
              value={values.department_id}
              onChange={(event) => update('department_id', event.target.value)}
              disabled={Boolean(period) || profile.role === 'department_lead'}
              aria-invalid={Boolean(errors.department_id)}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            {errors.department_id && <small className={styles.fieldError}>{errors.department_id}</small>}
          </label>
          <label className={styles.field}>
            <span>Evaluation deadline</span>
            <input
              type="datetime-local"
              value={values.evaluation_deadline}
              onChange={(event) => update('evaluation_deadline', event.target.value)}
              aria-invalid={Boolean(errors.evaluation_deadline)}
            />
            {errors.evaluation_deadline && <small className={styles.fieldError}>{errors.evaluation_deadline}</small>}
          </label>
          <label className={styles.field}>
            <span>Start date</span>
            <input
              type="date"
              value={values.start_date}
              onChange={(event) => update('start_date', event.target.value)}
              aria-invalid={Boolean(errors.start_date)}
            />
            {errors.start_date && <small className={styles.fieldError}>{errors.start_date}</small>}
          </label>
          <label className={styles.field}>
            <span>End date</span>
            <input
              type="date"
              value={values.end_date}
              onChange={(event) => update('end_date', event.target.value)}
              aria-invalid={Boolean(errors.end_date)}
            />
            <small className={styles.helpText}>Inclusive end date; the window must be exactly 14 days.</small>
            {errors.end_date && <small className={styles.fieldError}>{errors.end_date}</small>}
          </label>
        </div>

        <fieldset className={styles.employeeFieldset}>
          <legend>Applicable employees <span>{values.employee_ids.length} selected</span></legend>
          <div className={styles.employeeToolbar}>
            <div className={styles.searchBox}>
              <Search aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" />
            </div>
            {availableEmployees.length > 0 && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => update('employee_ids', availableEmployees.map((employee) => employee.id))}
              >
                Select visible
              </button>
            )}
          </div>
          {!values.department_id ? (
            <p className={styles.employeeEmpty}>Select a department to choose employees.</p>
          ) : availableEmployees.length === 0 ? (
            <p className={styles.employeeEmpty}>No active employees match this department and search.</p>
          ) : (
            <div className={styles.employeeGrid}>
              {availableEmployees.map((employee) => (
                <label key={employee.id} className={styles.employeeOption}>
                  <input
                    type="checkbox"
                    checked={values.employee_ids.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                  />
                  <span>
                    <strong>{employeeName(employee)}</strong>
                    <small>{employee.job_title || employee.email}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.employee_ids && <small className={styles.fieldError}>{errors.employee_ids}</small>}
        </fieldset>

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? 'Saving…' : period ? 'Save Changes' : 'Create Draft Period'}
          </button>
        </div>
      </form>
    </section>
  );
}
