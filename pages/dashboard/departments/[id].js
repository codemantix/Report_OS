import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import DepartmentForm from '../../../components/departments/DepartmentForm';
import { fetchDepartmentById, updateDepartment, deleteDepartment } from '../../../services/departmentService';
import { fetchUsersByDepartment } from '../../../services/userService';
import { fetchReports } from '../../../services/reportService';
import { fetchGoals } from '../../../services/goalService';
import { fetchPlans } from '../../../services/planService';
import { getProfileDisplayName, getProfileInitials } from '../../../utils/profileHelpers';
import styles from '../../../components/departments/Departments.module.css';

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return { startOfWeek, endOfWeek };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRiskClass(riskLevel) {
  switch (riskLevel) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    case 'low': return 'bg-emerald-100 text-emerald-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700';
    case 'high': return 'bg-orange-100 text-orange-700';
    case 'medium': return 'bg-blue-100 text-blue-700';
    case 'low': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700';
    case 'at_risk': return 'bg-amber-100 text-amber-700';
    case 'delayed': return 'bg-red-100 text-red-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'cancelled': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getPlanChipClass(planType) {
  switch (planType) {
    case 'daily': return styles.planChipDaily;
    case 'weekly': return styles.planChipWeekly;
    case 'monthly': return styles.planChipMonthly;
    case 'quarterly': return styles.planChipQuarterly;
    case 'project': return styles.planChipProject;
    default: return styles.planChipDaily;
  }
}

function StatCard({ title, value, borderClass }) {
  return (
    <div className={`${styles.statCard} ${borderClass}`}>
      <p className={styles.statTitle}>{title}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonLine} w-20 h-3 mb-3`} />
      <div className={`${styles.skeletonLine} w-16 h-7`} />
    </div>
  );
}

function DeleteConfirmModal({ onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Department</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Are you sure you want to delete this department? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [department, setDepartment] = useState(null);
  const [members, setMembers] = useState([]);
  const [reports, setReports] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadDepartment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: deptData, error: fetchError } = await fetchDepartmentById(id);
      if (fetchError) throw fetchError;
      if (!deptData) {
        setError('Department not found');
        return;
      }
      setDepartment(deptData);

      const [
        { data: membersData },
        { data: reportsData },
        { data: goalsData },
        { data: plansData },
      ] = await Promise.all([
        fetchUsersByDepartment(id),
        fetchReports({ department_id: id }),
        fetchGoals({ department_id: id }),
        fetchPlans({ department_id: id }),
      ]);

      setMembers(membersData || []);
      setReports(reportsData || []);
      setGoals(goalsData || []);
      setPlans(plansData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load department details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadDepartment();
  }, [id, loadDepartment]);

  async function handleUpdate(formData) {
    setSaving(true);
    try {
      const { error: updateError, syncError } = await updateDepartment(id, formData);
      if (updateError) throw updateError;
      if (syncError) {
        toast.error('Department updated, but lead membership could not be synced. Check user update permissions.');
      } else {
        toast.success('Department updated successfully');
      }
      setEditing(false);
      loadDepartment();
    } catch (err) {
      toast.error('Failed to update department');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteDepartment(id);
      if (deleteError) throw deleteError;
      toast.success('Department deleted successfully');
      router.push('/dashboard/departments');
    } catch (err) {
      toast.error('Failed to delete department');
      console.error(err);
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // --- Compute stats ---
  const { startOfWeek, endOfWeek } = getWeekRange();

  const teamMembersCount = members.length;

  const activeGoals = goals.filter(
    (g) => g.status !== 'completed' && g.status !== 'cancelled'
  ).length;

  const activePlans = plans.filter((p) => p.status === 'active').length;

  const reportsThisWeek = reports.filter((r) => {
    const submittedAt = new Date(r.submitted_at);
    return submittedAt >= startOfWeek && submittedAt < endOfWeek;
  }).length;

  const analyses = reports
    .map((r) => {
      const analysis = r.report_ai_analysis;
      return Array.isArray(analysis) ? analysis[0] : analysis;
    })
    .filter(Boolean);

  const avgSuccessRate =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((sum, a) => sum + (a.success_rate || 0), 0) /
            analyses.length
        )
      : 0;

  const avgProgressScore =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((sum, a) => sum + (a.progress_score || 0), 0) /
            analyses.length
        )
      : 0;

  const highRiskReports = analyses.filter(
    (a) => a.risk_level === 'high'
  ).length;

  const delayedGoals = goals.filter((g) => g.status === 'delayed').length;

  // --- Sorted / filtered lists for display sections ---
  const recentReports = [...reports]
    .sort(
      (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
    )
    .slice(0, 5);

  const activeGoalItems = goals.filter(
    (g) => g.status !== 'completed' && g.status !== 'cancelled'
  );

  const activePlanItems = plans.filter((p) => p.status === 'active');

  // --- Loading state ---
  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.skeletonGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className={styles.skeletonGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            className="px-4 py-2 text-sm max-sm:text-xs font-medium text-white bg-brand-deepblue rounded-lg hover:bg-brand-deepblue/90 transition-colors"
            onClick={() => router.push('/dashboard/departments')}
          >
            Back to Departments
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!department) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏢</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Department not found</h3>
          <p className="text-sm text-gray-500 mb-6">This department may have been removed.</p>
          <button
            className="px-4 py-2 text-sm max-sm:text-xs font-medium text-white bg-brand-deepblue rounded-lg hover:bg-brand-deepblue/90 transition-colors"
            onClick={() => router.push('/dashboard/departments')}
          >
            Back to Departments
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <DeleteConfirmModal
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteModal(false)}
            deleting={deleting}
          />
        )}

        {/* Header */}
            <button
              className="text-sm max-sm:text-xs text-brand-slate hover:text-surface-dark transition-colors mb-1 flex items-center gap-1"
              onClick={() => router.push('/dashboard/departments')}
            >
              &larr; Back to Departments
            </button>
          <div>
            <h1 className="text-2xl max-sm:text-xl font-bold text-surface-dark">{department.name}</h1>
          </div>
        <div className={styles.header}>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                department.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {department.status}
            </span>
            {!editing && (
              <>
                <button
                  className="px-4 py-2 text-sm  max-sm:text-xs font-medium text-brand-deepblue bg-brand-deepblue/5 rounded-lg hover:bg-brand-deepblue/10 transition-colors"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                <button
                  className="px-4 py-2 text-sm max-sm:text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className={styles.detailSection}>
            <h2 className={styles.sectionTitle}>Edit Department</h2>
            <div className="mt-4">
              <DepartmentForm
                initialData={department}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(false)}
                loading={saving}
              />
            </div>
          </div>
        )}

        {!editing && (
          <>
            {/* Department Info */}
            <div className={styles.detailSection}>
              <h2 className={styles.sectionTitle}>Department Info</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                    Description
                  </p>
                  <p className="text-sm max-sm:text-xs text-gray-700">
                    {department.description || 'No description provided'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                    Department Lead
                  </p>
                  <p className="text-sm max-sm:text-xs text-gray-700">
                    {department.lead
                                          ? `${getProfileDisplayName(department.lead, 'Lead')} (${department.lead.email})`
                                          : 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Row 1 */}
            <div className={styles.statsGrid}>
              <StatCard title="Team Members" value={teamMembersCount} borderClass={styles.statCardBlue} />
              <StatCard title="Active Goals" value={activeGoals} borderClass={styles.statCardEmerald} />
              <StatCard title="Active Plans" value={activePlans} borderClass={styles.statCardAmber} />
              <StatCard title="Reports This Week" value={reportsThisWeek} borderClass={styles.statCardRed} />
            </div>

            {/* Stats Row 2 */}
            <div className={styles.statsGrid}>
              <StatCard title="Avg Success Rate" value={`${avgSuccessRate}%`} borderClass={styles.statCardBlue} />
              <StatCard title="Avg Progress Score" value={`${avgProgressScore}%`} borderClass={styles.statCardEmerald} />
              <StatCard title="High-Risk Reports" value={highRiskReports} borderClass={styles.statCardAmber} />
              <StatCard title="Delayed Goals" value={delayedGoals} borderClass={styles.statCardRed} />
            </div>

            {/* Reports & Goals Grid */}
            <div className={styles.sectionGrid}>
              {/* Recent Reports */}
              <div className={styles.detailSection}>
                <h2 className={styles.sectionTitle}>Recent Reports</h2>
                {recentReports.length === 0 ? (
                  <p className={styles.emptyState}>No reports yet</p>
                ) : (
                  <div className={styles.reportList}>
                    {recentReports.map((report) => {
                      const analysis = Array.isArray(report.report_ai_analysis)
                        ? report.report_ai_analysis[0]
                        : report.report_ai_analysis;
                      const riskLevel = analysis?.risk_level;
                      return (
                        <Link
                          key={report.id}
                          href={`/dashboard/reports/${report.id}`}
                          className={styles.reportItem}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={styles.reportName}>{report.project_name}</p>
                            <p className={styles.reportMeta}>
                              {getProfileDisplayName(report.users, 'Unknown')} &middot;{' '}
                              {formatDate(report.submitted_at)}
                            </p>
                          </div>
                          {riskLevel && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskClass(riskLevel)}`}
                            >
                              {riskLevel}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Goals */}
              <div className={styles.detailSection}>
                <h2 className={styles.sectionTitle}>
                  Active Goals ({activeGoalItems.length})
                </h2>
                {activeGoalItems.length === 0 ? (
                  <p className={styles.emptyState}>No active goals</p>
                ) : (
                  <div className={styles.goalList}>
                    {activeGoalItems.map((goal) => {
                      const completionPct = goal.completion_percentage || goal.progress || 0;
                      return (
                        <Link
                          key={goal.id}
                          href={`/dashboard/goals/${goal.id}`}
                          className={styles.goalItem}
                        >
                          <div className="flex items-center justify-between">
                            <p className={styles.goalTitle}>{goal.title}</p>
                            <div className="flex items-center gap-2">
                              {goal.priority && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeClass(goal.priority)}`}
                                >
                                  {goal.priority}
                                </span>
                              )}
                              {goal.status && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(goal.status)}`}
                                >
                                  {goal.status}
                                </span>
                              )}
                            </div>
                          </div>
                          {(goal.start_date || goal.target_date) && (
                            <p className={styles.goalDates}>
                              {goal.start_date && formatDate(goal.start_date)} &rarr;{' '}
                              {goal.target_date && formatDate(goal.target_date)}
                            </p>
                          )}
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${Math.min(completionPct, 100)}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Active Plans */}
            <div className={styles.detailSection}>
              <h2 className={styles.sectionTitle}>
                Active Plans ({activePlanItems.length})
              </h2>
              {activePlanItems.length === 0 ? (
                <p className={styles.emptyState}>No active plans</p>
              ) : (
                <div className={styles.goalList}>
                  {activePlanItems.map((plan) => (
                    <div key={plan.id} className={styles.goalItem}>
                      <div className="flex items-center justify-between">
                        <p className={styles.goalTitle}>{plan.title}</p>
                        <span className={`${styles.planChip} ${getPlanChipClass(plan.plan_type)}`}>
                          {plan.plan_type}
                        </span>
                      </div>
                      {(plan.start_date || plan.end_date) && (
                        <p className={styles.goalDates}>
                          {plan.start_date && formatDate(plan.start_date)} &rarr;{' '}
                          {plan.end_date && formatDate(plan.end_date)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members Section */}
            <div className={styles.detailSection}>
              <h2 className={styles.sectionTitle}>
                Members ({members.length})
              </h2>
              {members.length === 0 ? (
                <p className={styles.emptyState}>No members in this department</p>
              ) : (
                <div className={`${styles.memberList} mt-4`}>
                  {members.map((member) => (
                    <div key={member.id} className={styles.memberItem}>
                      <div className="w-8 h-8 rounded-full bg-brand-deepblue/10 flex items-center justify-center text-brand-deepblue text-sm font-semibold">
                        {getProfileInitials(member, '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getProfileDisplayName(member, 'Unknown')}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                      {member.role && (
                        <span className="text-xs text-gray-400 capitalize">{member.role}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
