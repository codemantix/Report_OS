import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import RecentReportsTable from '../../components/reports/ReportsTable';
import TeamMemberDashboard from '../../components/dashboard/TeamMemberDashboard';
import AdminDashboardCharts, { AdminDashboardChartsSkeleton } from '../../components/dashboard/AdminDashboardCharts';
import ManagementAnalyticsSection from '../../components/management-analytics/ManagementAnalyticsSection';
import { fetchDashboardStats, fetchRecentReports, fetchDepartmentProgress } from '../../services/analyticsService';
import { fetchHighRiskReports } from '../../services/reportService';
import { getCurrentUserProfile } from '../../lib/authHelpers';
import { useRealtimeSubscription } from '../../lib/realtimeHelpers';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from '../../components/dashboard/Dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [highRiskReports, setHighRiskReports] = useState([]);
  const [departmentProgress, setDepartmentProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    async function resolveRole() {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) {
          router.push('/auth/login');
          return;
        }
        setUserRole(profile.role);
      } catch {
        setUserRole('team_member');
      } finally {
        setRoleLoading(false);
      }
    }
    resolveRole();
  }, [router]);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsData, recentData, highRiskData, deptProgress] = await Promise.all([
        fetchDashboardStats(),
        fetchRecentReports(10),
        fetchHighRiskReports(),
        fetchDepartmentProgress(),
      ]);

      setStats(statsData);
      setRecentReports(recentData.data || []);
      setHighRiskReports(highRiskData.data || []);
      setDepartmentProgress(deptProgress.data || []);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (userRole === 'admin' || userRole === 'department_lead') {
      loadDashboard();
    }
  }, [userRole, roleLoading, loadDashboard]);

  // Real-time subscription: auto-refresh dashboard on reports changes
  const canSubscribe = userRole === 'admin' || userRole === 'department_lead';
  useRealtimeSubscription(
    'reports',
    () => {
      loadDashboard();
    },
    '*',
    null,
    canSubscribe
  );

  // Show a minimal loading spine while resolving role
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Team member view — render the TeamMemberDashboard
  if (userRole === 'team_member') {
    return (
      <DashboardLayout>
        <TeamMemberDashboard />
      </DashboardLayout>
    );
  }

  // Admin / Department lead — load and show the analytics view
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-6">
                <div className="skeleton h-4 w-24 mb-3" />
                <div className="skeleton h-8 w-16 mb-2" />
                <div className="skeleton h-3 w-32" />
              </div>
            ))}
          </div>
          {userRole === 'admin' && <AdminDashboardChartsSkeleton />}
          <div className="card p-6">
            <div className="skeleton h-6 w-40 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Failed to load dashboard</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => router.reload()} className="btn-primary">
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Live indicator */}
        {canSubscribe && (
          <div className={styles.headerRow}>
            <div />
            <span className={styles.liveIndicator}>
              <span className={`${styles.liveDot} ${styles.liveDotActive}`} />
              Live
            </span>
          </div>
        )}

       

        {/* Report and goal operational metrics */}
        <div className={styles.statsGrid}>
          <StatCard
            title="Total Reports"
            value={stats?.totalReports || 0}
            icon="fileText"
            trend="neutral"
          />
          <StatCard
            title="Reports This Week"
            value={stats?.weeklyReports || 0}
            icon="calendar"
            trend="up"
          />
          <StatCard
            title="Average Success Rate"
            value={`${stats?.avgSuccessRate || 0}%`}
            icon="trendingUp"
            trend={stats?.avgSuccessRate >= 60 ? 'up' : 'down'}
          />
          <StatCard
            title="Average Goal Alignment"
            value={`${stats?.avgGoalAlignment || 0}%`}
            icon="target"
            trend={stats?.avgGoalAlignment >= 60 ? 'up' : 'down'}
          />
          <StatCard
            title="Avg Progress Score"
            value={`${stats?.avgProgressScore || 0}%`}
            icon="activity"
            trend={stats?.avgProgressScore >= 60 ? 'up' : 'down'}
          />
          <StatCard
            title="High Risk Reports"
            value={stats?.highRiskReports || 0}
            icon="alertTriangle"
            trend={stats?.highRiskReports > 0 ? 'down' : 'neutral'}
            variant={stats?.highRiskReports > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="Unreviewed Reports"
            value={stats?.unreviewedReports || 0}
            icon="eye"
            trend={stats?.unreviewedReports > 0 ? 'neutral' : 'up'}
            variant={stats?.unreviewedReports > 5 ? 'warning' : 'default'}
          />
          <StatCard
            title="Completed Goals"
            value={`${stats?.completedGoals || 0}/${stats?.totalGoals || 0}`}
            icon="checkCircle"
            trend="up"
          />
        </div>

        {userRole === 'admin' && (
          <AdminDashboardCharts
            stats={stats}
            departmentProgress={departmentProgress}
          />
        )}

        {/* Recent Reports */}
        <div className={`card-premium ${styles.recentReportsCard}`}>
          <div className="flex items-center justify-between mb-4">
            <h2>Recent Reports</h2>
            <button
              onClick={() => router.push('/dashboard/reports')}
              className="btn-ghost text-sm"
            >
              View All
            </button>
          </div>
          <RecentReportsTable reports={recentReports} />
        </div>

        {/* High Risk & Department Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* High Risk Reports */}
          <div className="card-premium p-6 max-sm:p-3">
            <h2 className="mb-4">High Risk Reports</h2>
            {highRiskReports.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No high-risk reports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {highRiskReports.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.reports?.project_name || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getProfileDisplayName(item.reports?.users, 'Unknown')} • {item.reports?.departments?.name}
                      </p>
                    </div>
                    <span className="badge-danger text-xs">High Risk</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Department Progress */}
          <div className="card-premium p-6">
            <h2 className="mb-4">Department Progress</h2>
            {departmentProgress.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No department data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {departmentProgress.map((dept) => (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                      <span className="text-sm text-gray-500">{dept.avgSuccess}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand-deepblue rounded-full h-2 transition-all duration-300"
                        style={{ width: `${dept.avgSuccess}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                      <span>{dept.reportCount} reports</span>
                      {dept.highRiskCount > 0 && (
                        <span className="text-red-500">{dept.highRiskCount} high risk</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <ManagementAnalyticsSection role={userRole} />
      </div>
    </DashboardLayout>
  );
}
