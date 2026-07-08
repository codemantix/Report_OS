import { createServerClient } from '@supabase/ssr';
import { getAdminClient } from './supabaseAdmin';
import { supabase } from './supabaseClient';

/**
 * Retrieves the authenticated user profile from cookies or Authorization header in API routes.
 * @param {object} req - Next.js API request
 * @param {object} res - Next.js API response
 * @returns {Promise<object|null>} The user profile object or null if unauthenticated
 */
export async function getAuthenticatedUser(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase config missing in apiAuth');
    return null;
  }

  // 1. Try to get token from Authorization header first
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Try to get token from cookies if not in headers
  if (!token && req.cookies) {
    token = req.cookies['sb-access-token'] || req.cookies['access_token'];
  }

  try {
    let authUser = null;

    if (token) {
      // Authenticate token directly
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        authUser = user;
      }
    }

    // 3. Fallback to createServerClient if still no user
    if (!authUser) {
      const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return Object.keys(req.cookies).map((name) => ({
              name,
              value: req.cookies[name],
            }));
          },
          setAll(cookiesToSet) {
            try {
              const cookieStrings = cookiesToSet.map(({ name, value, options }) => {
                let str = `${name}=${encodeURIComponent(value)}`;
                if (options?.path) str += `; Path=${options.path}`;
                if (options?.maxAge) str += `; Max-Age=${options.maxAge}`;
                if (options?.domain) str += `; Domain=${options.domain}`;
                if (options?.secure) str += `; Secure`;
                if (options?.httpOnly) str += `; HttpOnly`;
                if (options?.sameSite) str += `; SameSite=${options.sameSite}`;
                return str;
              });
              res.setHeader('Set-Cookie', cookieStrings);
            } catch (error) {
              console.error('Failed to set cookies in API route:', error);
            }
          },
        },
      });

      const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
      if (!authError && user) {
        authUser = user;
      }
    }

    if (!authUser) {
      console.error('Auth verification failed: No valid token or session user.');
      return null;
    }

    // Fetch the full profile using the service role admin client
    const supabaseAdmin = getAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile in apiAuth:', profileError);
      return null;
    }

    return profile;
  } catch (err) {
    console.error('Exception in getAuthenticatedUser:', err);
    return null;
  }
}
