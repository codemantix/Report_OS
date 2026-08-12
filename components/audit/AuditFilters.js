import { RotateCcw } from 'lucide-react';
import {
  AUDIT_CATEGORY_LABELS,
  AUDIT_ENTITY_TYPE_LABELS,
  AUDIT_EVENT_TYPE_LABELS,
  auditCategory,
} from '../../utils/auditConstants';
import styles from './Audit.module.css';

export default function AuditFilters({ filters, options, onChange, onReset }) {
  const employees = filters.departmentId
    ? options.employees.filter((employee) => employee.department_id === filters.departmentId)
    : options.employees;

  const eventTypes = Object.keys(AUDIT_EVENT_TYPE_LABELS)
    .filter((eventType) => !filters.category || auditCategory(eventType) === filters.category);

  return (
    <section className={styles.filters}>
      <div className={styles.filterGrid}>
        <label>
          <span>Category</span>
          <select
            value={filters.category || ''}
            onChange={(event) => onChange('category', event.target.value)}
          >
            <option value="">All categories</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Event type</span>
          <select
            value={filters.eventType || ''}
            onChange={(event) => onChange('eventType', event.target.value)}
          >
            <option value="">All events</option>
            {eventTypes.map((eventType) => (
              <option value={eventType} key={eventType}>{AUDIT_EVENT_TYPE_LABELS[eventType]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Entity type</span>
          <select
            value={filters.entityType || ''}
            onChange={(event) => onChange('entityType', event.target.value)}
          >
            <option value="">All entities</option>
            {Object.entries(AUDIT_ENTITY_TYPE_LABELS).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Department</span>
          <select
            value={filters.departmentId || ''}
            onChange={(event) => onChange('departmentId', event.target.value)}
            disabled={options.departments.length === 0}
          >
            <option value="">All departments</option>
            {options.departments.map((department) => (
              <option value={department.id} key={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Employee</span>
          <select
            value={filters.employeeId || ''}
            onChange={(event) => onChange('employeeId', event.target.value)}
          >
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.full_name || employee.display_name || employee.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From date</span>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(event) => onChange('dateFrom', event.target.value)}
          />
        </label>
        <label>
          <span>To date</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(event) => onChange('dateTo', event.target.value)}
          />
        </label>
      </div>
      <button type="button" className={styles.secondaryButton} onClick={onReset}>
        <RotateCcw /> Reset
      </button>
    </section>
  );
}
