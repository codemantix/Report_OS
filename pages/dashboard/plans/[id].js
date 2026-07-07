import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import PlanForm from '../../../components/plans/PlanForm';
import { fetchPlanById, updatePlan, deletePlan } from '../../../services/planService';
import { fetchDepartments } from '../../../services/departmentService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { formatDate } from '../../../utils/dateHelpers';
import styles from '../../../components/plans/Plans.module.css';

const TYPE_COLORS = {
  daily: 'text-sky-700 bg-sky-100',
  weekly: 'text-indigo-700 bg-indigo-100',
  monthly: 'text-blue-700 bg-blue-100',
  quarterly: 'text-purple-700 bg-purple-100',
  project: 'text-emerald-700 bg-emerald-100',
};

export default function PlanDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [plan, setPlan] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [planResult, deptResult] = await Promise.all([
        fetchPlanById(id),
        fetchDepartments(),
      ]);

      if (planResult.error) {
        setError(planResult.error.message);
        return;
      }

      if (!planResult.data) {
        setError('Plan not found');
        return;
      }

      setPlan(planResult.data);
      setDepartments(deptResult.data || []);
    } catch {
      setError('Failed to load plan');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadUser() {
      const profile = await getCurrentUserProfile();
      setUser(profile);
    }
    loadUser();
  }, []);

  const canManage = user && (user.role === 'admin' || user.role === 'department_lead');

  async function handleUpdate(formData) {
    setSaving(true);
    try {
      const { error } = await updatePlan(id, formData);
      if (error) {
        toast.error(error.message || 'Failed to update plan');
        return;
      }
      toast.success('Plan updated successfully');
      setEditing(false);
      loadData();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await deletePlan(id);
      if (error) {
        toast.error(error.message || 'Failed to delete plan');
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      toast.success('Plan deleted successfully');
      router.push('/dashboard/plans');
    } catch {
      toast.error('An unexpected error occurred');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/dashboard/plans')}
          >
            &larr; Back to Plans
          </button>
          <div className={styles.errorState}>
            <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className={styles.errorText}>Something went wrong</p>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retryBtn} onClick={loadData}>
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/dashboard/plans')}
          >
            &larr; Back to Plans
          </button>
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={styles.emptyText}>Plan not found</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (editing) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button
            className={styles.backBtn}
            onClick={() => setEditing(false)}
          >
            &larr; Cancel Editing
          </button>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Edit Plan</h1>
              <p className={styles.subtitle}>Update plan details</p>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Plan Details</h2>
            <PlanForm
              initialData={plan}
              departments={departments}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
              loading={saving}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <button
          className={styles.backBtn}
          onClick={() => router.push('/dashboard/plans')}
        >
          &larr; Back to Plans
        </button>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{plan.title}</h1>
            <p className={styles.subtitle}>
              {plan.departments?.name || 'No department'}
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                className={styles.editBtn}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <div className={styles.detailGrid}>
            <div>
              <p className={styles.detailLabel}>Plan Type</p>
              <p className={styles.detailValue}>
                <span className={`${styles.typeBadge} ${TYPE_COLORS[plan.plan_type] || TYPE_COLORS.monthly}`}>
                  {plan.plan_type}
                </span>
              </p>
            </div>
            <div>
              <p className={styles.detailLabel}>Department</p>
              <p className={styles.detailValue}>{plan.departments?.name || 'N/A'}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>Start Date</p>
              <p className={styles.detailValue}>{formatDate(plan.start_date) || 'N/A'}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>End Date</p>
              <p className={styles.detailValue}>{formatDate(plan.end_date) || 'N/A'}</p>
            </div>
          </div>
        </div>

        {plan.description && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.description}</p>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>Delete Plan</h3>
            <p className={styles.confirmModalText}>
              Are you sure you want to delete &quot;{plan.title}&quot;? This action cannot be undone.
            </p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
