import React from 'react';
import { Eye } from 'lucide-react';

export default function TeamProfileReadOnlyNotice() {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-xl transition-colors duration-200">
      <Eye className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
        <strong>Read-Only Team Profile:</strong> You are viewing this team member profile review page. Administrative account actions (such as changing roles, departments, or active status) are restricted to system administrators.
      </p>
    </div>
  );
}
