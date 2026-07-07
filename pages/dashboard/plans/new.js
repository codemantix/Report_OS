import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import PlanForm from '../../../components/plans/PlanForm';
import { createPlan } from '../../../services/planService';
import { fetchDepartments } from '../../../services/departmentService';
import styles from '../../../components/plans/Plans.module.css';

export default function NewPlanPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const { data } = await fetchDepartments();
        setDepartments(data || []);
      } catch {
        toast.error('Failed to load departments');
      } finally {
        setFetching(false);
      }
    }
    init();
  }, []);

  async function handleSubmit(formData) {
    setLoading(true);
    try {
      const { error } = await createPlan(formData);
      if (error) {
        toast.error(error.message || 'Failed to create plan');
        return;
      }
      toast.success('Plan created successfully');
      router.push('/dashboard/plans');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    router.push('/dashboard/plans');
  }

  if (fetching) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>New Plan</h1>
            <p className={styles.subtitle}>Create a new department plan</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Plan Details</h2>
          <PlanForm
            departments={departments}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
