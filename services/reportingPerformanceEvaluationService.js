import { supabase } from '../lib/supabaseClient';
import { friendlyErrorMessage } from '../utils/friendlyErrors';

async function requestReportingPerformance(evaluationId, method) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Your session has expired. Please sign in again.') };
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
      const error = new Error(friendlyErrorMessage(payload.error, 'Reporting Performance request failed.'));
      error.code = payload.error?.code;
      return { data: null, error };
    }

    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error: new Error(friendlyErrorMessage(error, 'Reporting Performance request failed.')) };
  }
}

export function fetchReportingPerformanceEvaluation(evaluationId) {
  return requestReportingPerformance(evaluationId, 'GET');
}

export function calculateReportingPerformanceEvaluation(evaluationId) {
  return requestReportingPerformance(evaluationId, 'POST');
}
