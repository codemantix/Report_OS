export const ATTENDANCE_PERFORMANCE_FORMULA_VERSION = 'attendance-performance-v1';

export const DEFAULT_ATTENDANCE_SCORING_RULES = Object.freeze({
  present: 100,
  late: 75,
  absent: 0,
  excused: 100,
});

const INCLUDED_REVIEW_STATUSES = new Set(['confirmed', 'corrected']);
const STATUS_ALIASES = Object.freeze({
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'excused',
  approved_leave: 'excused',
  half_day: 'late',
});
const NON_APPLICABLE_STATUSES = new Set(['holiday', 'weekend']);


function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function dateKey(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeRules(rules = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_ATTENDANCE_SCORING_RULES).map(([status, fallback]) => {
      const numeric = Number(rules[status] ?? fallback);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        throw new Error(`Attendance score for ${status} must be between 0 and 100.`);
      }
      return [status, numeric];
    })
  );
}

function exclusionReason(record, period) {
  const attendanceDate = dateKey(record.attendance_date);
  if (!attendanceDate || attendanceDate < period.start_date || attendanceDate > period.end_date) {
    return 'outside_evaluation_period';
  }
  if (!INCLUDED_REVIEW_STATUSES.has(record.review_status)) {
    return `review_status_${record.review_status || 'unknown'}`;
  }
  if (NON_APPLICABLE_STATUSES.has(record.attendance_status)) {
    return `non_applicable_${record.attendance_status}`;
  }
  if (!STATUS_ALIASES[record.attendance_status]) {
    return `unsupported_status_${record.attendance_status || 'unknown'}`;
  }
  return null;
}

export function calculateAttendancePerformance(records, period, configuredRules = {}) {
  if (!period?.start_date || !period?.end_date) {
    throw new Error('A valid evaluation period is required for Attendance Performance.');
  }

  const rules = normalizeRules(configuredRules);
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  const sourceStatusCounts = {};
  const excludedByReason = {};
  const applicableRecords = [];

  (records || []).forEach((record) => {
    const reason = exclusionReason(record, period);
    if (reason) {
      excludedByReason[reason] = (excludedByReason[reason] || 0) + 1;
      return;
    }

    const normalizedStatus = STATUS_ALIASES[record.attendance_status];
    counts[normalizedStatus] += 1;
    sourceStatusCounts[record.attendance_status] = (
      sourceStatusCounts[record.attendance_status] || 0
    ) + 1;
    applicableRecords.push({
      id: record.id,
      attendanceDate: record.attendance_date,
      meetingSession: record.meeting_session,
      attendanceType: record.attendance_type,
      sourceStatus: record.attendance_status,
      normalizedStatus,
      reviewStatus: record.review_status,
      awardedScore: rules[normalizedStatus],
    });
  });

  const totalApplicableSessions = applicableRecords.length;
  const totalAwardedPoints = applicableRecords.reduce(
    (sum, record) => sum + record.awardedScore,
    0
  );
  const score = totalApplicableSessions > 0
    ? round(totalAwardedPoints / totalApplicableSessions)
    : null;

  return {
    formulaVersion: ATTENDANCE_PERFORMANCE_FORMULA_VERSION,
    score,
    scoringStatus: score === null ? 'insufficient_data' : 'scored',
    totalApplicableSessions,
    present: counts.present,
    late: counts.late,
    absent: counts.absent,
    excused: counts.excused,
    totalRecordedSessions: (records || []).length,
    excludedSessions: (records || []).length - totalApplicableSessions,
    excludedByReason,
    sourceStatusCounts,
    scoringRules: rules,
    calculation: score === null
      ? null
      : {
        totalAwardedPoints: round(totalAwardedPoints),
        denominator: totalApplicableSessions,
        expression: 'sum(session status scores) / total applicable sessions',
      },
    applicableRecords,
    noDataReason: score === null
      ? 'No confirmed or corrected applicable attendance sessions exist in this evaluation period.'
      : null,
    safeguards: {
      missingAttendanceProducesZero: false,
      missingAttendanceProducesPerfectScore: false,
      pendingOrDisputedRecordsIncluded: false,
      excusedUsesAbsentScore: rules.excused === rules.absent,
    },
  };
}
