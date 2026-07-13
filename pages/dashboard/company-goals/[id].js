import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import CompanyGoalForm from '../../../components/company/CompanyGoalForm';
import CompanyGoalDetails from '../../../components/company/CompanyGoalDetails';
import CompanyExecutionChain from '../../../components/company/CompanyExecutionChain';
import CompanyAlignmentCard from '../../../components/company/CompanyAlignmentCard';
import {
  fetchCompanyGoalById,
  updateCompanyGoal,
  archiveCompanyGoal,
  fetchCompanyGoalAlignmentData,
} from '../../../services/companyGoalService';
import { fetchUsers } from '../../../services/userService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { canManageCompanyGoals } from '../../../lib/roleGuards';
import { formatMonthYear } from '../../../utils/companyGoalConstants';
import styles from '../../../components/company/Company.module.css';

export default function CompanyGoalDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [goal, setGoal] = useState(null);
  const [alignmentData, setAlignmentData] = useState(null);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    async function loadUser() {
      const profile = await getCurrentUserProfile();
      setUser(profile);
    }
    loadUser();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [goalResult, usersResult] = await Promise.all([
        fetchCompanyGoalById(id),
        fetchUsers({ status: 'active' }),
      ]);

      if (goalResult.error) {
        setError(goalResult.error.message);
        return;
      }
      if (!goalResult.data) {
        setError('Company goal not found');
        return;
      }

      setGoal(goalResult.data);
      setUsers(usersResult.data || []);

      // Load alignment data
      const alignment = await fetchCompanyGoalAlignmentData(id);
      setAlignmentData(alignment);
    } catch {
      setError('Failed to load company goal');
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = user && canManageCompanyGoals(user.role);

  async function handleUpdate(formData) {
    setSaving(true);
    try {
      const { error } = await updateCompanyGoal(id, formData);
      if (error) {
        toast.error(error.message || 'Failed to update company goal');
        return;
      }
      toast.success('Company goal updated');
      setEditing(false);
      loadData();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const { error } = await archiveCompanyGoal(id);
      if (error) {
        toast.error(error.message || 'Failed to archive');
        setArchiving(false);
        setShowArchiveConfirm(false);
        return;
      }
      toast.success('Company goal archived');
      router.push('/dashboard/company-goals');
    } catch {
      toast.error('An unexpected error occurred');
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            &larr; Back to Company Goals
          </button>
          <div className={styles.errorState}>
            <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className={styles.errorText}>Something went wrong</p>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retryBtn} onClick={loadData}>Try Again</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!goal) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            &larr; Back to Company Goals
          </button>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Company goal not found</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Edit mode
  if (editing) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <button className={styles.backBtn} onClick={() => setEditing(false)}>
            &larr; Cancel Editing
          </button>
          <div>
            <h1 className={styles.title}>Edit Company Goal</h1>
            <p className={styles.subtitle}>Update goal details</p>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Goal Details</h2>
            <CompanyGoalForm
              initialData={goal}
              users={users}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
              loading={saving}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // View mode
  return (
    <DashboardLayout>
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          &larr; Back to Company Goals
        </button>

        {/* Hero Card */}
        <div className={styles.heroCard}>
          <div className={styles.heroGlow} />
          <div className={styles.heroCardContent}>
            <h1 className={styles.heroTitle}>{goal.title}</h1>
            <p className={styles.heroSubtitle}>{formatMonthYear(goal.month, goal.year)}</p>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{(goal.objectives || []).length}</span>
                <span className={styles.heroStatLabel}>Objectives</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>
                  {(goal.expected_outcomes || []).filter((o) => o.completed).length}/{(goal.expected_outcomes || []).length}
                </span>
                <span className={styles.heroStatLabel}>Outcomes Done</span>
              </div>
              {alignmentData && (
                <>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>{alignmentData.goals.length}</span>
                    <span className={styles.heroStatLabel}>Dept. Goals</span>
                  </div>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>{alignmentData.tasks.length}</span>
                    <span className={styles.heroStatLabel}>Tasks</span>
                  </div>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>{alignmentData.reports.length}</span>
                    <span className={styles.heroStatLabel}>Reports</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className={styles.header}>
            <div className="flex items-center gap-2">
              <button className={styles.editBtn} onClick={() => setEditing(true)}>
                Edit
              </button>
              {goal.status !== 'archived' && (
                <button className={styles.archiveBtn} onClick={() => setShowArchiveConfirm(true)}>
                  Archive
                </button>
              )}
            </div>
          </div>
        )}

        {/* Goal Details */}
        <CompanyGoalDetails goal={goal} />

        {/* Execution Chain */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Execution Chain</h2>
          <CompanyExecutionChain activeStep="company_goal" />
        </div>

        {/* Linked Department Goals */}
        {alignmentData && alignmentData.goals.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Linked Department Goals ({alignmentData.goals.length})
            </h2>
            <div className={styles.linkedList}>
              {alignmentData.goals.map((g) => (
                <div
                  key={g.id}
                  className={styles.linkedItem}
                  onClick={() => router.push(`/dashboard/goals/${g.id}`)}
                >
                  <div>
                    <p className={styles.linkedItemTitle}>{g.title}</p>
                    <p className={styles.linkedItemMeta}>
                      {g.departments?.name || 'No department'} • {g.status?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`${styles.badge} ${g.priority === 'high' || g.priority === 'urgent' ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'}`}>
                    {g.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Tasks */}
        {alignmentData && alignmentData.tasks.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Linked Tasks ({alignmentData.tasks.length})
            </h2>
            <div className={styles.linkedList}>
              {alignmentData.tasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className={styles.linkedItem}
                  onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                >
                  <div>
                    <p className={styles.linkedItemTitle}>{t.title}</p>
                    <p className={styles.linkedItemMeta}>
                      {t.departments?.name || 'No department'} • {t.status?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`${styles.badge} ${t.priority === 'high' || t.priority === 'urgent' ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'}`}>
                    {t.priority}
                  </span>
                </div>
              ))}
              {alignmentData.tasks.length > 10 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--color-muted)' }}>
                  + {alignmentData.tasks.length - 10} more tasks
                </p>
              )}
            </div>
          </div>
        )}

        {/* Linked Reports */}
        {alignmentData && alignmentData.reports.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Linked Reports ({alignmentData.reports.length})
            </h2>
            <div className={styles.linkedList}>
              {alignmentData.reports.slice(0, 10).map((r) => {
                const ai = r.report_ai_analysis?.[0];
                return (
                  <div
                    key={r.id}
                    className={styles.linkedItem}
                    onClick={() => router.push(`/dashboard/reports/${r.id}`)}
                  >
                    <div>
                      <p className={styles.linkedItemTitle}>{r.project_name || 'Untitled Report'}</p>
                      <p className={styles.linkedItemMeta}>
                        {r.users ? `${r.users.full_name || r.users.display_name}` : 'Unknown'} • {r.departments?.name || ''}
                      </p>
                    </div>
                    {ai && ai.company_goal_alignment_score !== null && (
                      <CompanyAlignmentCard
                        score={ai.company_goal_alignment_score}
                        outcomeScore={ai.expected_outcome_progress_score}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Archive Confirm Modal */}
      {showArchiveConfirm && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>Archive Company Goal</h3>
            <p className={styles.confirmModalText}>
              Are you sure you want to archive &quot;{goal.title}&quot;? It will no longer appear in active goals.
            </p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowArchiveConfirm(false)}
                disabled={archiving}
              >
                Cancel
              </button>
              <button
                className={styles.archiveBtn}
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
