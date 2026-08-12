import {
  EVALUATION_APPROVAL_STATUSES,
  EVALUATION_STATUS_LABELS,
} from '../../utils/evaluationDashboardConstants';
import styles from './Evaluations.module.css';

export default function EvaluationFilters({ filters, options, role, onChange, onClear }) {
  const employees = (options.employees || []).filter((employee) => (
    !filters.departmentId || employee.department_id === filters.departmentId
  ));
  const periods = (options.periods || []).filter((period) => (
    !filters.departmentId || period.department_id === filters.departmentId
  ));
  return (
    <section className={styles.filters} aria-label="Evaluation filters">
      <div className={styles.filterGrid}>
        <label><span>Evaluation period</span><select value={filters.periodId} onChange={(e) => onChange('periodId', e.target.value)}><option value="">All periods</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label>
        <label><span>Department</span><select value={filters.departmentId} disabled={role !== 'admin'} onChange={(e) => onChange('departmentId', e.target.value)}><option value="">All departments</option>{(options.departments || []).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
        <label><span>Employee</span><select value={filters.employeeId} disabled={role === 'team_member'} onChange={(e) => onChange('employeeId', e.target.value)}><option value="">All employees</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name || employee.display_name || employee.email}</option>)}</select></label>
        <label><span>Performance band</span><select value={filters.performanceBand} onChange={(e) => onChange('performanceBand', e.target.value)}><option value="">All bands</option>{(options.performanceBands || []).map((band) => <option value={band} key={band}>{band}</option>)}</select></label>
        <label><span>Approval status</span><select value={filters.approvalStatus} onChange={(e) => onChange('approvalStatus', e.target.value)}><option value="">All statuses</option>{EVALUATION_APPROVAL_STATUSES.map((status) => <option value={status} key={status}>{EVALUATION_STATUS_LABELS[status]}</option>)}</select></label>
      </div>
      <button type="button" className={styles.secondaryButton} onClick={onClear}>Clear filters</button>
    </section>
  );
}
