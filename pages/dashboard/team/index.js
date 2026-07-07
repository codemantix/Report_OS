import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import TeamTable from '../../../components/team/TeamTable';
import { fetchUsers, updateUser } from '../../../services/userService';
import { fetchDepartments } from '../../../services/departmentService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/team/Team.module.css';

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function init() {
      // Check user role first
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      if (profile.role === 'team_member') {
        router.push('/dashboard');
        return;
      }
      setUser(profile);
    }
    init();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  useEffect(() => {
    if (user) loadData({ search: debouncedSearch || undefined });
  }, [user, debouncedSearch]);

  async function loadData(filters = {}) {
    setLoading(true);
    setError(null);
    try {
      const effectiveFilters = { ...filters };
      if (user?.role !== 'admin' && user?.department_id) {
        effectiveFilters.department_id = user.department_id;
      }

      const [usersRes, deptsRes] = await Promise.all([
        fetchUsers(effectiveFilters),
        fetchDepartments(),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (deptsRes.error) throw deptsRes.error;

      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  const paginatedUsers = paginateItems(users, page, pageSize);

  async function handleUserUpdate(userId, updates) {
    try {
      const { data, error: updateError } = await updateUser(userId, updates);
      if (updateError) throw updateError;

      // Optimistically update local state
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              ...updates,
              departments:
                updates.department_id !== undefined
                  ? departments.find((d) => d.id === updates.department_id) || u.departments
                  : u.departments,
            };
          }
          return u;
        })
      );

      toast.success('User updated successfully');
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error(err.message || 'Failed to update user');
      throw err;
    }
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Team</h1>
            <p className={styles.subtitle}>
              View team members and manage roles, status, and department assignments
            </p>
          </div>
        </div>

        <div className={styles.surfaceCard}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search team members by name, email, role..."
            loading={search !== debouncedSearch}
            label="Search team members"
          />
        </div>

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
              <button onClick={() => loadData({ search: debouncedSearch || undefined })} className={styles.retryBtn}>
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
                {search.trim() ? 'No team members matched your search.' : 'No team members yet. Members will appear here once they register.'}
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
