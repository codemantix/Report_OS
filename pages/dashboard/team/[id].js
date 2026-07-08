import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronLeft, ShieldAlert, User, FileText, CheckSquare, Settings } from 'lucide-react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { supabase } from '../../../lib/supabaseClient';
import TeamProfileHeader from '../../../components/team/TeamProfileHeader';
import TeamProfileDetails from '../../../components/team/TeamProfileDetails';
import TeamProfileStats from '../../../components/team/TeamProfileStats';
import TeamProfileReports from '../../../components/team/TeamProfileReports';
import TeamProfileTasks from '../../../components/team/TeamProfileTasks';
import TeamProfileAdminActions from '../../../components/team/TeamProfileAdminActions';
import TeamProfileReadOnlyNotice from '../../../components/team/TeamProfileReadOnlyNotice';

export default function TeamMemberProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [currentUser, setCurrentUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadProfileData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/team/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load user profile');
      }

      setTargetUser(payload.profile);
      setStats(payload.stats);
    } catch (err) {
      console.error('Error loading team member details:', err);
      setError(err.message || 'Error loading profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      
      // Block normal team members from this page completely
      if (profile.role === 'team_member') {
        router.push('/dashboard');
        return;
      }

      setCurrentUser(profile);
    }
    init();
  }, []);

  useEffect(() => {
    if (currentUser && id) {
      loadProfileData();
    }
  }, [currentUser, id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse p-4">
          <div className="h-6 bg-gray-150 dark:bg-gray-800 rounded w-1/4" />
          <div className="h-40 bg-gray-150 dark:bg-gray-800 rounded-2xl w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-150 dark:bg-gray-800 rounded-2xl w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // 1. Error / Unauthorized view
  if (error || !targetUser) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm transition-colors duration-200">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
            Unable to Load Profile
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-6">
            {error || 'The requested profile details could not be found or you do not have permission to view them.'}
          </p>
          <Link
            href="/dashboard/team"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all"
          >
            Back to Team Directory
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  // Config tabs based on role
  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'reports', label: 'Reports History', icon: FileText },
    { id: 'tasks', label: 'Assigned Tasks', icon: CheckSquare },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin_actions', label: 'Admin Controls', icon: Settings });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/team"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Team Directory
          </Link>
        </div>



        {/* Profile Card Header */}
        <TeamProfileHeader user={targetUser} />

        {/* Quick Summary Metrics Grid */}
        <TeamProfileStats stats={stats} />

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-150 dark:border-gray-800">
          <div className="flex gap-2 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all ${
                    active
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents Panel */}
        <div className="transition-all duration-200">
          {activeTab === 'overview' && (
            <TeamProfileDetails user={targetUser} />
          )}

          {activeTab === 'reports' && (
            <TeamProfileReports targetUserId={targetUser.id} />
          )}

          {activeTab === 'tasks' && (
            <TeamProfileTasks targetUserId={targetUser.id} />
          )}

          {activeTab === 'admin_actions' && isAdmin && (
            <TeamProfileAdminActions
              user={targetUser}
              currentUser={currentUser}
              onRefreshProfile={loadProfileData}
            />
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
