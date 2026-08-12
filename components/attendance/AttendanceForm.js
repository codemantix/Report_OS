import { useEffect, useMemo, useState } from 'react';
import {
  ATTENDANCE_STATUS_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
} from '../../utils/attendanceConstants';
import {
  hasAttendanceErrors,
  validateAttendanceRecord,
} from '../../utils/attendanceValidation';
import styles from './Attendance.module.css';

function getInitialValues(record, profile) {
  return {
    attendance_date: record?.attendance_date || new Date().toISOString().slice(0, 10),
    meeting_session: record?.meeting_session || '',
    attendance_type: record?.attendance_type || 'meeting',
    employee_id: record?.employee_id || '',
    department_id: record?.department_id || (profile?.role === 'department_lead' ? profile.department_id : ''),
    attendance_status: record?.attendance_status || 'present',
    notes: record?.notes || '',
    evaluation_period_id: record?.evaluation_period_id || '',
  };
}

function employeeName(employee) {
  return employee.display_name || employee.full_name || employee.email;
}

export default function AttendanceForm({
  initialData,
  profile,
  departments,
  employees,
  evaluationPeriods,
  saving,
  onSubmit,
  onCancel,
}) {
  const [values, setValues] = useState(() => getInitialValues(initialData, profile));
  const [errors, setErrors] = useState({});
  const isEditing = Boolean(initialData?.id);
  const isDepartmentLocked = isEditing || profile?.role === 'department_lead';

  useEffect(() => {
    setValues(getInitialValues(initialData, profile));
    setErrors({});
  }, [initialData, profile]);

  const departmentEmployees = useMemo(() => (
    employees.filter((employee) => !values.department_id || employee.department_id === values.department_id)
  ), [employees, values.department_id]);

  const applicablePeriods = useMemo(() => (
    evaluationPeriods.filter((period) => (
      period.department_id === values.department_id
      && (!values.attendance_date
        || (values.attendance_date >= period.start_date && values.attendance_date <= period.end_date))
    ))
  ), [evaluationPeriods, values.attendance_date, values.department_id]);

  function updateValue(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === 'department_id') {
        next.employee_id = '';
        next.evaluation_period_id = '';
      }
      if (name === 'attendance_date') {
        const currentPeriod = evaluationPeriods.find((period) => period.id === current.evaluation_period_id);
        if (currentPeriod && (value < currentPeriod.start_date || value > currentPeriod.end_date)) {
          next.evaluation_period_id = '';
        }
      }
      return next;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateAttendanceRecord(values);
    setErrors(validationErrors);
    if (hasAttendanceErrors(validationErrors)) return;
    await onSubmit(values);
  }

  return (
    <section className={styles.formCard} aria-labelledby="attendance-form-title">
      <div className={styles.formHeader}>
        <div>
          <h2 id="attendance-form-title" className={styles.formTitle}>
            {isEditing ? 'Update Attendance' : 'Record Attendance'}
          </h2>
          <p className={styles.formDescription}>
            {isEditing
              ? 'Employee, department, date, recorder, and recorded time remain fixed for audit history.'
              : 'Create an official attendance record for a meeting or work session.'}
          </p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onCancel} aria-label="Close attendance form">
          ×
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="attendance-department">Department / Team</label>
            <select
              id="attendance-department"
              value={values.department_id}
              onChange={(event) => updateValue('department_id', event.target.value)}
              disabled={isDepartmentLocked || saving}
              aria-invalid={Boolean(errors.department_id)}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            {errors.department_id && <span className={styles.fieldError}>{errors.department_id}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="attendance-employee">Employee</label>
            <select
              id="attendance-employee"
              value={values.employee_id}
              onChange={(event) => updateValue('employee_id', event.target.value)}
              disabled={isEditing || saving || !values.department_id}
              aria-invalid={Boolean(errors.employee_id)}
            >
              <option value="">Select employee</option>
              {departmentEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
              ))}
            </select>
            {errors.employee_id && <span className={styles.fieldError}>{errors.employee_id}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="attendance-date">Attendance Date</label>
            <input
              id="attendance-date"
              type="date"
              value={values.attendance_date}
              onChange={(event) => updateValue('attendance_date', event.target.value)}
              disabled={isEditing || saving}
              aria-invalid={Boolean(errors.attendance_date)}
            />
            {errors.attendance_date && <span className={styles.fieldError}>{errors.attendance_date}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="attendance-type">Attendance Type</label>
            <select
              id="attendance-type"
              value={values.attendance_type}
              onChange={(event) => updateValue('attendance_type', event.target.value)}
              disabled={saving}
              aria-invalid={Boolean(errors.attendance_type)}
            >
              {ATTENDANCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.attendance_type && <span className={styles.fieldError}>{errors.attendance_type}</span>}
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label htmlFor="attendance-session">Meeting / Session</label>
            <input
              id="attendance-session"
              type="text"
              maxLength={150}
              value={values.meeting_session}
              onChange={(event) => updateValue('meeting_session', event.target.value)}
              placeholder="e.g. Monday Operations Stand-up"
              disabled={saving}
              aria-invalid={Boolean(errors.meeting_session)}
            />
            {errors.meeting_session && <span className={styles.fieldError}>{errors.meeting_session}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="attendance-status">Status</label>
            <select
              id="attendance-status"
              value={values.attendance_status}
              onChange={(event) => updateValue('attendance_status', event.target.value)}
              disabled={saving}
              aria-invalid={Boolean(errors.attendance_status)}
            >
              {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.attendance_status && <span className={styles.fieldError}>{errors.attendance_status}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="attendance-period">Evaluation Period <span className={styles.optional}>(optional)</span></label>
            <select
              id="attendance-period"
              value={values.evaluation_period_id}
              onChange={(event) => updateValue('evaluation_period_id', event.target.value)}
              disabled={saving || !values.department_id || !values.attendance_date}
            >
              <option value="">Not associated</option>
              {applicablePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} ({period.start_date} – {period.end_date})
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label htmlFor="attendance-notes">Notes <span className={styles.optional}>(optional)</span></label>
            <textarea
              id="attendance-notes"
              maxLength={2000}
              rows={3}
              value={values.notes}
              onChange={(event) => updateValue('notes', event.target.value)}
              placeholder="Add context about lateness, absence, or an excused attendance status."
              disabled={saving}
              aria-invalid={Boolean(errors.notes)}
            />
            <div className={styles.fieldMeta}>
              {errors.notes ? <span className={styles.fieldError}>{errors.notes}</span> : <span />}
              <span>{values.notes.length}/2000</span>
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? 'Saving attendance…' : isEditing ? 'Update Attendance' : 'Record Attendance'}
          </button>
        </div>
      </form>
    </section>
  );
}
