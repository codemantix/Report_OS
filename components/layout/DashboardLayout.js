import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { getCurrentUserProfile } from '../../lib/authHelpers';
import styles from './Layout.module.css';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/dashboard/submit-report': 'Submit Report',
  '/dashboard/reports': 'Reports',
  '/dashboard/reports/[id]': 'Report Details',
  '/dashboard/attendance': 'Attendance',
  '/dashboard/departments': 'Departments',
  '/dashboard/departments/[id]': 'Department Details',
  '/dashboard/goals': 'Goals',
  '/dashboard/goals/new': 'New Goal',
  '/dashboard/goals/[id]': 'Goal Details',
  '/dashboard/plans': 'Plans',
  '/dashboard/plans/new': 'New Plan',
  '/dashboard/plans/[id]': 'Plan Details',
  '/dashboard/team': 'Team',
  '/dashboard/settings': 'Settings',
  '/dashboard/search': 'Search',
  '/dashboard/audit': 'Audit History',
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);
      setLoading(false);
    }
    loadProfile();

    function handleProfileUpdated(event) {
      if (event.detail?.profile) {
        setUser(event.detail.profile);
      }
    }

    window.addEventListener('codemantix-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('codemantix-profile-updated', handleProfileUpdated);
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-deepblue border-t-transparent rounded-full animate-spin" />
          <p className={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  const activePath = router.pathname;
  const title = pageTitles[activePath] || 'Dashboard';

  return (
    <div className={styles.layout}>
      <Sidebar
        user={user}
        activePath={activePath}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={styles.mainWrapper}>
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
        />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
