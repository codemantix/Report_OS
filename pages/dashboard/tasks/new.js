import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TaskForm from '../../../components/tasks/TaskForm';
import { createTask } from '../../../services/taskService';
import { fetchDepartments } from '../../../services/departmentService';
import { fetchGoals } from '../../../services/goalService';
import { fetchPlans } from '../../../services/planService';
import { fetchUsers } from '../../../services/userService';
import { fetchActiveCompanyGoals } from '../../../services/companyGoalService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import styles from '../../../components/tasks/Tasks.module.css';

export default function NewTaskPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyGoals, setCompanyGoals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) return router.push('/auth/login');
      setUser(profile);

      const [deptRes, goalRes, planRes, userRes, companyGoalRes] = await Promise.all([
        fetchDepartments(),
        fetchGoals(),
        fetchPlans(),
        fetchUsers({ status: 'active' }),
        fetchActiveCompanyGoals(),
      ]);
      setDepartments(deptRes.data || []);
      setGoals(goalRes.data || []);
      setPlans(planRes.data || []);
      setUsers(userRes.data || []);
      setCompanyGoals(companyGoalRes.data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSubmit(formData) {
    if (!formData.title?.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!formData.department_id) {
      toast.error('Department is required');
      return;
    }

    setSaving(true);
    const payload = { ...formData, created_by: user?.id };
    const { data, error } = await createTask(payload);

    if (error) {
      toast.error(error.message || 'Failed to create task');
      setSaving(false);
      return;
    }

    toast.success('Task created successfully');
    router.push('/dashboard/tasks');
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}><div className={styles.spinner} /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>New Task</h1>
            <p className={styles.subtitle}>Create a new task for your team</p>
          </div>
        </div>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Task Details</h2>
          <TaskForm
            departments={departments}
            goals={goals}
            plans={plans}
            users={users}
            companyGoals={companyGoals}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/dashboard/tasks')}
            loading={saving}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
