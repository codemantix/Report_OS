import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Send, FileText, Target, ClipboardList, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import SearchInput from '../common/SearchInput';
import { getCurrentUserProfile } from '../../lib/authHelpers';
import { fetchUserReports } from '../../services/reportService';
import { fetchGoalsByUserId } from '../../services/goalService';
import { fetchPlans } from '../../services/planService';
import { formatDate, timeAgo } from '../../utils/dateHelpers';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import useDebounce from '../../hooks/useDebounce';
import styles from './TeamMemberDashboard.module.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getLatestAnalysis(analysis) {
  if (!Array.isArray(analysis)) return analysis || null;
  if (analysis.length === 0) return null;

  return [...analysis].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function computeStats(reports, goals) {
  const totalReports = reports.length;
  const pendingTasks = reports.filter(
    (r) => !r.reviewed || r.ai_status !== 'completed'
  ).length;
  const assignedGoals = goals.length;

  const analyses = reports
    .map((r) => getLatestAnalysis(r.report_ai_analysis))
    .filter(Boolean);

  const avgSuccessRate =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((sum, a) => sum + (a.success_rate || 0), 0) /
            analyses.length
        )
      : 0;

  return { totalReports, avgSuccessRate, pendingTasks, assignedGoals };
}

function StatCard({ title, value, icon: Icon, variant = 'default' }) {
  const variantClass =
    variant === 'success'
      ? 'border-l-emerald-500'
      : variant === 'warning'
      ? 'border-l-amber-500'
      : variant === 'info'
      ? 'border-l-blue-500'
      : 'border-l-blue-600';

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 ${variantClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function TeamMemberDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportSearch, setReportSearch] = useState('');
  const debouncedReportSearch = useDebounce(reportSearch, 400);

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) {
          router.push('/auth/login');
          return;
        }
        setUser(profile);

        const [reportsResult, goalsResult, plansResult] = await Promise.all([
          fetchUserReports(profile.id, 50, { search: debouncedReportSearch || undefined }),
          fetchGoalsByUserId(profile.id),
          profile.department_id
            ? fetchPlans({ department_id: profile.department_id })
            : Promise.resolve({ data: [] }),
        ]);

        setReports(reportsResult.data || []);
        setGoals(goalsResult.data || []);
        setPlans(plansResult.data || []);
      } catch (err) {
        console.error('Failed to load team member dashboard:', err);
        setError('Failed to load your dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router, debouncedReportSearch]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className={styles.page}>
        {/* Skeleton greeting */}
        <div className="space-y-2">
          <div className={`${styles.skeleton} h-8 w-64`} />
          <div className={`${styles.skeleton} h-4 w-48`} />
        </div>

        {/* Skeleton stats */}
        <div className={styles.loadingGrid}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className={`${styles.skeleton} h-4 w-24 mb-3`} />
              <div className={`${styles.skeleton} h-8 w-16`} />
            </div>
          ))}
        </div>

        {/* Skeleton quick actions */}
        <div className={styles.quickActions}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className={`${styles.skeleton} h-10 w-10 mb-3 rounded-lg`} />
              <div className={`${styles.skeleton} h-4 w-32 mb-1`} />
              <div className={`${styles.skeleton} h-3 w-24`} />
            </div>
          ))}
        </div>

        {/* Skeleton section grid */}
        <div className={styles.sectionGrid}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className={`${styles.skeleton} h-5 w-36 mb-4`} />
              {[...Array(3)].map((_, j) => (
                <div key={j} className={`${styles.skeleton} h-12 w-full mb-2`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Something went wrong
        </h3>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button
          onClick={() => router.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  const stats = computeStats(reports, goals);
  const recentReports = reports.slice(0, 5);
  const isReportSearchLoading = reportSearch !== debouncedReportSearch;

  // Grab the latest AI analysis from the user's most recent analyzed report
  const latestAnalysis = (() => {
    for (const report of reports) {
      const analysis = getLatestAnalysis(report.report_ai_analysis);
      if (analysis) return analysis;
    }
    return null;
  })();

  return (
    <div className={styles.page}>
      {/* Greeting */}
      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>
          {getGreeting()}, {getProfileDisplayName(user, 'there')}
        </h1>
        <p className={styles.greetingSubtitle}>Here&apos;s your work summary</p>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <div
          className={styles.quickActionCard}
          onClick={() => router.push('/dashboard/submit-report')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') router.push('/dashboard/submit-report');
          }}
        >
          <div className={styles.quickActionIcon}>
            <Send className="w-5 h-5" />
          </div>
          <h3 className={styles.quickActionTitle}>Submit New Report</h3>
          <p className={styles.quickActionDesc}>
            Create a new project or weekly report
          </p>
        </div>

        <div
          className={styles.quickActionCard}
          onClick={() => router.push('/dashboard/reports')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') router.push('/dashboard/reports');
          }}
        >
          <div className={styles.quickActionIcon}>
            <FileText className="w-5 h-5" />
          </div>
          <h3 className={styles.quickActionTitle}>View My Reports</h3>
          <p className={styles.quickActionDesc}>
            Browse and manage your submitted reports
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          title="Total Reports"
          value={stats.totalReports}
          icon={FileText}
          variant="info"
        />
        <StatCard
          title="Average Success Rate"
          value={`${stats.avgSuccessRate}%`}
          icon={TrendingUp}
          variant={stats.avgSuccessRate >= 60 ? 'success' : 'warning'}
        />
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={ClipboardList}
          variant={stats.pendingTasks > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Assigned Goals"
          value={stats.assignedGoals}
          icon={Target}
          variant="info"
        />
      </div>

      {/* My Recent Reports & My Goals */}
      <div className={styles.sectionGrid}>
        {/* My Recent Reports */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>My Recent Reports</h2>
            {reports.length > 5 && (
              <button
                onClick={() => router.push('/dashboard/reports')}
                className={styles.viewAllLink}
              >
                View All
              </button>
            )}
          </div>
          <div className={styles.cardBody}>
            <div className="mb-4">
              <SearchInput
                value={reportSearch}
                onChange={setReportSearch}
                placeholder="Search reports by member, project, task, blocker..."
                loading={isReportSearchLoading}
                label="Search my reports"
              />
            </div>
            {recentReports.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText className={styles.emptyIcon} />
                <p className={styles.emptyText}>
                  {reportSearch.trim() ? 'No reports matched your search.' : 'You haven\'t submitted any reports yet'}
                </p>
                <button
                  onClick={() => router.push('/dashboard/submit-report')}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit your first report
                </button>
              </div>
            ) : (
              <div>
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    className={styles.reportItem}
                    onClick={() =>
                      router.push(`/dashboard/reports/${report.id}`)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        router.push(`/dashboard/reports/${report.id}`);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {report.reviewed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {report.project_name || 'Untitled Report'}
                        </p>
                        <p className={styles.reportMeta}>
                          {timeAgo(report.submitted_at)} •{' '}
                          {report.report_type?.replace('_', ' ') || 'report'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        report.reviewed
                          ? styles.successBadge
                          : styles.warningBadge
                      }
                    >
                      {report.reviewed ? 'Reviewed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Goals */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>My Goals</h2>
            {goals.length > 0 && (
              <button
                onClick={() => router.push('/dashboard/goals')}
                className={styles.viewAllLink}
              >
                View All
              </button>
            )}
          </div>
          <div className={styles.cardBody}>
            {goals.length === 0 ? (
              <div className={styles.emptyState}>
                <Target className={styles.emptyIcon} />
                <p className={styles.emptyText}>
                  No goals assigned to you yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.slice(0, 4).map((assignment) => {
                  const goal = assignment.goals;
                  if (!goal) return null;

                  const progress = goal.progress || 0;
                  const status = goal.status || 'not_started';

                  const statusBadge =
                    status === 'completed'
                      ? styles.successBadge
                      : status === 'in_progress'
                      ? styles.infoBadge
                      : status === 'delayed'
                      ? styles.dangerBadge
                      : styles.warningBadge;

                  const statusLabel = status.replace(/_/g, ' ');

                  return (
                    <div
                      key={assignment.id}
                      className={styles.goalItem}
                      onClick={() =>
                        router.push(`/dashboard/goals/${goal.id}`)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          router.push(`/dashboard/goals/${goal.id}`);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={styles.goalTitle}>{goal.title}</p>
                          <p className={styles.goalDept}>
                            {goal.departments?.name || 'No department'}
                          </p>
                        </div>
                        <span className={statusBadge}>{statusLabel}</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Feedback Summary */}
      {latestAnalysis && (
        <div className={styles.aiFeedbackCard}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Latest Report Analysis
              </h3>
              <div className="flex flex-wrap gap-4">
                {latestAnalysis.success_rate !== null &&
                  latestAnalysis.success_rate !== undefined && (
                    <div className={styles.scoreCard}>
                      <p className={styles.scoreValue}>
                        {latestAnalysis.success_rate}%
                      </p>
                      <p className={styles.scoreLabel}>Success Rate</p>
                    </div>
                  )}
                {latestAnalysis.progress_score !== null &&
                  latestAnalysis.progress_score !== undefined && (
                    <div className={styles.scoreCard}>
                      <p className={styles.scoreValue}>
                        {latestAnalysis.progress_score}%
                      </p>
                      <p className={styles.scoreLabel}>Progress Score</p>
                    </div>
                  )}
                {latestAnalysis.goal_alignment_score !== null &&
                  latestAnalysis.goal_alignment_score !== undefined && (
                    <div className={styles.scoreCard}>
                      <p className={styles.scoreValue}>
                        {latestAnalysis.goal_alignment_score}%
                      </p>
                      <p className={styles.scoreLabel}>Goal Alignment</p>
                    </div>
                  )}
                {latestAnalysis.report_quality_score !== null &&
                  latestAnalysis.report_quality_score !== undefined && (
                    <div className={styles.scoreCard}>
                      <p className={styles.scoreValue}>
                        {latestAnalysis.report_quality_score}%
                      </p>
                      <p className={styles.scoreLabel}>Quality Score</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
