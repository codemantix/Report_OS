import React from 'react';
import SearchInput from '../common/SearchInput';
import FilterDropdown, { FilterGroup } from '../common/FilterDropdown';

export default function TeamFilters({
  search,
  onSearchChange,
  debouncedSearch,
  filters,
  onFilterChange,
  departments = [],
  isAdmin = false,
}) {
  const hasActiveFilters = isAdmin && Object.values(filters).some((v) => v !== '');
  const activeCount = isAdmin ? Object.values(filters).filter((v) => v !== '').length : 0;

  function clearFilters() {
    onFilterChange('department_id', '');
    onFilterChange('role', '');
    onFilterChange('status', '');
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'var(--color-surface)',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ flex: 1, minWidth: '200px' }}>
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search team members by name, email, job title..."
          loading={search !== debouncedSearch}
          label="Search Team"
        />
      </div>

      {isAdmin && (
        <FilterDropdown
          hasActiveFilters={hasActiveFilters}
          activeCount={activeCount}
          onClear={clearFilters}
        >
          <FilterGroup label="Department">
            <select
              value={filters.department_id || ''}
              onChange={(e) => onFilterChange('department_id', e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </FilterGroup>
          <FilterGroup label="Role">
            <select
              value={filters.role || ''}
              onChange={(e) => onFilterChange('role', e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="department_lead">Dept. Lead</option>
              <option value="team_member">Member</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Status">
            <select
              value={filters.status || ''}
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </FilterGroup>
        </FilterDropdown>
      )}
    </div>
  );
}
