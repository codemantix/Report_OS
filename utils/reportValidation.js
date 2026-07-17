const REQUIRED_TEXT_FIELDS = [
  ['project_name', 'Report title is required']
  ['worked_on', 'Please describe what you worked on'],
  ['completed_tasks', 'Please list completed tasks'],
  ['pending_tasks', 'Please list pending tasks or enter “None”'],
  ['blockers', 'Please describe blockers or enter “None”'],
  ['support_needed', 'Please describe support needed or enter “None”'],
  ['additional_notes', 'Please add notes or enter “None”'],
];

const REQUIRED_RELATIONSHIP_FIELDS = [
  ['department_id', 'Department is required'],
  ['company_goal_id', 'Related company goal is required'],
];



export function validateEditableReportFields(values = {}) {
  const errors = {};

  if (!String(values.report_type || '').trim()) {
    errors.report_type = 'Report type is required';
  }

  REQUIRED_TEXT_FIELDS.forEach(([field, message]) => {
    if (!String(values[field] || '').trim()) errors[field] = message;
  });

  if (values.hours_worked === '' || values.hours_worked === null || values.hours_worked === undefined) {
    errors.hours_worked = 'Hours worked is required';
  } else {
    const hours = Number(values.hours_worked);
    if (!Number.isFinite(hours) || hours < 0) {
      errors.hours_worked = 'Hours must be a valid positive number';
    }
  }

  if (values.completion_percentage === '' || values.completion_percentage === null || values.completion_percentage === undefined) {
    errors.completion_percentage = 'Completion percentage is required';
  } else {
    const percentage = Number(values.completion_percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      errors.completion_percentage = 'Percentage must be between 0 and 100';
    }
  }

  return errors;
}

export function validateReportSubmission(values = {}) {
  const errors = validateEditableReportFields(values);

  REQUIRED_RELATIONSHIP_FIELDS.forEach(([field, message]) => {
    if (!String(values[field] || '').trim()) errors[field] = message;
  });

  if (!values.period_start) {
    errors.period_start = 'Period start date is required';
  }
  if (!values.period_end) {
    errors.period_end = 'Period end date is required';
  }
  if (values.period_start && values.period_end && values.period_end < values.period_start) {
    errors.period_end = 'Period end date cannot be before the start date';
  }

  return errors;
}

export function hasReportValidationErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}
