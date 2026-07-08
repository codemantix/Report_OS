import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Briefcase, ChevronRight } from 'lucide-react';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Team.module.css';

const roleLabels = {
  admin: 'Admin',
  department_lead: 'Dept. Lead',
  team_member: 'Member',
};

const roleStyles = {
  admin: styles.roleAdmin,
  department_lead: styles.roleLead,
  team_member: styles.roleMember,
};

const statusStyles = {
  active: styles.statusActive,
  inactive: styles.statusInactive,
  suspended: styles.statusSuspended,
};

export default function TeamMemberCard({ user, currentUser }) {
  const displayName = getProfileDisplayName(user, 'User');
  const initials = getProfileInitials(user);
  const isMe = currentUser && user.id === currentUser.id;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-150 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`${styles.userAvatar} !w-10 !h-10 !text-sm`}>
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={displayName}
                  className={styles.userAvatarImage}
                  width={40}
                  height={40}
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                {displayName}
                {isMe && <span className="text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full">(you)</span>}
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                {user.job_title || 'No Title'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className={`${styles.roleBadge} ${roleStyles[user.role] || styles.roleMember} !text-[10px] !px-2`}>
              {roleLabels[user.role] || 'Member'}
            </span>
            <span className={`${styles.statusBadge} ${statusStyles[user.status] || styles.statusActive} !text-[10px] !px-2`}>
              {user.status || 'active'}
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Mail size={14} className="text-gray-400" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Briefcase size={14} className="text-gray-400" />
            <span>{user.departments?.name || 'No Department'}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800/60 pt-4 mt-auto">
        <Link
          href={`/dashboard/team/${user.id}`}
          className="w-full flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <span>View full profile</span>
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
