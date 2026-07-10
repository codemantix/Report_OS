import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import ReportsTable from '../../../components/reports/ReportsTable';
import { fetchReportsPaginated, deleteReports } from '../../../services/reportService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { useRealtimeSubscription } from '../../../lib/realtimeHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FilterDropdown, { FilterGroup } from '../../../components/common/FilterDropdown';
import styles from '../../../components/reports/ReportsPage.module.css';
import reportsStyles from '../../../components/reports/Reports.module.css';

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
  const [selectedReportIds, setSelectedReportIds] = useState([]);
  const [deletingReports, setDeletingReports] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    setSelectedReportIds([]);
  }, [filters, debouncedSearch, pageSize, sort]);

  useEffect(() => {
    setSelectedReportIds([]);
  }, [page]);

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

  const handleSelectReport = (id) => {
    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allOnPageIds = reports.map((r) => r.id);
    const allSelected = allOnPageIds.every((id) => selectedReportIds.includes(id));
    if (allSelected) {
      setSelectedReportIds((prev) => prev.filter((id) => !allOnPageIds.includes(id)));
    } else {
      setSelectedReportIds((prev) => {
        const union = new Set([...prev, ...allOnPageIds]);
        return Array.from(union);
      });
    }
  };

  const handleDeleteSelected = async () => {
    setDeletingReports(true);
    try {
      const { error: deleteError } = await deleteReports(selectedReportIds);
      if (deleteError) {
        toast.error(deleteError.message || 'Failed to delete reports');
        return;
      }
      toast.success('Selected reports deleted successfully');
      setSelectedReportIds([]);
      loadReports();
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingReports(false);
      setShowDeleteConfirm(false);
    }
  };

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
  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length;
  const isSearchLoading = search !== debouncedSearch;
  const canManageAnalysis = userRole === 'admin' || userRole === 'department_lead';

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const pageNumbers = getPageNumbers();

  return (
    <DashboardLayout>
      <div className={styles.page}>
          <div>
            <h1 className={styles.title}>Reports</h1>
            <p className={styles.subtitle}>View and manage all submitted reports</p>
          </div>
        <div className={styles.header}>
          <div className="flex items-center gap-3 ml-auto">
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search reports by member, project, task, blocker..."
              loading={isSearchLoading}
              label="Search reports"
            />
            <FilterDropdown
              hasActiveFilters={Object.values(filters).some((v) => v !== '')}
              activeCount={activeFilterCount}
              onClear={clearFilters}
            >
              <FilterGroup label="Sort">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reports">
                  <option value="submitted_at:desc">Newest first</option>
                  <option value="submitted_at:asc">Oldest first</option>
                  <option value="project_name:asc">Project A–Z</option>
                  <option value="report_type:asc">Type A–Z</option>
                </select>
              </FilterGroup>
              {userRole !== 'team_member' && (
                <FilterGroup label="Team Member">
                  <select value={filters.user_id} onChange={(e) => updateFilter('user_id', e.target.value)} aria-label="Filter by team member">
                    <option value="">All Team Members</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.display_name || member.full_name || member.email}</option>
                    ))}
                  </select>
                </FilterGroup>
              )}
              <FilterGroup label="Department">
                <select value={filters.department_id} onChange={(e) => updateFilter('department_id', e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FilterGroup>
              <FilterGroup label="Report Type">
                <select value={filters.report_type} onChange={(e) => updateFilter('report_type', e.target.value)}>
                  {reportTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FilterGroup>
              <FilterGroup label="Review Status">
                <select value={filters.reviewed} onChange={(e) => updateFilter('reviewed', e.target.value)}>
                  <option value="">All Status</option>
                  <option value="false">Unreviewed</option>
                  <option value="true">Reviewed</option>
                </select>
              </FilterGroup>
              <FilterGroup label="AI Status">
                <select value={filters.ai_status} onChange={(e) => updateFilter('ai_status', e.target.value)} aria-label="Filter by AI status">
                  <option value="">All AI Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </FilterGroup>
              <FilterGroup label="Risk Level">
                <select value={filters.risk_level} onChange={(e) => updateFilter('risk_level', e.target.value)}>
                  <option value="">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </FilterGroup>
              <FilterGroup label="From Date">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  aria-label="Submitted from date"
                />
              </FilterGroup>
              <FilterGroup label="To Date">
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  aria-label="Submitted to date"
                />
              </FilterGroup>
            </FilterDropdown>
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
              selectedReportIds={selectedReportIds}
              onSelectionChange={setSelectedReportIds}
              isAdmin={userRole === 'admin'}
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

      {/* Floating selection action bar */}
      {userRole === 'admin' && selectedReportIds.length > 0 && (
        <div className={reportsStyles.selectionBar} role="toolbar" aria-label="Selection actions">
          <span className={reportsStyles.selectionCount}>
            <span className={reportsStyles.selectionCountNum}>{selectedReportIds.length}</span>
            selected
          </span>
          <div className={reportsStyles.selectionBarActions}>
            <button
              id="cancel-select-reports-btn"
              className={reportsStyles.selectionCancelBtn}
              onClick={() => setSelectedReportIds([])}
            >
              Cancel
            </button>
            <button
              id="bulk-delete-reports-btn"
              className={reportsStyles.selectionDeleteBtn}
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑 Delete ({selectedReportIds.length})
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Reports</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete the {selectedReportIds.length} selected reports permanently? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingReports}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingReports}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50"
              >
                {deletingReports ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
