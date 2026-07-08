import React from 'react';
import SearchInput from '../common/SearchInput';
import styles from './Team.module.css';

export default function TeamFilters({
  search,
  onSearchChange,
  debouncedSearch,
  filters,
  onFilterChange,
  departments = [],
  isAdmin = false,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-150 dark:border-gray-800 shadow-sm transition-colors duration-200">
      <div className="flex-1 min-w-[200px] w-full">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search team members by name, email, job title..."
          loading={search !== debouncedSearch}
          label="Search Team"
        />
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-1 min-w-[140px] flex-grow md:flex-grow-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department</span>
            <select
              value={filters.department_id || ''}
              onChange={(e) => onFilterChange('department_id', e.target.value)}
              className={styles.select}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[120px] flex-grow md:flex-grow-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</span>
            <select
              value={filters.role || ''}
              onChange={(e) => onFilterChange('role', e.target.value)}
              className={styles.select}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="department_lead">Dept. Lead</option>
              <option value="team_member">Member</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[120px] flex-grow md:flex-grow-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <select
              value={filters.status || ''}
              onChange={(e) => onFilterChange('status', e.target.value)}
              className={styles.select}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
