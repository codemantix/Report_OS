import { supabase } from '../lib/supabaseClient';

async function authenticatedRequest(url, options = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) return { data: null, error: new Error('Authentication is required.') };
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      const requestError = new Error(payload.error?.message || 'Evaluation request failed.');
      requestError.code = payload.error?.code || null;
      requestError.fields = payload.error?.fields || null;
      return { data: null, error: requestError };
    }
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchEvaluationDashboard(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return authenticatedRequest(`/api/evaluations/dashboard?${params.toString()}`);
}

export function fetchEvaluationDetail(id) {
  return authenticatedRequest(`/api/evaluations/${encodeURIComponent(id)}`);
}

export function submitEvaluationReview(id, payload) {
  return authenticatedRequest(`/api/evaluations/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
