import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchInput from '../../components/common/SearchInput';
import PaginationControls from '../../components/common/PaginationControls';
import MyTasksList from '../../components/tasks/MyTasksList';
import { fetchMyTasks } from '../../services/taskService';
import { getCurrentUser, getCurrentUserProfile } from '../../lib/authHelpers';
import useDebounce from '../../hooks/useDebounce';
import { paginateItems } from '../../utils/pagination';
import styles from '../../components/tasks/Tasks.module.css';

export default function MyTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, overdue: 0, pending: 0 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const authUser = await getCurrentUser();
      if (!authUser) return router.push('/auth/login');
      const profile = await getCurrentUserProfile();
      if (!profile) return router.push('/auth/login');

      const { data, error: fetchError } = await fetchMyTasks(authUser.id, {
        search: debouncedSearch || undefined,
      });
      if (fetchError) { setError(fetchError.message); setLoading(false); return; }

      const allTasks = data?.map((item) => item.tasks).filter(Boolean) || [];
      setTasks(data || []);

      const now = new Date();
      const completed = allTasks.filter((t) => t.status === 'completed').length;
      const overdue = allTasks.filter((t) => t.due_date && t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.due_date) < now).length;
      const pending = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;

      setStats({ total: allTasks.length, completed, overdue, pending });
      setLoading(false);
    }
    load();
  }, [debouncedSearch, router]);

  const paginatedTasks = paginateItems(tasks, page, pageSize);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Tasks</h1>
            <p className={styles.subtitle}>Tasks assigned to you</p>
          </div>
        </div>

        <div className={styles.section}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search tasks by title, assignee, status..."
            loading={search !== debouncedSearch}
            label="Search my tasks"
          />
        </div>

        {loading ? (
          <div className={styles.loadingWrapper}><div className={styles.spinner} /></div>
        ) : error ? (
          <div className={styles.section}>
            <p style={{ color: '#DC2626' }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Tasks', value: stats.total, color: '#2563EB' },
                { label: 'Completed', value: stats.completed, color: '#059669' },
                { label: 'Pending', value: stats.pending, color: '#D97706' },
                { label: 'Overdue', value: stats.overdue, color: '#DC2626' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{s.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Assigned Tasks</h2>
              <MyTasksList
                tasks={paginatedTasks.data}
                emptyMessage={search.trim() ? 'No assigned tasks matched your search.' : 'No tasks assigned to you yet.'}
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
