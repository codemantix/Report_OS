import React from 'react';
import Image from 'next/image';
import { Mail, Phone, Calendar } from 'lucide-react';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import { format } from 'date-fns';
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

export default function TeamProfileHeader({ user }) {
  if (!user) return null;

  const displayName = getProfileDisplayName(user, 'User');
  const initials = getProfileInitials(user);
  const joinDate = user.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy') : 'N/A';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm transition-colors duration-200">
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        
        {/* Profile Info Left */}
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 overflow-hidden shadow-inner border border-gray-100 dark:border-gray-800">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
                width={80}
                height={80}
              />
            ) : (
              initials
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {displayName}
            </h1>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {user.job_title || 'No Job Title'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {user.departments?.name || 'No Department assigned'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Mail size={14} className="text-gray-400" />
                {user.email}
              </span>
              {user.phone_number && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" />
                  {user.phone_number}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                Joined {joinDate}
              </span>
            </div>
          </div>
        </div>

        {/* Badges Right */}
        <div className="flex md:flex-col items-center md:items-end gap-2.5">
          <span className={`${styles.roleBadge} ${roleStyles[user.role] || styles.roleMember} !text-xs !px-3 !py-1`}>
            {roleLabels[user.role] || 'Member'}
          </span>
          <span className={`${styles.statusBadge} ${statusStyles[user.status] || styles.statusActive} !text-xs !px-3 !py-1`}>
            {user.status || 'active'}
          </span>
        </div>

      </div>
    </div>
  );
}
