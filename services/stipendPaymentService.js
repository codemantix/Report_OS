import { supabase } from '../lib/supabaseClient';
import { friendlyErrorMessage } from '../utils/friendlyErrors';

async function paymentRequest(url, options = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) return { data: null, error: new Error('Your session has expired. Please sign in again.') };
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(friendlyErrorMessage(payload.error, 'Payment tracking request failed.'));
      error.code = payload.error?.code || null;
      return { data: null, error };
    }
    return { data: payload.data, error: null };
  } catch (error) {
    return { data: null, error: new Error(friendlyErrorMessage(error, 'Payment tracking request failed.')) };
  }
}

export function fetchStipendPayments(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return paymentRequest(`/api/stipend-payments?${params.toString()}`);
}

export function submitPaymentTrackingAction(payload) {
  return paymentRequest('/api/stipend-payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
