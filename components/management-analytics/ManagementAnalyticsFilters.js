import { Filter, RotateCcw } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

export default function ManagementAnalyticsFilters({ filters, appliedFilters, options, role, onChange, onClear }) {
  const departmentId = appliedFilters?.departmentId || filters.departmentId;
  const employees = (options.employees || []).filter((employee) => !departmentId || employee.department_id === departmentId);
  const periods = (options.periods || []).filter((period) => !departmentId || period.department_id === departmentId);

  const activeCount = [filters.periodId, filters.departmentId, filters.employeeId, filters.performanceBand].filter(Boolean).length;

  return (
    <section className={styles.filters} aria-label="Management analytics filters">
      <div className={styles.filterHeader}>
        <div className={styles.filterHeading}>
          <Filter size={15} aria-hidden="true" />
          <span>Filter evaluation intelligence</span>
        </div>
        {activeCount > 0 && (
          <span className={styles.activeFilterBadge}>{activeCount} filter{activeCount === 1 ? '' : 's'} active</span>
        )}
      </div>
      <div className={styles.filterGrid}>
        <label>
          <span>Evaluation period</span>
          <select value={filters.periodId} onChange={(event) => onChange('periodId', event.target.value)}>
            <option value="">All periods</option>
            {periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}
          </select>
        </label>
        <label>
          <span>Department</span>
          <select value={departmentId} disabled={role !== 'admin'} onChange={(event) => onChange('departmentId', event.target.value)}>
            <option value="">All departments</option>
            {(options.departments || []).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label>
          <span>Employee</span>
          <select value={filters.employeeId} onChange={(event) => onChange('employeeId', event.target.value)}>
            <option value="">All employees</option>
            {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name || employee.display_name || employee.email}</option>)}
          </select>
        </label>
        <label>
          <span>Performance band</span>
          <select value={filters.performanceBand} onChange={(event) => onChange('performanceBand', event.target.value)}>
            <option value="">All bands</option>
            {(options.performanceBands || []).map((band) => <option value={band} key={band}>{band}</option>)}
          </select>
        </label>
      </div>
      {activeCount > 0 && (
        <button type="button" className={styles.clearButton} onClick={onClear}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset filters
        </button>
      )}
    </section>
  );
}
