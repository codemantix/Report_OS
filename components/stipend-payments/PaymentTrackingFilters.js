import { RotateCcw } from 'lucide-react';
import styles from './StipendPayments.module.css';

export default function PaymentTrackingFilters({ filters, options, onChange, onReset }) {
  const employees = filters.departmentId
    ? options.employees.filter((employee) => employee.department_id === filters.departmentId)
    : options.employees;
  const periods = filters.departmentId
    ? options.periods.filter((period) => period.department_id === filters.departmentId)
    : options.periods;
  return <section className={styles.filters}><div className={styles.filterGrid}>
    <label><span>Evaluation period</span><select value={filters.periodId} onChange={(event) => onChange('periodId', event.target.value)}><option value="">All periods</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label>
    <label><span>Department</span><select value={filters.departmentId} onChange={(event) => onChange('departmentId', event.target.value)}><option value="">All departments</option>{options.departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
    <label><span>Employee</span><select value={filters.employeeId} onChange={(event) => onChange('employeeId', event.target.value)}><option value="">All employees</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name || employee.display_name || employee.email}</option>)}</select></label>
  </div><button type="button" className={styles.secondaryButton} onClick={onReset}><RotateCcw /> Reset</button></section>;
}
