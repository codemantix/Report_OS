import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from 'date-fns';

/**
 * Compute a default reporting-period date range based on report type.
 * Returns { start, end } as YYYY-MM-DD strings.
 *
 * | Type              | Default Period                       |
 * |-------------------|--------------------------------------|
 * | daily             | Today                                |
 * | weekly            | Monday → Sunday of the current week  |
 * | project           | Start → end of current month         |
 * | task_completion   | Last 7 days                          |
 * | blocker           | Last 7 days                          |
 */
export function getDefaultDateRange(reportType) {
  const today = new Date();
  const fmt = (d) => format(d, 'yyyy-MM-dd');

  switch (reportType) {
    case 'daily':
      return { start: fmt(startOfDay(today)), end: fmt(endOfDay(today)) };

    case 'weekly':
      return {
        start: fmt(startOfWeek(today, { weekStartsOn: 1 })),
        end: fmt(endOfWeek(today, { weekStartsOn: 1 })),
      };

    case 'project':
      return {
        start: fmt(startOfMonth(today)),
        end: fmt(endOfMonth(today)),
      };

    case 'task_completion':
    case 'blocker':
      return {
        start: fmt(subDays(today, 7)),
        end: fmt(today),
      };

    default:
      return {
        start: fmt(startOfWeek(today, { weekStartsOn: 1 })),
        end: fmt(endOfWeek(today, { weekStartsOn: 1 })),
      };
  }
}

/**
 * Format a period range into a human-readable label.
 * e.g. "Jul 7 – Jul 13, 2026"
 */
export function formatPeriodLabel(startStr, endStr) {
  if (!startStr || !endStr) return '';

  try {
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const sameDay = startStr === endStr;

    if (sameDay) {
      return format(start, 'MMM d, yyyy');
    }

    if (sameMonth) {
      return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
    }

    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear) {
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }

    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
  } catch {
    return '';
  }
}

/**
 * Check if a record's date range overlaps with the given period.
 * Used for goals (start_date / due_date) and plans (start_date / end_date).
 *
 * A record overlaps the period if:
 *   record.start <= period.end  AND  record.end >= period.start
 *
 * If the record has no dates, it is included (not filtered out).
 */
export function isInPeriod(recordStart, recordEnd, periodStart, periodEnd) {
  // If no period is set, include everything
  if (!periodStart || !periodEnd) return true;

  // If the record has no dates at all, include it
  if (!recordStart && !recordEnd) return true;

  const pStart = new Date(periodStart + 'T00:00:00');
  const pEnd = new Date(periodEnd + 'T23:59:59');

  // If only record start exists, check it falls within period
  if (recordStart && !recordEnd) {
    const rStart = new Date(recordStart);
    return rStart <= pEnd;
  }

  // If only record end exists, check it falls within period
  if (!recordStart && recordEnd) {
    const rEnd = new Date(recordEnd);
    return rEnd >= pStart;
  }

  // Both exist — check overlap
  const rStart = new Date(recordStart);
  const rEnd = new Date(recordEnd);
  return rStart <= pEnd && rEnd >= pStart;
}

/**
 * Check if a single date (e.g. task due_date) falls within the period.
 * If the date is null, the record is included.
 */
export function isDateInPeriod(dateStr, periodStart, periodEnd) {
  if (!periodStart || !periodEnd) return true;
  if (!dateStr) return true;

  const date = new Date(dateStr);
  const pStart = new Date(periodStart + 'T00:00:00');
  const pEnd = new Date(periodEnd + 'T23:59:59');

  return date >= pStart && date <= pEnd;
}
