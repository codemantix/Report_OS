import { format, formatDistanceToNow, isPast, isToday, isTomorrow, parseISO } from 'date-fns';

/**
 * Format a date string into a readable format.
 * @param {string} dateString - ISO date string
 * @param {string} formatStr - date-fns format string
 * @returns {string}
 */
export function formatDate(dateString, formatStr = 'MMM d, yyyy') {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date string with time.
 * @param {string} dateString
 * @returns {string}
 */
export function formatDateTime(dateString) {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
}

/**
 * Get a relative time string (e.g., "2 days ago").
 * @param {string} dateString
 * @returns {string}
 */
export function timeAgo(dateString) {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Check if a date is past due.
 * @param {string} dateString
 * @returns {boolean}
 */
export function isOverdue(dateString) {
  if (!dateString) return false;
  try {
    return isPast(parseISO(dateString));
  } catch {
    return false;
  }
}

/**
 * Format a date for input fields (YYYY-MM-DD).
 * @param {string} dateString
 * @returns {string}
 */
export function formatDateForInput(dateString) {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}
