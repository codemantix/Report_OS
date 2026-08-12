import { supabase } from '../lib/supabaseClient';

async function auditRequest(url) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication is required.') };
  }
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Audit history request failed.');
      error.code = payload.error?.code || null;
      return { data: null, error };
    }
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function fetchAuditHistory(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return auditRequest(`/api/audit?${params.toString()}`);
}
