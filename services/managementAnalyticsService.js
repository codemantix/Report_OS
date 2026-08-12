import { supabase } from '../lib/supabaseClient';

export async function fetchManagementAnalytics(filters = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication is required.') };
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
    if (!response.ok) return { data: null, error: new Error(payload.error?.message || 'Management analytics request failed.') };
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
