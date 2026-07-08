import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import CompanyGoalForm from '../../../components/company/CompanyGoalForm';
import { createCompanyGoal } from '../../../services/companyGoalService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { canManageCompanyGoals } from '../../../lib/roleGuards';
import styles from '../../../components/company/Company.module.css';

export default function NewCompanyGoalPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile || !canManageCompanyGoals(profile.role)) {
        router.push('/dashboard/company-goals');
        return;
      }

      try {
        const { data } = await fetchUsers({ status: 'active' });
        setUsers(data || []);
      } catch {
        toast.error('Failed to load users');
      } finally {
        setFetching(false);
      }
    }
    init();
  }, []);

  async function handleSubmit(formData) {
    setLoading(true);
    try {
      const profile = await getCurrentUserProfile();
      const payload = { ...formData, created_by: profile?.id || null };

      const { error } = await createCompanyGoal(payload);
      if (error) {
        toast.error(error.message || 'Failed to create company goal');
        return;
      }
      toast.success('Company goal created successfully');
      router.push('/dashboard/company-goals');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    router.push('/dashboard/company-goals');
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
            <h1 className={styles.title}>New Company Goal</h1>
            <p className={styles.subtitle}>Define a new company-wide monthly goal</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Goal Details</h2>
          <CompanyGoalForm
            users={users}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
