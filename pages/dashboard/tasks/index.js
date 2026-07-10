import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import TasksTable from '../../../components/tasks/TasksTable';
import { fetchTasks, deleteTasks } from '../../../services/taskService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchGoals } from '../../../services/goalService';
import { fetchPlans } from '../../../services/planService';
import { fetchActiveCompanyGoals } from '../../../services/companyGoalService';
import { MONTH_OPTIONS } from '../../../utils/companyGoalConstants';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/tasks/Tasks.module.css';
import FilterDropdown, { FilterGroup } from '../../../components/common/FilterDropdown';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [companyGoals, setCompanyGoals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({ department_id: '', status: '', priority: '', company_goal_id: '', goal_id: '', plan_id: '', month: '', year: '' });
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Multi-select & Bulk actions state
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) return router.push('/auth/login');
      setUser(profile);

      // Load filters metadata
      const [deptRes, goalRes, planRes, cgRes] = await Promise.all([
        fetchDepartments(),
        fetchGoals(),
        fetchPlans(),
        fetchActiveCompanyGoals(),
      ]);
      setDepartments(deptRes.data || []);
      setGoals(goalRes.data || []);
      setPlans(planRes.data || []);
      setCompanyGoals(cgRes.data || []);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filters, debouncedSearch, sort, pageSize]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page]);

  useEffect(() => {
    if (user) loadTasks(user);
  }, [user, filters, debouncedSearch, sort]);

  async function loadTasks(userProfile) {
    setLoading(true);
    setError(null);
    try {
      const [sortBy, sortDirection] = sort.split(':');
      const builtFilters = {
        ...filters,
        search: debouncedSearch || undefined,
        sortBy,
        sortDirection,
      };
      if (userProfile.role !== 'admin') {
        builtFilters.department_id = userProfile.department_id;
      }
      if (userProfile.role === 'team_member') {
        builtFilters.assignee_id = userProfile.id;
      }
      const { data, error: fetchError } = await fetchTasks(builtFilters);
      if (fetchError) throw fetchError;
      setTasks(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete() {
    setDeletingBulk(true);
    try {
      const { error: deleteError } = await deleteTasks(selectedIds);
      if (deleteError) {
        toast.error(deleteError.message || 'Failed to delete selected tasks');
        return;
      }
      toast.success('Tasks deleted successfully');
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      loadTasks(user);
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingBulk(false);
    }
  }

  const canCreate = user && (user.role === 'admin' || user.role === 'department_lead');

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '') || search.trim() !== '';
  const isSearchLoading = search !== debouncedSearch;
  const paginatedTasks = paginateItems(tasks, page, pageSize);

  function clearFilters() {
    setFilters({ department_id: '', status: '', priority: '', company_goal_id: '', goal_id: '', plan_id: '', month: '', year: '' });
    setSearch('');
    setSort('created_at:desc');
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
          <div>
            <h1 className={styles.title}>Tasks</h1>
            <p className={styles.subtitle}>Manage and track team tasks</p>
          </div>
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {canCreate && (
            <button
              className={styles.newBtn}
              onClick={() => router.push('/dashboard/tasks/new')}
            >
              New Task
            </button>
          )}
        </div>

        {/* Floating selection action bar */}
        {user?.role === 'admin' && selectedIds.length > 0 && (
          <div className={styles.selectionBar} role="toolbar" aria-label="Selection actions">
            <span className={styles.selectionCount}>
              <span className={styles.selectionCountNum}>{selectedIds.length}</span>
              selected
            </span>
            <div className={styles.selectionBarActions}>
              <button
                id="cancel-select-tasks-btn"
                className={styles.selectionCancelBtn}
                onClick={() => setSelectedIds([])}
              >
                Cancel
              </button>
              <button
                id="bulk-delete-tasks-btn"
                className={styles.selectionDeleteBtn}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                🗑 Delete ({selectedIds.length})
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.section}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tasks by title, assignee, status..."
              loading={isSearchLoading}
              label="Search tasks"
            />
            <FilterDropdown
              hasActiveFilters={Object.values(filters).some((v) => v !== '')}
              activeCount={Object.values(filters).filter((v) => v !== '').length}
              onClear={clearFilters}
            >
              <FilterGroup label="Sort">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks">
                  <option value="created_at:desc">Newest first</option>
                  <option value="created_at:asc">Oldest first</option>
                  <option value="due_date:asc">Due date ascending</option>
                  <option value="due_date:desc">Due date descending</option>
                  <option value="priority:asc">Priority</option>
                  <option value="status:asc">Status</option>
                </select>
              </FilterGroup>
              {user?.role === 'admin' && (
                <FilterGroup label="Department">
                  <select value={filters.department_id} onChange={(e) => updateFilter('department_id', e.target.value)}>
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </FilterGroup>
              )}
              <FilterGroup label="Status">
                <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                  <option value="">All Status</option>
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </FilterGroup>
              <FilterGroup label="Priority">
                <select value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)}>
                  <option value="">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </FilterGroup>
              {companyGoals.length > 0 && (
                <FilterGroup label="Company Goal">
                  <select value={filters.company_goal_id} onChange={(e) => updateFilter('company_goal_id', e.target.value)}>
                    <option value="">All Company Goals</option>
                    {companyGoals.map((cg) => (
                      <option key={cg.id} value={cg.id}>{cg.title}</option>
                    ))}
                  </select>
                </FilterGroup>
              )}
              {goals.length > 0 && (
                <FilterGroup label="Dept Goal">
                  <select value={filters.goal_id} onChange={(e) => updateFilter('goal_id', e.target.value)}>
                    <option value="">All Dept Goals</option>
                    {goals
                      .filter((g) => !filters.department_id || g.department_id === filters.department_id)
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                  </select>
                </FilterGroup>
              )}
              {plans.length > 0 && (
                <FilterGroup label="Plan">
                  <select value={filters.plan_id} onChange={(e) => updateFilter('plan_id', e.target.value)}>
                    <option value="">All Plans</option>
                    {plans
                      .filter((p) => !filters.department_id || p.department_id === filters.department_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                  </select>
                </FilterGroup>
              )}
              <FilterGroup label="Month">
                <select value={filters.month} onChange={(e) => updateFilter('month', e.target.value)} aria-label="Filter by month">
                  <option value="">All Months</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </FilterGroup>
              <FilterGroup label="Year">
                <select value={filters.year} onChange={(e) => updateFilter('year', e.target.value)} aria-label="Filter by year">
                  <option value="">All Years</option>
                  {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </FilterGroup>
            </FilterDropdown>
          </div>
        </div>

        {loading ? (
          <div className={styles.section}>
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className={styles.loadingRow} />)}</div>
          </div>
        ) : error ? (
          <div className={styles.section}>
            <div className={styles.errorState}>
              <p className={styles.errorMessage}>{error}</p>
              <button className={styles.retryBtn} onClick={() => loadTasks(user)}>Try Again</button>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.section}>
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className={styles.emptyText}>
                {canCreate
                  ? 'No tasks matched your search or filters.'
                  : canCreate
                    ? 'No tasks have been created yet. Create your first task to start assigning work to the team.'
                    : user?.role === 'department_lead'
                      ? 'No tasks have been created for your department yet.'
                      : 'You do not have any assigned tasks yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.section}>
            <TasksTable
              tasks={paginatedTasks.data}
              emptyMessage={hasActiveFilters ? 'No tasks matched your search or filters.' : 'No tasks found.'}
              isAdmin={user?.role === 'admin'}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
            <PaginationControls
              page={paginatedTasks.page}
              pageSize={paginatedTasks.pageSize}
              totalCount={paginatedTasks.totalCount}
              totalPages={paginatedTasks.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {showBulkDeleteConfirm && (
        <div className={styles.confirmModal} onClick={() => setShowBulkDeleteConfirm(false)}>
          <div className={styles.confirmModalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmModalTitle}>Delete Selected Tasks?</h3>
            <p className={styles.confirmModalText}>
              Are you sure you want to permanently delete the <strong>{selectedIds.length}</strong> selected tasks? This action cannot be undone.
            </p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={deletingBulk}
              >
                Cancel
              </button>
              <button
                className={styles.submitBtn}
                style={{ backgroundColor: '#EF4444' }}
                onClick={handleBulkDelete}
                disabled={deletingBulk}
              >
                {deletingBulk ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
