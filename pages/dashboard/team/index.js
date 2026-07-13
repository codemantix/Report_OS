import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TeamFilters from '../../../components/team/TeamFilters';
import PaginationControls from '../../../components/common/PaginationControls';
import TeamTable from '../../../components/team/TeamTable';
import { fetchDepartments } from '../../../services/departmentService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import { ShieldAlert, Shield } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import styles from '../../../components/team/Team.module.css';

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and robust filter states
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({
    department_id: '',
    role: '',
    status: '',
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);
      
      // Load departments for admin filters
      if (profile.role === 'admin') {
        const deptsRes = await fetchDepartments();
        if (!deptsRes.error) {
          setDepartments(deptsRes.data || []);
        }
      }
    }
    init();
  }, []);

  // Reset page on search or filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  // Reload team list when filters, search, or user changes
  useEffect(() => {
    if (user && user.role !== 'team_member') {
      loadData();
    } else if (user && user.role === 'team_member') {
      setLoading(false);
    }
  }, [user, debouncedSearch, filters]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch.trim()) queryParams.append('search', debouncedSearch);
      if (filters.department_id) queryParams.append('department_id', filters.department_id);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.status) queryParams.append('status', filters.status);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/team?${queryParams.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to fetch team members');
      }

      setUsers(payload.members || []);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const paginatedUsers = paginateItems(users, page, pageSize);

  async function handleUserUpdate(userId, updates) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let res;
      if (updates.role !== undefined) {
        res = await fetch(`/api/team/${userId}/admin-actions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ action: 'change_role', value: updates.role })
        });
      } else if (updates.department_id !== undefined) {
        res = await fetch(`/api/team/${userId}/admin-actions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ action: 'change_department', value: updates.department_id })
        });
      } else if (updates.status !== undefined) {
        res = await fetch(`/api/team/${userId}/admin-actions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ action: 'change_status', value: updates.status })
        });
      }

      if (res && !res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Failed to update user');
      }

      toast.success('User updated successfully');
      loadData();
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error(err.message || 'Failed to update user');
      throw err;
    }
  }

  async function handleUserDelete(userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/team/${userId}/admin-actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ action: 'change_status', value: 'suspended' }) // Safe deactivation MVP
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Failed to suspend user');
      }

      toast.success('Team member suspended successfully');
      loadData();
    } catch (err) {
      console.error('Failed to suspend user:', err);
      toast.error(err.message || 'Failed to suspend user');
      throw err;
    }
  }

  // 1. Team Member restricted access rendering
  if (user && user.role === 'team_member') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm transition-colors duration-200">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-6">
            Team directory access is limited to admins and department leads.
          </p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Team Directory</h1>
            <p className={styles.subtitle}>
              {isAdmin 
                ? 'View team members and manage roles, status, and department assignments.'
                : 'View members assigned to your department.'}
            </p>
          </div>
        </div>

        {/* Read-only notice for Department Leads */}
        {!isAdmin && user && (
          <div className="flex items-center gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl transition-all duration-200">
            <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              You are viewing members assigned to your department. Account changes are managed by admins.
            </span>
          </div>
        )}

        {/* Filters */}
        <TeamFilters
          search={search}
          onSearchChange={setSearch}
          debouncedSearch={debouncedSearch}
          filters={filters}
          onFilterChange={handleFilterChange}
          departments={departments}
          isAdmin={isAdmin}
        />

        {loading ? (
          <div className={`${styles.surfaceCard} space-y-3`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={styles.loadingRow} />
            ))}
          </div>
        ) : error ? (
          <div className={styles.emptyCard}>
            <div className={styles.errorState}>
              <p className={styles.errorText}>{error}</p>
              <button onClick={loadData} className={styles.retryBtn}>
                Try Again
              </button>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.emptyCard}>
            <div className={styles.emptyState}>
              <svg
                className={styles.emptyIcon}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
              <p className={styles.emptyText}>
                {isAdmin 
                  ? 'No team members found.' 
                  : 'No team members are currently assigned to your department.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableCard}>
            <TeamTable
              users={paginatedUsers.data}
              currentUser={user}
              departments={departments}
              onUserUpdate={handleUserUpdate}
              onUserDelete={handleUserDelete}
            />
            <PaginationControls
              page={paginatedUsers.page}
              pageSize={paginatedUsers.pageSize}
              totalCount={paginatedUsers.totalCount}
              totalPages={paginatedUsers.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
