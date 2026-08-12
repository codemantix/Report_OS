import { supabase } from '../lib/supabaseClient';
import {
  hasAttendanceErrors,
  normalizeAttendancePayload,
  validateAttendanceRecord,
} from '../utils/attendanceValidation';
import { friendlyErrorMessage } from '../utils/friendlyErrors';

function translateError(error, fallback = 'Attendance request failed.') {
  if (!error) return error;
  const friendly = new Error(friendlyErrorMessage(error, fallback));
  if (error.code) friendly.code = error.code;
  return friendly;
}

function translateResult(result, fallback) {
  return { ...result, error: result.error ? translateError(result.error, fallback) : null };
}

const ATTENDANCE_SELECT = `
  id,
  employee_id,
  department_id,
  evaluation_period_id,
  attendance_date,
  meeting_session,
  attendance_type,
  attendance_status,
  review_status,
  notes,
  recorded_by,
  recorded_at,
  created_at,
  updated_at,
  employee:employee_id (id, full_name, display_name, email, avatar_url, job_title),
  department:department_id (id, name),
  recorder:recorded_by (id, full_name, display_name, email),
  evaluation_period:evaluation_period_id (id, name, start_date, end_date, status)
`;

function validationError(fields) {
  const error = new Error('Please correct the highlighted attendance fields.');
  error.code = 'ATTENDANCE_VALIDATION_ERROR';
  error.fields = fields;
  return error;
}

export async function fetchAttendanceRecords(filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('attendance_records')
    .select(ATTENDANCE_SELECT, { count: 'exact' })
    .order('attendance_date', { ascending: false })
    .order('recorded_at', { ascending: false })
    .range(from, to);

  if (filters.employee_id) query = query.eq('employee_id', filters.employee_id);
  if (filters.department_id) query = query.eq('department_id', filters.department_id);
  if (filters.attendance_status) query = query.eq('attendance_status', filters.attendance_status);
  if (filters.attendance_type) query = query.eq('attendance_type', filters.attendance_type);
  if (filters.evaluation_period_id) query = query.eq('evaluation_period_id', filters.evaluation_period_id);
  if (filters.date_from) query = query.gte('attendance_date', filters.date_from);
  if (filters.date_to) query = query.lte('attendance_date', filters.date_to);

  const { data, error, count } = await query;
  return translateResult({ data: data || [], error, count: count || 0, page, pageSize }, 'Attendance records could not be loaded.');
}

export async function fetchAttendanceEmployees(departmentId) {
  let query = supabase
    .from('users')
    .select('id, full_name, display_name, email, avatar_url, job_title, department_id')
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error } = await query;
  return translateResult({ data: data || [], error }, 'Attendance employees could not be loaded.');
}

export async function fetchAttendanceEvaluationPeriods(departmentId) {
  let query = supabase
    .from('evaluation_periods')
    .select('id, name, department_id, start_date, end_date, status')
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false });

  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error } = await query;
  return translateResult({ data: data || [], error }, 'Evaluation periods could not be loaded.');
}

export async function createAttendanceRecord(record, currentUserId) {
  const payload = normalizeAttendancePayload(record);
  const fields = validateAttendanceRecord(payload);
  if (hasAttendanceErrors(fields)) return { data: null, error: validationError(fields) };

  const { data, error } = await supabase
    .from('attendance_records')
    .insert([{
      ...payload,
      recorded_by: currentUserId,
      recorded_at: new Date().toISOString(),
      review_status: 'confirmed',
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
      source: 'manual',
    }])
    .select(ATTENDANCE_SELECT)
    .single();

  return translateResult({ data, error }, 'Attendance record could not be created.');
}

export async function updateAttendanceRecord(id, record) {
  const payload = normalizeAttendancePayload(record);
  const fields = validateAttendanceRecord(payload);
  if (hasAttendanceErrors(fields)) return { data: null, error: validationError(fields) };

  const updates = {
    meeting_session: payload.meeting_session,
    attendance_type: payload.attendance_type,
    attendance_status: payload.attendance_status,
    notes: payload.notes,
    evaluation_period_id: payload.evaluation_period_id,
  };

  const { data, error } = await supabase
    .from('attendance_records')
    .update(updates)
    .eq('id', id)
    .select(ATTENDANCE_SELECT)
    .single();

  return translateResult({ data, error }, 'Attendance record could not be updated.');
}
