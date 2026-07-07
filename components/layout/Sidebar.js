import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from '../ui/BrandLogo';
import { getProfileDisplayName, getProfileInitials, getProfileSubtitle } from '../../utils/profileHelpers';
import {
  LayoutDashboard,
  FileText,
  Send,
  Building2,
  Target,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  UserCheck,
  CheckSquare,
} from 'lucide-react';
import styles from './Sidebar.module.css';

function getNavigationByRole(role) {
  // Base navigation — all roles see these
  const base = [
    {
      section: 'Main',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/submit-report', label: 'Submit Report', icon: Send },
      ],
    },
  ];

  const managementSection = {
    section: 'Management',
    items: [],
  };

  switch (role) {
    case 'admin':
      managementSection.items = [
        { href: '/dashboard/reports', label: 'Reports', icon: FileText },
        { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
        { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
        { href: '/dashboard/goals', label: 'Goals', icon: Target },
        { href: '/dashboard/plans', label: 'Plans', icon: ClipboardList },
        { href: '/dashboard/team', label: 'Team', icon: Users },
      ];
      break;

    case 'department_lead':
      managementSection.items = [
        { href: '/dashboard/reports', label: 'Department Reports', icon: FileText },
        { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
        { href: '/dashboard/goals', label: 'Goals', icon: Target },
        { href: '/dashboard/plans', label: 'Plans', icon: ClipboardList },
        { href: '/dashboard/team', label: 'Team Members', icon: UserCheck },
      ];
      break;

    case 'team_member':
    default:
      managementSection.items = [
        { href: '/dashboard/reports', label: 'My Reports', icon: FileText },
        { href: '/dashboard/my-tasks', label: 'My Tasks', icon: CheckSquare },
        { href: '/dashboard/goals', label: 'My Goals', icon: Target },
        { href: '/dashboard/plans', label: 'Department Plans', icon: ClipboardList },
      ];
      break;
  }

  return [
    ...base,
    managementSection,
    {
      section: 'System',
      items: [
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];
}

export default function Sidebar({ user, activePath, isOpen, onClose }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const navigation = getNavigationByRole(user?.role);

  const userInitials = getProfileInitials(user);
  const userDisplayName = getProfileDisplayName(user, 'User');
  const userSubtitle = getProfileSubtitle(user);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <BrandLogo variant="sidebar" />
        </div>

        <nav className={styles.nav}>
          {navigation.map((section) => (
            <div key={section.section}>
              {section.items.length > 0 && (
                <>
                  <div className={styles.section}>
                    <span className={styles.sectionLabel}>{section.section}</span>
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    // Match active path including dynamic routes
                    const isActive = activePath === item.href ||
                      (item.href !== '/dashboard' && activePath.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={isActive ? styles.navLinkActive : styles.navLink}
                        onClick={onClose}
                      >
                        <Icon className={styles.navIcon} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={userDisplayName} className={styles.userAvatarImage} />
              ) : (
                userInitials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={styles.userName}>{userDisplayName}</div>
              <div className={styles.userRole}>{userSubtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={styles.signOutBtn}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
          <button onClick={handleSignOut} className={styles.signOutBtn}>
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
