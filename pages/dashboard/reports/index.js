import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import ReportsTable from '../../../components/reports/ReportsTable';
import { fetchReportsPaginated } from '../../../services/reportService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { useRealtimeSubscription } from '../../../lib/realtimeHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../../../components/reports/ReportsPage.module.css';

const reportTypes = [
  { value: '', label: 'All Types' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'project', label: 'Project' },
  { value: 'task_completion', label: 'Task Completion' },
  { value: 'blocker', label: 'Blocker' },
];

const PAGE_SIZES = [10, 15, 25, 50];

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    department_id: '',
    report_type: '',
    reviewed: '',
    risk_level: '',
    user_id: '',
    ai_status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [sort, setSort] = useState('submitted_at:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userDepartmentId, setUserDepartmentId] = useState(null);
  const [analyzingPending, setAnalyzingPending] = useState(false);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (profile) {
        setUserRole(profile.role);
        setUserId(profile.id);
        setUserDepartmentId(profile.department_id || null);
      }
      Promise.all([
        fetchDepartments(),
        fetchUsers(),
      ]).then(([deptRes, usersRes]) => {
        setDepartments(deptRes.data || []);
        setTeamMembers(usersRes.data || []);
      }).catch(() => {});
      await loadReports();
    }
    init();
  }, []);

  // Reset to page 1 whenever filters, search, or pageSize change
  useEffect(() => {
    setPage(1);
  }, [filters, debouncedSearch, pageSize, sort]);

  function buildApiFilters() {
    const apiFilters = {};
    if (filters.department_id) apiFilters.department_id = filters.department_id;
    if (filters.report_type) apiFilters.report_type = filters.report_type;
    if (filters.reviewed !== '') apiFilters.reviewed = filters.reviewed === 'true';
    if (filters.risk_level) apiFilters.risk_level = filters.risk_level;
    if (filters.user_id) apiFilters.user_id = filters.user_id;
    if (filters.ai_status) apiFilters.ai_status = filters.ai_status;
    if (filters.dateFrom) apiFilters.dateFrom = `${filters.dateFrom}T00:00:00.000Z`;
    if (filters.dateTo) apiFilters.dateTo = `${filters.dateTo}T23:59:59.999Z`;
    if (debouncedSearch) apiFilters.search = debouncedSearch;
    const [sortBy, sortDirection] = sort.split(':');
    apiFilters.sortBy = sortBy;
    apiFilters.sortDirection = sortDirection;
    // Role-scoped access: team members see their own reports; leads see their department.
    if (userRole === 'team_member' && userId) {
      apiFilters.user_id = userId;
    }
    if (userRole === 'department_lead' && userDepartmentId) {
      apiFilters.department_id = userDepartmentId;
    }
    return apiFilters;
  }

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportsPaginated(buildApiFilters(), page, pageSize);
      if (result.error) throw result.error;
      setReports(result.data || []);
      setTotalCount(result.count || 0);
      setTotalPages(result.totalPages || 0);
    } catch (err) {
      setError('Failed to load reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, page, pageSize, sort, userRole, userId, userDepartmentId]);

  // Load reports when page, pageSize, or filters change (excluding initial mount)
  useEffect(() => {
    if (userId) {
      loadReports();
    }
  }, [loadReports, userId]);

  // Real-time subscription: auto-refresh reports list on changes
  const isOnFirstPage = page === 1;
  useRealtimeSubscription(
    'reports',
    () => {
      // Only auto-reload when on the first page to avoid disrupting paginated browsing
      if (isOnFirstPage) {
        loadReports();
      }
    },
    '*',
    null,
    true
  );

  function goToPage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function getPageNumbers() {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);

      if (page <= 2) {
        start = 2;
        end = Math.min(4, totalPages - 1);
      } else if (page >= totalPages - 1) {
        start = Math.max(totalPages - 3, 2);
        end = totalPages - 1;
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');

      pages.push(totalPages);
    }

    return pages;
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({ department_id: '', report_type: '', reviewed: '', risk_level: '', user_id: '', ai_status: '', dateFrom: '', dateTo: '' });
    setSearch('');
    setSort('submitted_at:desc');
  }

  async function handleAnalyzePending() {
    setAnalyzingPending(true);
    try {
      const response = await fetch('/api/reports/analyze-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10, includeFailed: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to analyze pending reports');

      const failed = result.results?.filter((item) => item.status === 'failed').length || 0;
      if (result.processed === 0) {
        toast.success('No pending reports need analysis');
      } else if (failed > 0) {
        toast.error(`Analyzed ${result.processed - failed} report(s); ${failed} failed`);
      } else {
        toast.success(`Analyzed ${result.processed} pending report(s)`);
      }
      await loadReports();
    } catch (err) {
      toast.error(err.message || 'Failed to analyze pending reports');
    } finally {
      setAnalyzingPending(false);
    }
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '') || search !== '';
  const isSearchLoading = search !== debouncedSearch;
  const canManageAnalysis = userRole === 'admin' || userRole === 'department_lead';

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const pageNumbers = getPageNumbers();

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Reports</h1>
            <p className={styles.subtitle}>View and manage all submitted reports</p>
          </div>
          <div className="flex items-center gap-3">
            {canManageAnalysis && (
              <button
                type="button"
                onClick={handleAnalyzePending}
                disabled={analyzingPending}
                className={styles.filterBtn}
              >
                {analyzingPending ? 'Analyzing...' : 'Analyze Pending'}
              </button>
            )}
            <span className={styles.liveIndicator}>
              <span className={`${styles.liveDot} ${styles.liveDotActive}`} />
              Live
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersCard}>
          <div className={styles.filtersRow}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search reports by member, project, task, blocker..."
              loading={isSearchLoading}
              label="Search reports"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={styles.filterSelect}
              aria-label="Sort reports"
            >
              <option value="submitted_at:desc">Newest first</option>
              <option value="submitted_at:asc">Oldest first</option>
              <option value="project_name:asc">Project A–Z</option>
              <option value="report_type:asc">Type A–Z</option>
            </select>

            {userRole !== 'team_member' && (
              <select
                value={filters.user_id}
                onChange={(e) => updateFilter('user_id', e.target.value)}
                className={styles.filterSelect}
                aria-label="Filter by team member"
              >
                <option value="">All Team Members</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.display_name || member.full_name || member.email}</option>
                ))}
              </select>
            )}

            <select
              value={filters.department_id}
              onChange={(e) => updateFilter('department_id', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={filters.report_type}
              onChange={(e) => updateFilter('report_type', e.target.value)}
              className={styles.filterSelect}
            >
              {reportTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select
              value={filters.reviewed}
              onChange={(e) => updateFilter('reviewed', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Status</option>
              <option value="false">Unreviewed</option>
              <option value="true">Reviewed</option>
            </select>

            <select
              value={filters.ai_status}
              onChange={(e) => updateFilter('ai_status', e.target.value)}
              className={styles.filterSelect}
              aria-label="Filter by AI status"
            >
              <option value="">All AI Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={filters.risk_level}
              onChange={(e) => updateFilter('risk_level', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className={styles.filterSelect}
              aria-label="Submitted from date"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className={styles.filterSelect}
              aria-label="Submitted to date"
            />

            {hasActiveFilters && (
              <button onClick={clearFilters} className={styles.filterBtn}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className={styles.loadingCard}>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={styles.loadingRow} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={styles.errorCard}>
            <p className={styles.errorText}>{error}</p>
            <button onClick={loadReports} className={styles.retryBtn}>Try Again</button>
          </div>
        )}

        {/* Table & Pagination */}
        {!loading && !error && (
          <div className={styles.tableCard}>
            <ReportsTable
              reports={reports}
              emptyMessage={hasActiveFilters ? 'No reports matched your search or filters.' : 'No reports have been submitted yet.'}
            />
            {totalCount > 0 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  Showing {startItem}–{endItem} of {totalCount} reports
                </div>
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-1">
                    <label className={styles.paginationLabel}>Rows per page:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className={styles.perPageSelect}
                    >
                      {PAGE_SIZES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.paginationButtons}>
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className={styles.pageBtn}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {pageNumbers.map((p, idx) =>
                      p === '...' ? (
                        <span key={`ellipsis-${idx}`} className={`${styles.paginationEllipsis} px-2`}>…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p)}
                          className={p === page ? styles.pageBtnActive : styles.pageBtn}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className={styles.pageBtn}
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
