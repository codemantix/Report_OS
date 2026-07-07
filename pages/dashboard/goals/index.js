import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import GoalsTable from '../../../components/goals/GoalsTable';
import { fetchGoals } from '../../../services/goalService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/goals/Goals.module.css';

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState('created_at:desc');

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);
    }
    init();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, sort]);

  useEffect(() => {
    if (!user) return;

    const filters = {};
    if (user.role !== 'admin') {
      filters.department_id = user.department_id;
    }
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    const [sortBy, sortDirection] = sort.split(':');
    filters.sortBy = sortBy;
    filters.sortDirection = sortDirection;
    loadGoals(filters);
  }, [user, debouncedSearch, sort]);

  async function loadGoals(filters = {}) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchGoals(filters);
      if (error) {
        setError(error.message);
        return;
      }
      setGoals(data || []);
    } catch (err) {
      setError('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }

  const canCreate = user && (user.role === 'admin' || user.role === 'department_lead');
  const hasActiveSearch = search.trim() !== '';
  const isSearchLoading = search !== debouncedSearch;
  const paginatedGoals = paginateItems(goals, page, pageSize);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Goals</h1>
            <p className={styles.subtitle}>Define and track department goals</p>
          </div>
          {canCreate && (
            <button
              className={styles.newBtn}
              onClick={() => router.push('/dashboard/goals/new')}
            >
              New Goal
            </button>
          )}
        </div>

        <div className={styles.section}>
          <div className="flex flex-wrap gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search goals by title, department, success metric..."
              loading={isSearchLoading}
              label="Search goals"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={styles.select} aria-label="Sort goals">
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="due_date:asc">Due date ascending</option>
              <option value="due_date:desc">Due date descending</option>
              <option value="priority:asc">Priority</option>
              <option value="status:asc">Status</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className={styles.section}>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className={styles.section}>
            <div className={styles.errorState}>
              <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className={styles.errorText}>Something went wrong</p>
              <p className={styles.errorMessage}>{error}</p>
              <button className={styles.retryBtn} onClick={loadGoals}>
                Try Again
              </button>
            </div>
          </div>
        ) : goals.length === 0 ? (
          <div className={styles.section}>
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
              <p className={styles.emptyText}>
                {hasActiveSearch ? 'No goals matched your search.' : 'No goals yet. Goals will appear here once created by admins.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.section}>
            <GoalsTable goals={paginatedGoals.data} />
            <PaginationControls
              page={paginatedGoals.page}
              pageSize={paginatedGoals.pageSize}
              totalCount={paginatedGoals.totalCount}
              totalPages={paginatedGoals.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
