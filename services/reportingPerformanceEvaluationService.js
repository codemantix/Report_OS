import { supabase } from '../lib/supabaseClient';

async function requestReportingPerformance(evaluationId, method) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication is required.') };
  }

  const query = method === 'GET'
    ? `?evaluationId=${encodeURIComponent(evaluationId)}`
    : '';

  try {
    const response = await fetch(`/api/evaluations/reporting-performance${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ evaluationId }) } : {}),
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Reporting Performance request failed.');
      error.code = payload.error?.code;
      return { data: null, error };
    }

    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchReportingPerformanceEvaluation(evaluationId) {
  return requestReportingPerformance(evaluationId, 'GET');
}

export function calculateReportingPerformanceEvaluation(evaluationId) {
  return requestReportingPerformance(evaluationId, 'POST');
}
