import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertCircle, CalendarRange, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import EmptyState from '../../../components/common/EmptyState';
import PaginationControls from '../../../components/common/PaginationControls';
import EvaluationPeriodFilters from '../../../components/evaluation-periods/EvaluationPeriodFilters';
import EvaluationPeriodForm from '../../../components/evaluation-periods/EvaluationPeriodForm';
import EvaluationPeriodSummary from '../../../components/evaluation-periods/EvaluationPeriodSummary';
import EvaluationPeriodTable from '../../../components/evaluation-periods/EvaluationPeriodTable';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import {
  createManagedEvaluationPeriod,
  fetchManagedEvaluationPeriods,
  transitionManagedEvaluationPeriod,
  updateManagedEvaluationPeriod,
} from '../../../services/evaluationPeriodService';
import { canManageEvaluationPeriods } from '../../../utils/evaluationPeriodConstants';
import styles from '../../../components/evaluation-periods/EvaluationPeriods.module.css';

export default function EvaluationPeriodsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ department_id: '', status: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    async function initialize() {
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        router.push('/auth/login');
        return;
      }
      if (!canManageEvaluationPeriods(currentProfile.role)) {
        toast.error('You do not have permission to manage evaluation periods.');
        router.replace('/dashboard');
        return;
      }
      setProfile(currentProfile);
      if (currentProfile.role === 'department_lead') {
        setFilters({ department_id: currentProfile.department_id || '', status: '' });
      }
    }
    initialize();
  }, [router]);

  useEffect(() => {
    if (profile) loadPeriods();
  }, [profile, filters, page, pageSize]);

  async function loadPeriods() {
    setLoading(true);
    setError('');
    const result = await fetchManagedEvaluationPeriods({ ...filters, page, pageSize });
    if (result.error) {
      setError(result.error.message || 'Evaluation periods could not be loaded.');
      setPeriods([]);
      setTotalCount(0);
      setTotalPages(1);
    } else {
      setPeriods(result.data?.periods || []);
      setTotalCount(result.data?.pagination?.totalCount || 0);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setDepartments(result.data?.options?.departments || []);
      setEmployees(result.data?.options?.employees || []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingPeriod(null);
    setShowForm(true);
  }

  function openEdit(period) {
    setEditingPeriod(period);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingPeriod(null);
  }

  async function savePeriod(values) {
    setSaving(true);
    if (editingPeriod) {
      const result = await updateManagedEvaluationPeriod(editingPeriod.id, values);
      if (result.error) {
        toast.error(result.error.message || 'Evaluation period could not be saved.');
      } else {
        toast.success('Draft period updated.');
        setShowForm(false);
        setEditingPeriod(null);
        await loadPeriods();
      }
    } else {
      const departments = values.department_ids || [];
      let created = 0;
      for (const departmentId of departments) {
        const departmentEmployees = employees.filter((employee) => employee.department_id === departmentId);
        const scopedEmployeeIds = values.employee_ids.filter((employeeId) =>
          departmentEmployees.some((employee) => employee.id === employeeId)
        );
        const result = await createManagedEvaluationPeriod({
          ...values,
          department_id: departmentId,
          employee_ids: scopedEmployeeIds,
        });
        if (result.error) {
          toast.error(result.error.message || 'Evaluation period could not be created.');
        } else {
          created += 1;
        }
      }
      if (created === departments.length) {
        toast.success(
          departments.length === 1
            ? 'Draft period created.'
            : `${departments.length} draft periods created across ${departments.length} departments.`
        );
        setShowForm(false);
        setEditingPeriod(null);
        await loadPeriods();
      } else if (created > 0) {
        toast.success(`${created} of ${departments.length} periods created; ${departments.length - created} failed.`);
        await loadPeriods();
      }
    }
    setSaving(false);
  }

  async function transitionPeriod(period, transition) {
    if (['approved', 'closed'].includes(transition.status)) {
      const confirmed = window.confirm(
        transition.status === 'approved'
          ? 'Approve this period? Every employee evaluation must already have human approval.'
          : 'Close this approved period? Closed periods cannot be changed.'
      );
      if (!confirmed) return;
    }

    setBusyId(period.id);
    const result = await transitionManagedEvaluationPeriod(period.id, transition.status);
    if (result.error) {
      toast.error(result.error.message || 'Evaluation period status could not be updated.');
    } else {
      toast.success(`Period moved to ${transition.label.replace('Period', '').trim()}.`);
      await loadPeriods();
    }
    setBusyId(null);
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({
      department_id: profile?.role === 'department_lead' ? profile.department_id || '' : '',
      status: '',
    });
    setPage(1);
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Evaluation Periods</h1>
            <p>Create clear bi-weekly windows that drive task, report, attendance, and employee evaluation eligibility.</p>
          </div>
          <button type="button" className={styles.primaryButton} onClick={openCreate} disabled={showForm || loading}>
            <Plus aria-hidden="true" size={18} /> New Period
          </button>
        </header>

        {!loading && !error && (
          <EvaluationPeriodSummary periods={periods} totalCount={totalCount} />
        )}

        {showForm && profile && (
          <EvaluationPeriodForm
            period={editingPeriod}
            profile={profile}
            departments={departments}
            employees={employees}
            saving={saving}
            onSubmit={savePeriod}
            onCancel={closeForm}
          />
        )}

        <EvaluationPeriodFilters
          filters={filters}
          departments={departments}
          role={profile?.role}
          onChange={updateFilter}
          onClear={clearFilters}
        />

        <section className={styles.contentCard} aria-labelledby="period-list-title">
          <div className={styles.contentHeader}>
            <h2 id="period-list-title">Bi-weekly Periods</h2>
            {!loading && !error && <span>{totalCount} period{totalCount === 1 ? '' : 's'}</span>}
          </div>

          {loading ? (
            <div className={styles.loadingState} aria-label="Loading evaluation periods">
              {[0, 1, 2, 3].map((item) => <div key={item} className={styles.skeleton} />)}
            </div>
          ) : error ? (
            <div className={styles.errorState} role="alert">
              <AlertCircle aria-hidden="true" />
              <h3>Evaluation periods could not be loaded</h3>
              <p>{error}</p>
              <button type="button" className={styles.secondaryButton} onClick={loadPeriods}>Try again</button>
            </div>
          ) : periods.length === 0 ? (
            <div className={styles.emptyState}>
              <EmptyState
                icon={<CalendarRange aria-hidden="true" />}
                title="No evaluation periods"
                message="Create the first 14-day employee evaluation window for this department."
              />
            </div>
          ) : (
            <>
              <EvaluationPeriodTable
                periods={periods}
                busyId={busyId}
                onEdit={openEdit}
                onTransition={transitionPeriod}
              />
              <div className={styles.pagination}>
                <PaginationControls
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
