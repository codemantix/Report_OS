import { ATTENDANCE_STATUS_OPTIONS, ATTENDANCE_TYPE_OPTIONS } from './attendanceConstants';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(ATTENDANCE_STATUS_OPTIONS.map(({ value }) => value));
const VALID_TYPES = new Set(ATTENDANCE_TYPE_OPTIONS.map(({ value }) => value));

export function validateAttendanceRecord(record = {}) {
  const errors = {};
  const meetingSession = record.meeting_session?.trim() || '';
  const notes = record.notes?.trim() || '';

  if (!record.attendance_date || !DATE_PATTERN.test(record.attendance_date)) {
    errors.attendance_date = 'Select a valid attendance date.';
  }

  if (!meetingSession) {
    errors.meeting_session = 'Enter the meeting or session name.';
  } else if (meetingSession.length > 150) {
    errors.meeting_session = 'Meeting or session must be 150 characters or fewer.';
  }

  if (!VALID_TYPES.has(record.attendance_type)) {
    errors.attendance_type = 'Select a valid attendance type.';
  }

  if (!record.employee_id) {
    errors.employee_id = 'Select an employee.';
  }

  if (!record.department_id) {
    errors.department_id = 'Select a department.';
  }

  if (!VALID_STATUSES.has(record.attendance_status)) {
    errors.attendance_status = 'Select a valid attendance status.';
  }

  if (notes.length > 2000) {
    errors.notes = 'Notes must be 2,000 characters or fewer.';
  }

  return errors;
}

export function hasAttendanceErrors(errors = {}) {
  return Object.keys(errors).length > 0;
}

export function normalizeAttendancePayload(record = {}) {
  return {
    attendance_date: record.attendance_date,
    meeting_session: record.meeting_session?.trim(),
    attendance_type: record.attendance_type,
    employee_id: record.employee_id,
    department_id: record.department_id,
    attendance_status: record.attendance_status,
    notes: record.notes?.trim() || null,
    evaluation_period_id: record.evaluation_period_id || null,
  };
}
