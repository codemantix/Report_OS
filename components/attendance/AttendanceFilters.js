import {
  ATTENDANCE_STATUS_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
} from '../../utils/attendanceConstants';
import styles from './Attendance.module.css';

function employeeName(employee) {
  return employee.display_name || employee.full_name || employee.email;
}

export default function AttendanceFilters({
  filters,
  departments,
  employees,
  evaluationPeriods,
  role,
  onChange,
  onClear,
}) {
  const canManage = role === 'admin' || role === 'department_lead';
  const visibleEmployees = employees.filter((employee) => (
    !filters.department_id || employee.department_id === filters.department_id
  ));
  const visiblePeriods = evaluationPeriods.filter((period) => (
    !filters.department_id || period.department_id === filters.department_id
  ));

  return (
    <section className={styles.filters} aria-label="Attendance filters">
      <div className={styles.filterGrid}>
        {role === 'admin' && (
          <div className={styles.filterField}>
            <label htmlFor="attendance-filter-department">Department</label>
            <select
              id="attendance-filter-department"
              value={filters.department_id}
              onChange={(event) => onChange('department_id', event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
        )}

        {canManage && (
          <div className={styles.filterField}>
            <label htmlFor="attendance-filter-employee">Employee</label>
            <select
              id="attendance-filter-employee"
              value={filters.employee_id}
              onChange={(event) => onChange('employee_id', event.target.value)}
            >
              <option value="">All employees</option>
              {visibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.filterField}>
          <label htmlFor="attendance-filter-status">Status</label>
          <select
            id="attendance-filter-status"
            value={filters.attendance_status}
            onChange={(event) => onChange('attendance_status', event.target.value)}
          >
            <option value="">All statuses</option>
            {ATTENDANCE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="attendance-filter-type">Type</label>
          <select
            id="attendance-filter-type"
            value={filters.attendance_type}
            onChange={(event) => onChange('attendance_type', event.target.value)}
          >
            <option value="">All types</option>
            {ATTENDANCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="attendance-filter-from">From</label>
          <input
            id="attendance-filter-from"
            type="date"
            value={filters.date_from}
            onChange={(event) => onChange('date_from', event.target.value)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="attendance-filter-to">To</label>
          <input
            id="attendance-filter-to"
            type="date"
            value={filters.date_to}
            onChange={(event) => onChange('date_to', event.target.value)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="attendance-filter-period">Evaluation Period</label>
          <select
            id="attendance-filter-period"
            value={filters.evaluation_period_id}
            onChange={(event) => onChange('evaluation_period_id', event.target.value)}
          >
            <option value="">All periods</option>
            {visiblePeriods.map((period) => (
              <option key={period.id} value={period.id}>{period.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" className={styles.clearButton} onClick={onClear}>
        Clear filters
      </button>
    </section>
  );
}
