import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    // Return a mock client for build-time / development without Supabase
    return {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }),
        order: () => ({ limit: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }),
        single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        gte: () => ({ order: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }),
      }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signOut: () => Promise.resolve({ error: null }),
        signInWithOtp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        verifyOtp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        updateUser: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      },
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const supabase = createSupabaseClient();
