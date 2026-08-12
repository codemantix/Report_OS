const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function utcDate(value) {
  if (!DATE_PATTERN.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function addUtcDays(value, days) {
  const date = utcDate(value);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function validateEvaluationPeriod(values, { requireEmployees = true } = {}) {
  const errors = {};
  const title = clean(values.title);
  const start = utcDate(values.start_date);
  const end = utcDate(values.end_date);
  const deadline = values.evaluation_deadline ? new Date(values.evaluation_deadline) : null;

  if (title.length < 3 || title.length > 120) {
    errors.title = 'Title must be between 3 and 120 characters.';
  }
  if (!values.department_id && (!values.department_ids || !Array.isArray(values.department_ids) || values.department_ids.length === 0)) {
    if (values.department_ids !== undefined) {
      errors.department_ids = 'Select at least one department.';
    } else {
      errors.department_id = 'Select a department.';
    }
  } else if (values.department_ids !== undefined && Array.isArray(values.department_ids)) {
    if (!values.department_ids.every((id) => isUuid(id))) errors.department_ids = 'Every department must be valid.';
  } else if (!isUuid(values.department_id)) {
    errors.department_id = 'Select a valid department.';
  }
  if (!start) errors.start_date = 'Enter a valid start date.';
  if (!end) errors.end_date = 'Enter a valid end date.';
  if (start && end) {
    const duration = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (duration !== 14) errors.end_date = 'A bi-weekly evaluation period must contain exactly 14 days.';
  }
  if (!deadline || Number.isNaN(deadline.getTime())) {
    errors.evaluation_deadline = 'Enter a valid evaluation deadline.';
  } else if (end && deadline.getTime() < end.getTime()) {
    errors.evaluation_deadline = 'The evaluation deadline cannot be before the period end date.';
  }

  const employeeIds = [...new Set((values.employee_ids || []).filter(Boolean))];
  if (requireEmployees && employeeIds.length === 0) {
    errors.employee_ids = 'Select at least one applicable employee.';
  } else if (employeeIds.some((id) => !isUuid(id))) {
    errors.employee_ids = 'Every applicable employee must have a valid identifier.';
  }

  return errors;
}

export function hasEvaluationPeriodErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function normalizeEvaluationPeriodPayload(values = {}) {
  const deadline = values.evaluation_deadline ? new Date(values.evaluation_deadline) : null;
  const employeeIds = Array.isArray(values.employee_ids) ? values.employee_ids : [];
  return {
    title: clean(values.title),
    department_id: typeof values.department_id === 'string' ? values.department_id : null,
    start_date: typeof values.start_date === 'string' ? values.start_date : null,
    end_date: typeof values.end_date === 'string' ? values.end_date : null,
    evaluation_deadline: deadline && !Number.isNaN(deadline.getTime())
      ? deadline.toISOString()
      : null,
    employee_ids: [...new Set(employeeIds.filter((id) => typeof id === 'string' && id))],
  };
}
