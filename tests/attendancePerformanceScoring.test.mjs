import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scoringSource = fs.readFileSync(
  new URL('../utils/attendancePerformanceScoring.js', import.meta.url),
  'utf8'
);
const scoringModule = await import(
  `data:text/javascript;base64,${Buffer.from(scoringSource).toString('base64')}`
);
const { calculateAttendancePerformance } = scoringModule;

const PERIOD = { start_date: '2026-08-03', end_date: '2026-08-16' };

function attendance(status, overrides = {}) {
  return {
    id: overrides.id || `attendance-${status}`,
    attendance_date: '2026-08-05',
    attendance_status: status,
    review_status: 'confirmed',
    meeting_session: 'Weekly sync',
    attendance_type: 'meeting',
    ...overrides,
  };
}

test('scores Present Late Absent and Excused transparently with default rules', () => {
  const result = calculateAttendancePerformance([
    attendance('present'),
    attendance('late'),
    attendance('absent'),
    attendance('excused'),
  ], PERIOD);

  assert.equal(result.totalApplicableSessions, 4);
  assert.equal(result.present, 1);
  assert.equal(result.late, 1);
  assert.equal(result.absent, 1);
  assert.equal(result.excused, 1);
  assert.equal(result.score, 68.75);
  assert.equal(result.calculation.totalAwardedPoints, 275);
});

test('excused absence is not penalized like unexplained absence', () => {
  const excused = calculateAttendancePerformance([attendance('excused')], PERIOD);
  const absent = calculateAttendancePerformance([attendance('absent')], PERIOD);

  assert.equal(excused.score, 100);
  assert.equal(absent.score, 0);
  assert.notEqual(excused.scoringRules.excused, excused.scoringRules.absent);
});

test('uses configured attendance status scores', () => {
  const result = calculateAttendancePerformance([
    attendance('present'),
    attendance('late'),
    attendance('absent'),
    attendance('excused'),
  ], PERIOD, { present: 95, late: 60, absent: 10, excused: 80 });

  assert.equal(result.score, 61.25);
  assert.deepEqual(result.scoringRules, {
    present: 95,
    late: 60,
    absent: 10,
    excused: 80,
  });
});

test('invalid configured attendance status scores fail instead of silently becoming zero', () => {
  assert.throws(
    () => calculateAttendancePerformance([attendance('present')], PERIOD, { present: 'invalid' }),
    /present must be between 0 and 100/i
  );
  assert.throws(
    () => calculateAttendancePerformance([attendance('late')], PERIOD, { late: 101 }),
    /late must be between 0 and 100/i
  );
});

test('no applicable sessions returns null instead of a misleading score', () => {
  const result = calculateAttendancePerformance([], PERIOD);

  assert.equal(result.score, null);
  assert.equal(result.scoringStatus, 'insufficient_data');
  assert.equal(result.totalApplicableSessions, 0);
  assert.equal(result.calculation, null);
  assert.equal(result.safeguards.missingAttendanceProducesZero, false);
});

test('pending disputed holiday and weekend records are excluded and explained', () => {
  const result = calculateAttendancePerformance([
    attendance('present', { review_status: 'pending' }),
    attendance('absent', { review_status: 'disputed' }),
    attendance('holiday'),
    attendance('weekend'),
    attendance('present', { id: 'included-present', review_status: 'corrected' }),
  ], PERIOD);

  assert.equal(result.totalRecordedSessions, 5);
  assert.equal(result.totalApplicableSessions, 1);
  assert.equal(result.score, 100);
  assert.equal(result.excludedSessions, 4);
  assert.equal(result.excludedByReason.review_status_pending, 1);
  assert.equal(result.excludedByReason.review_status_disputed, 1);
  assert.equal(result.excludedByReason.non_applicable_holiday, 1);
  assert.equal(result.excludedByReason.non_applicable_weekend, 1);
});

test('legacy approved leave and half-day statuses map transparently into the four-category breakdown', () => {
  const result = calculateAttendancePerformance([
    attendance('approved_leave'),
    attendance('half_day'),
  ], PERIOD);

  assert.equal(result.excused, 1);
  assert.equal(result.late, 1);
  assert.equal(result.sourceStatusCounts.approved_leave, 1);
  assert.equal(result.sourceStatusCounts.half_day, 1);
  assert.equal(result.score, 87.5);
});
