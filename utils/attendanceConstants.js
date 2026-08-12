export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
];

export const ATTENDANCE_TYPE_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'work_session', label: 'Work Session' },
  { value: 'training', label: 'Training' },
  { value: 'company_event', label: 'Company Event' },
  { value: 'other', label: 'Other' },
];

export const ATTENDANCE_STATUS_LABELS = Object.fromEntries(
  ATTENDANCE_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

export const ATTENDANCE_TYPE_LABELS = Object.fromEntries(
  ATTENDANCE_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export function canManageAttendance(role) {
  return role === 'admin' || role === 'department_lead';
}
