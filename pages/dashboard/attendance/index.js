import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertCircle, CalendarCheck, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import AttendanceFilters from '../../../components/attendance/AttendanceFilters';
import AttendanceForm from '../../../components/attendance/AttendanceForm';
import AttendanceTable from '../../../components/attendance/AttendanceTable';
import EmptyState from '../../../components/common/EmptyState';
import PaginationControls from '../../../components/common/PaginationControls';
import { fetchDepartments } from '../../../services/departmentService';
import {
  createAttendanceRecord,
  fetchAttendanceEmployees,
  fetchAttendanceEvaluationPeriods,
  fetchAttendanceRecords,
  updateAttendanceRecord,
} from '../../../services/attendanceService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { canManageAttendance } from '../../../utils/attendanceConstants';
import styles from '../../../components/attendance/Attendance.module.css';

const EMPTY_FILTERS = {
  department_id: '',
  employee_id: '',
  attendance_status: '',
  attendance_type: '',
  evaluation_period_id: '',
  date_from: '',
  date_to: '',
};

export default function AttendancePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [evaluationPeriods, setEvaluationPeriods] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  const canManage = canManageAttendance(profile?.role);

  useEffect(() => {
    async function initialize() {
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        router.push('/auth/login');
        return;
      }

      setProfile(currentProfile);
      if (currentProfile.role === 'department_lead') {
        setFilters((current) => ({ ...current, department_id: currentProfile.department_id || '' }));
      }

      if (canManageAttendance(currentProfile.role)) {
        const departmentId = currentProfile.role === 'department_lead'
          ? currentProfile.department_id
          : undefined;
        const [departmentResult, employeeResult, periodResult] = await Promise.all([
          fetchDepartments(departmentId ? { department_id: departmentId } : {}),
          fetchAttendanceEmployees(departmentId),
          fetchAttendanceEvaluationPeriods(departmentId),
        ]);

        const optionError = departmentResult.error || employeeResult.error || periodResult.error;
        if (optionError) toast.error(optionError.message || 'Some attendance options could not be loaded.');

        setDepartments(departmentResult.data || []);
        setEmployees(employeeResult.data || []);
        setEvaluationPeriods(periodResult.data || []);
      } else {
        const periodResult = await fetchAttendanceEvaluationPeriods(currentProfile.department_id);
        if (periodResult.error) toast.error('Evaluation-period filters could not be loaded.');
        setEvaluationPeriods(periodResult.data || []);
      }
      setOptionsLoading(false);
    }

    initialize();
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    loadAttendance();
  }, [profile, filters, page, pageSize]);

  async function loadAttendance() {
    setLoading(true);
    setError('');

    const scopedFilters = { ...filters, page, pageSize };
    if (profile.role === 'team_member') {
      scopedFilters.employee_id = profile.id;
      scopedFilters.department_id = profile.department_id;
    } else if (profile.role === 'department_lead') {
      scopedFilters.department_id = profile.department_id;
    }

    try {
      const { data, error: fetchError, count } = await fetchAttendanceRecords(scopedFilters);
      if (fetchError) {
        setError(fetchError.message || 'Attendance history could not be loaded.');
        setRecords([]);
        setTotalCount(0);
        return;
      }
      setRecords(data || []);
      setTotalCount(count || 0);
    } catch {
      setError('Attendance history could not be loaded. Please try again.');
      setRecords([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (name === 'department_id') {
        next.employee_id = '';
        next.evaluation_period_id = '';
      }
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setFilters({
      ...EMPTY_FILTERS,
      department_id: profile?.role === 'department_lead' ? profile.department_id || '' : '',
    });
    setPage(1);
  }

  function openCreateForm() {
    setEditingRecord(null);
    setShowForm(true);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingRecord(null);
  }

  async function saveAttendance(values) {
    setSaving(true);
    try {
      const result = editingRecord
        ? await updateAttendanceRecord(editingRecord.id, values)
        : await createAttendanceRecord(values, profile.id);

      if (result.error) {
        if (result.error.code === '23505') {
          toast.error('This employee already has attendance recorded for the same date, session, and type.');
        } else {
          toast.error(result.error.message || 'Attendance could not be saved.');
        }
        return;
      }

      toast.success(editingRecord ? 'Attendance updated.' : 'Attendance recorded.');
      setShowForm(false);
      setEditingRecord(null);
      if (page !== 1) setPage(1);
      else await loadAttendance();
    } catch {
      toast.error('Attendance could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasFilters = Object.entries(filters).some(([key, value]) => (
    value && !(key === 'department_id' && profile?.role === 'department_lead')
  ));
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{canManage ? 'Attendance Management' : 'My Attendance'}</h1>
            <p className={styles.subtitle}>
              {canManage
                ? 'Record official meeting and session attendance for employee evaluations.'
                : 'Review your official attendance history and associated evaluation periods.'}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openCreateForm}
              disabled={optionsLoading || showForm}
            >
              <Plus aria-hidden="true" size={18} /> Record Attendance
            </button>
          )}
        </header>

        {!canManage && (
          <div className={styles.readOnlyNotice} role="note">
            <AlertCircle aria-hidden="true" />
            <p>Attendance is an official management record. You can view your history but cannot change it.</p>
          </div>
        )}

        {showForm && canManage && (
          <AttendanceForm
            initialData={editingRecord}
            profile={profile}
            departments={departments}
            employees={employees}
            evaluationPeriods={evaluationPeriods}
            saving={saving}
            onSubmit={saveAttendance}
            onCancel={closeForm}
          />
        )}

        <AttendanceFilters
          filters={filters}
          departments={departments}
          employees={employees}
          evaluationPeriods={evaluationPeriods}
          role={profile?.role}
          onChange={updateFilter}
          onClear={clearFilters}
        />

        <section className={styles.contentCard} aria-labelledby="attendance-history-title">
          <div className={styles.contentHeader}>
            <h2 id="attendance-history-title" className={styles.contentTitle}>Attendance History</h2>
            {!loading && <span className={styles.recordCount}>{totalCount} record{totalCount === 1 ? '' : 's'}</span>}
          </div>

          {loading ? (
            <div className={styles.loadingState} aria-label="Loading attendance history">
              {[0, 1, 2, 3, 4].map((item) => <div key={item} className={styles.skeleton} />)}
            </div>
          ) : error ? (
            <div className={styles.errorState} role="alert">
              <AlertCircle aria-hidden="true" />
              <h3>Attendance could not be loaded</h3>
              <p>{error}</p>
              <button type="button" className={styles.secondaryButton} onClick={loadAttendance}>Try again</button>
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck aria-hidden="true" />}
              title="No attendance records"
              message={hasFilters
                ? 'No attendance records matched the selected filters.'
                : canManage
                  ? 'No official attendance records have been created yet.'
                  : 'You do not have any official attendance records yet.'}
            />
          ) : (
            <>
              <AttendanceTable records={records} canEdit={canManage} onEdit={openEditForm} />
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
