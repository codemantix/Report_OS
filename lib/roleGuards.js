import { supabase } from './supabaseClient';

export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data?.role;
}

export async function requireRole(context, allowedRoles) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!user || !allowedRoles.includes(user.role)) {
    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
      user,
    },
  };
}

export function isAdmin(role) {
  return role === 'admin';
}

export function isDepartmentLead(role) {
  return role === 'department_lead' || role === 'admin';
}

export function canManageDepartments(role) {
  return role === 'admin';
}

export function canManageGoals(role) {
  return role === 'admin' || role === 'department_lead';
}

export function canManagePlans(role) {
  return role === 'admin' || role === 'department_lead';
}

export function canReviewReports(role) {
  return role === 'admin' || role === 'department_lead';
}

export function canManageCompanyGoals(role) {
  return role === 'admin';
}
