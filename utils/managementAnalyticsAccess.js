const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
}

function optionalUuid(value, label) {
  if (value && (typeof value !== 'string' || !UUID_PATTERN.test(value))) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
  return value || null;
}

export function scopeManagementAnalyticsFilters(filters, currentUser) {
  if (!currentUser || currentUser.status !== 'active') forbidden('An active account is required.');
  if (currentUser.role !== 'admin') {
    forbidden('Management analytics are available only to administrators.');
  }

  const scoped = {
    periodId: optionalUuid(filters.periodId, 'Evaluation period'),
    departmentId: optionalUuid(filters.departmentId, 'Department'),
    employeeId: optionalUuid(filters.employeeId, 'Employee'),
    performanceBand: filters.performanceBand || null,
  };
  if (scoped.performanceBand && (
    typeof scoped.performanceBand !== 'string' || scoped.performanceBand.length > 100
  )) {
    const error = new Error('Performance band is invalid.');
    error.statusCode = 400;
    throw error;
  }
  return scoped;
}
