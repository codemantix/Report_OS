import { supabase } from '../lib/supabaseClient';
import { friendlyErrorMessage } from '../utils/friendlyErrors';

export async function fetchManagementAnalytics(filters = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Your session has expired. Please sign in again.') };
  }

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });

  try {
    const response = await fetch(`/api/management-analytics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json();
    if (!response.ok) return { data: null, error: new Error(friendlyErrorMessage(payload.error, 'Management analytics request failed.')) };
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error: new Error(friendlyErrorMessage(error, 'Management analytics request failed.')) };
  }
}
