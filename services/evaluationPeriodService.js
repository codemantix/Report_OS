import { supabase } from '../lib/supabaseClient';

async function requestEvaluationPeriods(method, { query = '', body } = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication is required.') };
  }

  try {
    const response = await fetch(`/api/evaluation-periods${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Evaluation period request failed.');
      error.code = payload.error?.code;
      error.fields = payload.error?.fields || null;
      return { data: null, error };
    }
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchManagedEvaluationPeriods(filters = {}) {
  const params = new URLSearchParams();
  if (filters.department_id) params.set('departmentId', filters.department_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', filters.page);
  if (filters.pageSize) params.set('pageSize', filters.pageSize);
  const query = params.toString() ? `?${params.toString()}` : '';
  return requestEvaluationPeriods('GET', { query });
}

export function createManagedEvaluationPeriod(values) {
  return requestEvaluationPeriods('POST', { body: values });
}

export function updateManagedEvaluationPeriod(id, values) {
  return requestEvaluationPeriods('PUT', { body: { ...values, id } });
}

export function transitionManagedEvaluationPeriod(id, status) {
  return requestEvaluationPeriods('PATCH', { body: { id, status } });
}
