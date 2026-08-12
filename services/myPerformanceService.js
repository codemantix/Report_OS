import { supabase } from '../lib/supabaseClient';
import { friendlyErrorMessage } from '../utils/friendlyErrors';

export async function fetchMyPerformance(evaluationId = null) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) return { data: null, error: new Error('Your session has expired. Please sign in again.') };
  const params = new URLSearchParams();
  if (evaluationId) params.set('evaluationId', evaluationId);
  try {
    const response = await fetch(`/api/my-performance?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) return { data: null, error: new Error(friendlyErrorMessage(payload.error, 'Performance request failed.')) };
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error: new Error(friendlyErrorMessage(error, 'Performance request failed.')) };
  }
}
