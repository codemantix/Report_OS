import { supabase } from '../lib/supabaseClient';

async function requestTaskPerformance(evaluationId, method) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication is required.') };
  }

  const query = method === 'GET'
    ? `?evaluationId=${encodeURIComponent(evaluationId)}`
    : '';

  try {
    const response = await fetch(`/api/evaluations/task-performance${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ evaluationId }) } : {}),
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Task Performance request failed.');
      error.code = payload.error?.code;
      return { data: null, error };
    }

    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchTaskPerformanceEvaluation(evaluationId) {
  return requestTaskPerformance(evaluationId, 'GET');
}

export function calculateTaskPerformanceEvaluation(evaluationId) {
  return requestTaskPerformance(evaluationId, 'POST');
}
