import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import SearchInput from '../../../components/common/SearchInput';
import PaginationControls from '../../../components/common/PaginationControls';
import DepartmentForm from '../../../components/departments/DepartmentForm';
import DepartmentCard from '../../../components/departments/DepartmentCard';
import { fetchDepartments, createDepartment } from '../../../services/departmentService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import useDebounce from '../../../hooks/useDebounce';
import { paginateItems } from '../../../utils/pagination';
import styles from '../../../components/departments/Departments.module.css';


export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      setUser(profile);
      setProfileResolved(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (!profileResolved) return;
    setPage(1);
    const filters = { search: debouncedSearch || undefined };
    if (user?.role !== 'admin' && user?.department_id) {
      filters.department_id = user.department_id;
    }
    loadDepartments(filters);
  }, [debouncedSearch, pageSize, user, profileResolved]);

  async function loadDepartments(filters = {}) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchDepartments(filters);
      if (fetchError) throw fetchError;
      setDepartments(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(formData) {
    setCreating(true);
    try {
      const { error: createError, syncError } = await createDepartment(formData);
      if (createError) throw createError;
      if (syncError) {
        toast.error('Department created, but lead membership could not be synced. Check user update permissions.');
      } else {
        toast.success('Department created successfully');
      }
      setShowCreate(false);
      const filters = { search: debouncedSearch || undefined };
      if (user?.role !== 'admin' && user?.department_id) filters.department_id = user.department_id;
      loadDepartments(filters);
    } catch (err) {
      toast.error('Failed to create department');
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  const hasActiveSearch = search.trim() !== '';
  const isSearchLoading = search !== debouncedSearch;
  const paginatedDepartments = paginateItems(departments, page, pageSize);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className="text-2xl font-bold text-surface-dark">Departments</h1>
            <p className="text-brand-slate mt-1">Manage departments and leads</p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-deepblue rounded-lg hover:bg-brand-deepblue/90 transition-colors"
            onClick={() => setShowCreate(true)}
          >
            + Create Department
          </button>
        </div>

        <div className="card-premium p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search departments by name or lead..."
            loading={isSearchLoading}
            label="Search departments"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6">
                <div className="skeleton h-5 w-32 mb-3" />
                <div className="skeleton h-3 w-48 mb-2" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Error loading departments</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-brand-deepblue rounded-lg hover:bg-brand-deepblue/90 transition-colors"
              onClick={() => loadDepartments({ search: debouncedSearch || undefined, department_id: user?.role !== 'admin' ? user?.department_id : undefined })}
            >
              Try Again
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="card-premium p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🏢</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {hasActiveSearch ? 'No matching departments' : 'No departments yet'}
            </h3>
            <p className="text-sm text-gray-500">
              {hasActiveSearch ? 'No departments matched your search.' : 'Departments will appear here once created.'}
            </p>
          </div>
        ) : (
          <div className="card-premium overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {paginatedDepartments.data.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  onClick={() => router.push(`/dashboard/departments/${dept.id}`)}
                />
              ))}
            </div>
            <PaginationControls
              page={paginatedDepartments.page}
              pageSize={paginatedDepartments.pageSize}
              totalCount={paginatedDepartments.totalCount}
              totalPages={paginatedDepartments.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizes={[9, 18, 27]}
            />
          </div>
        )}

        {/* Create Department Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-premium p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-surface-dark">Create Department</h2>
                <button
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowCreate(false)}
                >
                  <span className="text-xl">&times;</span>
                </button>
              </div>
              <DepartmentForm
                onSubmit={handleCreate}
                onCancel={() => setShowCreate(false)}
                loading={creating}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
