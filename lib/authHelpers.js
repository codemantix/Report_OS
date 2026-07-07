import { supabase } from './supabaseClient';

/**
 * Get the currently authenticated Supabase user.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session.user;
}

/**
 * Get the full user profile from the users table.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Send an OTP code to the user's email for password reset.
 * Uses our own API route to bypass Supabase's broken /auth/v1/otp endpoint.
 * @param {string} email
 * @returns {Promise<{data, error}>}
 */
export async function sendOtp(email) {
  try {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { data: null, error: new Error(payload.error || 'Failed to send code.') };
    }
    return { data: payload, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Verify an OTP code.
 * If a newPassword is provided, this also updates the password.
 * @param {string} email
 * @param {string} otp
 * @param {string} [newPassword]
 * @returns {Promise<{data, error}>}
 */
export async function verifyOtp(email, otp, newPassword) {
  try {
    const body = { email, otp };
    if (newPassword) body.password = newPassword;

    const response = await fetch('/api/auth/verify-reset-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { data: null, error: new Error(payload.error || 'Verification failed.') };
    }
    return { data: payload, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Update the user's password after OTP verification.
 * @param {string} newPassword
 * @returns {Promise<{data, error}>}
 */
export async function updatePassword(newPassword) {
  // We don't call verifyOtp here because the ForgotPasswordForm
  // already has the email and otp from the previous step.
  // This function is kept for backwards compatibility —
  // the form now uses verifyOtp(email, otp, newPassword) directly.
  return { data: null, error: new Error('Use verifyOtp(email, otp, password) instead.') };
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data, error}>}
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Sign up a new user with email and password.
 * Automatically creates a profile in the users table.
 * @param {string} email
 * @param {string} password
 * @param {object} userData - { full_name }
 * @returns {Promise<{data, error}>}
 */
export async function signUpWithEmail(email, password, userData) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        full_name: userData.full_name,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: new Error(payload.error || 'Unable to create account.'),
      };
    }

    return { data: payload, error: null };
  } catch (error) {
    return {
      data: null,
      error: new Error(error.message || 'Unable to connect to the registration service.'),
    };
  }
}

/**
 * Sign out the current user.
 * @returns {Promise<{error}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Server-side guard: redirect to login if no session.
 * @param {object} context
 * @returns {Promise<{props}|{redirect}>}
 */
export async function requireAuth(context) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
}

/**
 * Determine the redirect destination based on user role.
 * @param {string} role
 * @returns {string}
 */
export function getDashboardUrl(role) {
  return '/dashboard';
}

/**
 * Check if the current user has one of the allowed roles.
 * @param {string} userId
 * @param {string[]} allowedRoles
 * @returns {Promise<boolean>}
 */
export async function userHasRole(userId, allowedRoles) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return allowedRoles.includes(data.role);
}
