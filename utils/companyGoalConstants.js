/**
 * Shared constants for the Company Monthly Goals module.
 */

export const COMPANY_GOAL_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const COMPANY_GOAL_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'archived', label: 'Archived' },
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: i + 1,
  label: name,
}));

export const PRIORITY_COLORS = {
  low: 'text-gray-700 bg-gray-100',
  medium: 'text-amber-700 bg-amber-100',
  high: 'text-red-700 bg-red-100',
  urgent: 'text-purple-700 bg-purple-100',
};

export const STATUS_COLORS = {
  draft: 'text-gray-600 bg-gray-100',
  active: 'text-blue-700 bg-blue-100',
  in_progress: 'text-indigo-700 bg-indigo-100',
  completed: 'text-green-700 bg-green-100',
  delayed: 'text-red-700 bg-red-100',
  blocked: 'text-orange-700 bg-orange-100',
  archived: 'text-gray-500 bg-gray-100',
};

/**
 * Format month + year as display string.
 * @param {number} month - 1-12
 * @param {number} year
 * @returns {string} e.g. "July 2026"
 */
export function formatMonthYear(month, year) {
  if (!month || !year) return '';
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
