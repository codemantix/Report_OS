import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import TasksTable from '../../../components/tasks/TasksTable';
import { fetchTasks } from '../../../services/taskService';
import { fetchDepartments } from '../../../services/departmentService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/tasks/Tasks.module.css';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({ department_id: '', status: '', priority: '' });
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) return router.push('/auth/login');
      setUser(profile);
      const deptRes = await fetchDepartments();
      setDepartments(deptRes.data || []);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, debouncedSearch, sort, pageSize]);

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

  const canCreate = user && (user.role === 'admin' || user.role === 'department_lead');

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '') || search;
  const isSearchLoading = search !== debouncedSearch;
  const paginatedTasks = paginateItems(tasks, page, pageSize);

  function clearFilters() {
    setFilters({ department_id: '', status: '', priority: '' });
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
        <div className={styles.header}>
          {canCreate && (
            <button className={styles.newBtn} onClick={() => router.push('/dashboard/tasks/new')}>
              New Task
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={styles.section}>
          <div className={styles.filterRow}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tasks by title, assignee, status..."
              loading={isSearchLoading}
              label="Search tasks"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={styles.filterSelect} aria-label="Sort tasks">
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="due_date:asc">Due date ascending</option>
              <option value="due_date:desc">Due date descending</option>
              <option value="priority:asc">Priority</option>
              <option value="status:asc">Status</option>
            </select>
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} className={styles.filterSelect}>
              <option value="">All Status</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)} className={styles.filterSelect}>
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ color: 'var(--color-muted)' }} className={styles.retryBtn}>
                Clear Filters
              </button>
            )}
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
    </DashboardLayout>
  );
}
