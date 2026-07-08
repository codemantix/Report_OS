import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import CompanyGoalsTable from '../../../components/company/CompanyGoalsTable';
import CompanyProgressSummary from '../../../components/company/CompanyProgressSummary';
import { fetchCompanyGoals, fetchCompanyProgressSummary } from '../../../services/companyGoalService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { canManageCompanyGoals } from '../../../lib/roleGuards';
import { MONTH_OPTIONS } from '../../../utils/companyGoalConstants';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/company/Company.module.css';

const currentYear = new Date().getFullYear();

export default function CompanyGoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

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

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterMonth, filterYear, filterStatus, pageSize]);

  // Load goals
  useEffect(() => {
    if (!user) return;
    loadGoals();
  }, [user, debouncedSearch, filterMonth, filterYear, filterStatus]);

  // Load progress summary for admin
  useEffect(() => {
    if (!user || !canManageCompanyGoals(user.role)) return;
    loadSummary();
  }, [user, filterMonth, filterYear]);

  async function loadGoals() {
    setLoading(true);
    setError(null);
    try {
      const filters = { sortBy: 'created_at', sortDirection: 'desc' };
      if (debouncedSearch) filters.search = debouncedSearch;
      if (filterMonth) filters.month = parseInt(filterMonth, 10);
      if (filterYear) filters.year = parseInt(filterYear, 10);
      if (filterStatus) filters.status = filterStatus;

      const { data, error: fetchError } = await fetchCompanyGoals(filters);
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setGoals(data || []);
    } catch {
      setError('Failed to load company goals');
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const month = filterMonth ? parseInt(filterMonth, 10) : null;
      const year = filterYear ? parseInt(filterYear, 10) : null;
      const { data } = await fetchCompanyProgressSummary(month, year);
      setSummary(data);
    } catch {
      // Non-critical — summary failure doesn't block page
    }
  }

  const isAdmin = user && canManageCompanyGoals(user.role);
  const isSearchLoading = search !== debouncedSearch;
  const paginated = paginateItems(goals, page, pageSize);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Page Header */}
        <div>
          <h1 className={styles.title}>
            {isAdmin ? 'Company Goals' : 'Company Direction'}
          </h1>
          <p className={styles.subtitle}>
            {isAdmin
              ? 'Define and track company-wide monthly goals'
              : 'View the company\'s strategic direction and monthly goals'}
          </p>
        </div>
        <div className={styles.header}>
          {isAdmin && (
            <button
              className={styles.newBtn}
              onClick={() => router.push('/dashboard/company-goals/new')}
            >
              New Company Goal
            </button>
          )}
        </div>

        {/* Progress Summary (admin only) */}
        {isAdmin && summary && (
          <CompanyProgressSummary summary={summary} />
        )}

        {/* Filters */}
        <div className={styles.section}>
          <div className={styles.filtersRow}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search company goals..."
              loading={isSearchLoading}
              label="Search goals"
            />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className={styles.select}
              style={{ maxWidth: '160px' }}
              aria-label="Filter by month"
            >
              <option value="">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className={styles.select}
              style={{ maxWidth: '120px' }}
              aria-label="Filter by year"
            >
              <option value="">All years</option>
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.select}
              style={{ maxWidth: '140px' }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
              <option value="blocked">Blocked</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : error ? (
          <div className={styles.section}>
            <div className={styles.errorState}>
              <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className={styles.errorText}>Something went wrong</p>
              <p className={styles.errorMessage}>{error}</p>
              <button className={styles.retryBtn} onClick={loadGoals}>Try Again</button>
            </div>
          </div>
        ) : goals.length === 0 ? (
          <div className={styles.section}>
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <p className={styles.emptyText}>
                {search.trim() ? 'No company goals matched your search.' : 'No company goals yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <CompanyGoalsTable goals={paginated.data} />
            <div className="mt-4">
              <PaginationControls
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalCount={paginated.totalCount}
                totalPages={paginated.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
