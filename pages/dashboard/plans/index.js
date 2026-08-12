import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import PlansTable from '../../../components/plans/PlansTable';
import { fetchPlans, deletePlans } from '../../../services/planService';
import { fetchDepartments } from '../../../services/departmentService';
import { MONTH_OPTIONS } from '../../../utils/companyGoalConstants';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/plans/Plans.module.css';
import FilterDropdown, { FilterGroup } from '../../../components/common/FilterDropdown';
import MonthCards from '../../../components/common/MonthCards';

// Default the "plans by month" view to the current month on load.
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({ department_id: '', plan_type: '', month: String(currentMonth), year: String(currentYear) });
  const [sort, setSort] = useState('created_at:asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-select & Bulk actions state
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);

      // Load department filters
      const deptRes = await fetchDepartments();
      setDepartments(deptRes.data || []);
    }
    init();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filters, debouncedSearch, pageSize, sort]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page]);

  useEffect(() => {
    if (!user) return;

    const [sortBy, sortDirection] = sort.split(':');
    const { month, year, ...planFilters } = filters;
    const builtFilters = {
      ...planFilters,
      search: debouncedSearch || undefined,
      sortBy,
      sortDirection,
    };
    
    if (user.role !== 'admin') {
      builtFilters.department_id = user.department_id;
    }
    
    loadPlans(builtFilters);
  }, [user, filters, debouncedSearch, sort]);

  async function loadPlans(filters = {}) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchPlans(filters);
      if (error) {
        setError(error.message);
        return;
      }
      setPlans(data || []);
    } catch (err) {
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete() {
    setDeletingBulk(true);
    try {
      const { error: deleteError } = await deletePlans(selectedIds);
      if (deleteError) {
        toast.error(deleteError.message || 'Failed to delete selected plans');
        return;
      }
      toast.success('Plans deleted successfully');
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      
      const [sortBy, sortDirection] = sort.split(':');
      const { month, year, ...planFilters } = filters;
      const builtFilters = {
        ...planFilters,
        search: debouncedSearch || undefined,
        sortBy,
        sortDirection,
      };
      if (user.role !== 'admin') {
        builtFilters.department_id = user.department_id;
      }
      loadPlans(builtFilters);
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingBulk(false);
    }
  }

  const canCreate = user && (user.role === 'admin' || user.role === 'department_lead');
  const hasActiveFilters = Object.values(filters).some((v) => v !== '') || search.trim() !== '';
  const isSearchLoading = search !== debouncedSearch;

  const filteredPlans = plans.filter((plan) => {
    if (!filters.month && !filters.year) return true;
    if (!plan.end_date) return false;

    const endDate = new Date(plan.end_date);
    if (Number.isNaN(endDate.getTime())) return false;

    const matchesMonth = !filters.month || endDate.getUTCMonth() + 1 === Number(filters.month);
    const matchesYear = !filters.year || endDate.getUTCFullYear() === Number(filters.year);
    return matchesMonth && matchesYear;
  });
  const paginatedPlans = paginateItems(filteredPlans, page, pageSize);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleSelectMonth(month, year) {
    setFilters((prev) => ({ ...prev, month, year }));
  }

  function clearFilters() {
    setFilters({ department_id: '', plan_type: '', month: '', year: '' });
    setSearch('');
    setSort('created_at:asc');
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
          <div>
            <h1 className={styles.title}>Department Plans</h1>
            <p className={styles.subtitle}>Create and manage department plans</p>
          </div>
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {canCreate && (
            <button
              className={styles.newBtn}
              onClick={() => router.push('/dashboard/plans/new')}
            >
              + New Plan
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
                id="cancel-select-plans-btn"
                className={styles.selectionCancelBtn}
                onClick={() => setSelectedIds([])}
              >
                Cancel
              </button>
              <button
                id="bulk-delete-plans-btn"
                className={styles.selectionDeleteBtn}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                🗑 Delete ({selectedIds.length})
              </button>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search plans by title, department, type..."
              loading={isSearchLoading}
              label="Search plans"
            />
            <FilterDropdown
              hasActiveFilters={Object.values(filters).some((v) => v !== '')}
              activeCount={Object.values(filters).filter((v) => v !== '').length}
              onClear={clearFilters}
            >
              <FilterGroup label="Sort">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort plans">
                  <option value="created_at:asc">Oldest first</option>
                  <option value="created_at:desc">Newest first</option>
                  <option value="title:asc">Title A–Z</option>
                  <option value="plan_type:asc">Plan type</option>
                </select>
              </FilterGroup>
              {user?.role === 'admin' && (
                <FilterGroup label="Department">
                  <select value={filters.department_id} onChange={(e) => updateFilter('department_id', e.target.value)} aria-label="Filter by department">
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </FilterGroup>
              )}
              <FilterGroup label="Plan Type">
                <select value={filters.plan_type} onChange={(e) => updateFilter('plan_type', e.target.value)} aria-label="Filter by plan type">
                  <option value="">All Plan Types</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="project">Project</option>
                </select>
              </FilterGroup>
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

        <MonthCards
          items={plans}
          dateField="end_date"
          selectedMonth={filters.month}
          selectedYear={filters.year}
          onSelectMonth={handleSelectMonth}
          sectionId="plan-months-title"
          sectionTitle="Plans by end month"
          sectionDescription="Select a month to show its plans in the table."
          allLabel="All plans"
          allDescription="Complete plan overview"
          itemLabel="plan"
          itemsLabel="plans"
          monthLabel="End month"
          periodPhrase="ending in"
        />

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
              <button className={styles.retryBtn} onClick={loadPlans}>
                Try Again
              </button>
            </div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className={styles.section}>
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
              <p className={styles.emptyText}>
                {hasActiveFilters ? 'No plans matched your search filters.' : 'No plans yet. Plans will appear here once created by admins.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.section}>
            <PlansTable
              plans={paginatedPlans.data}
              isAdmin={user?.role === 'admin'}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
            <PaginationControls
              page={paginatedPlans.page}
              pageSize={paginatedPlans.pageSize}
              totalCount={paginatedPlans.totalCount}
              totalPages={paginatedPlans.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {showBulkDeleteConfirm && (
        <div className={styles.confirmModal} onClick={() => setShowBulkDeleteConfirm(false)}>
          <div className={styles.confirmModalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmModalTitle}>Delete Selected Plans?</h3>
            <p className={styles.confirmModalText}>
              Are you sure you want to permanently delete the <strong>{selectedIds.length}</strong> selected plans? This action cannot be undone.
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
