import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import GoalForm from '../../../components/goals/GoalForm';
import { createGoal } from '../../../services/goalService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchUsers } from '../../../services/userService';
import { fetchActiveCompanyGoals } from '../../../services/companyGoalService';
import styles from '../../../components/goals/Goals.module.css';

export default function NewGoalPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyGoals, setCompanyGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [deptResult, usersResult, companyGoalsResult] = await Promise.all([
          fetchDepartments(),
          fetchUsers({ status: 'active' }),
          fetchActiveCompanyGoals(),
        ]);
        setDepartments(deptResult.data || []);
        setUsers(usersResult.data || []);
        setCompanyGoals(companyGoalsResult.data || []);
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
      const { error } = await createGoal(formData);
      if (error) {
        toast.error(error.message || 'Failed to create goal');
        return;
      }
      toast.success('Goal created successfully');
      router.push('/dashboard/goals');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    router.push('/dashboard/goals');
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
            <h1 className={styles.title}>New Goal</h1>
            <p className={styles.subtitle}>Create a new department goal</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Goal Details</h2>
          <GoalForm
            departments={departments}
            users={users}
            companyGoals={companyGoals}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
