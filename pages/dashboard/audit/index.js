import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertCircle, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import PaginationControls from '../../../components/common/PaginationControls';
import AuditFilters from '../../../components/audit/AuditFilters';
import AuditSummary from '../../../components/audit/AuditSummary';
import AuditList from '../../../components/audit/AuditList';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { fetchAuditHistory } from '../../../services/auditService';
import styles from '../../../components/audit/Audit.module.css';

const INITIAL_FILTERS = {
  category: '',
  eventType: '',
  entityType: '',
  departmentId: '',
  employeeId: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 15,
};

export default function AuditHistoryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    async function initialize() {
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        router.push('/auth/login');
        return;
      }
      if (!['admin', 'department_lead'].includes(currentProfile.role)) {
        toast.error('Audit history is available to management users only.');
        router.replace('/dashboard');
        return;
      }
      setProfile(currentProfile);
      if (currentProfile.role === 'department_lead' && currentProfile.department_id) {
        setFilters((current) => ({ ...current, departmentId: currentProfile.department_id }));
      }
    }
    initialize();
  }, [router]);

  useEffect(() => {
    if (profile) load();
  }, [
    profile,
    filters.category,
    filters.eventType,
    filters.entityType,
    filters.departmentId,
    filters.employeeId,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
    filters.pageSize,
  ]);

  async function load(requestFilters = filtersRef.current) {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');
    const result = await fetchAuditHistory(requestFilters);
    if (requestId !== requestSequence.current) return;
    if (result.error) setError(result.error.message);
    else setData(result.data);
    setLoading(false);
  }

  function changeFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
      ...(name === 'category' || name === 'departmentId' ? { eventType: '' } : {}),
    }));
  }

  function resetFilters() {
    setFilters({
      ...INITIAL_FILTERS,
      departmentId: profile?.role === 'department_lead' ? profile.department_id || '' : '',
    });
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Audit History</h1>
            <p>Append-only record of evaluation, review, stipend, and payment actions. Records cannot be edited by users.</p>
          </div>
          <ScrollText />
        </header>

        {loading && !data ? (
          <div className={styles.loading}>{[1, 2, 3, 4].map((item) => <div className={styles.skeleton} key={item} />)}</div>
        ) : error || !data ? (
          <div className={styles.errorState}>
            <AlertCircle />
            <h2>Audit history could not be loaded</h2>
            <p>{error}</p>
            <button type="button" className={styles.secondaryButton} onClick={() => load()}>Try again</button>
          </div>
        ) : (
          <>
            <AuditSummary summary={data.summary} />
            <AuditFilters filters={filters} options={data.options} onChange={changeFilter} onReset={resetFilters} />
            <AuditList rows={data.rows} />
            <div className={styles.pagination}>
              <PaginationControls
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                totalCount={data.pagination.totalCount}
                totalPages={data.pagination.totalPages}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, pageSize, page: 1 }))}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
