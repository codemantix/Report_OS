import React from 'react';
import { format } from 'date-fns';

export default function TeamProfileDetails({ user }) {
  if (!user) return null;

  const joinDate = user.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy h:mm a') : 'N/A';
  const updateDate = user.updated_at ? format(new Date(user.updated_at), 'MMMM d, yyyy h:mm a') : 'N/A';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors duration-200">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">
          Profile Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.full_name || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Display Name</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.display_name || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.email}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.phone_number || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Job Title</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.job_title || 'No Title'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Department</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.departments?.name || 'No Department assigned'}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800/60 pt-6">
        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Biography</span>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-normal bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          {user.bio || 'This member has not written a biography yet.'}
        </p>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800/60 pt-6 flex flex-wrap gap-x-12 gap-y-4 text-xs text-gray-400 dark:text-gray-500">
        <div>
          <span className="font-semibold">Registered:</span> {joinDate}
        </div>
        <div>
          <span className="font-semibold">Last Modified:</span> {updateDate}
        </div>
      </div>
    </div>
  );
}
