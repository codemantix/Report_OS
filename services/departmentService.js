import { supabase } from '../lib/supabaseClient';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

async function getUserIdsBySearch(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const { data, error } = await applySearchOr(
    supabase.from('users').select('id'),
    buildIlikeClauses(['full_name', 'display_name', 'email', 'job_title', 'role', 'status'], term)
  );

  if (error) return [];
  return (data || []).map((user) => user.id).filter(Boolean);
}

async function buildDepartmentSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];
  const leadIds = await getUserIdsBySearch(term);

  return [
    ...buildIlikeClauses(['name', 'description', 'status'], term),
    buildInClause('lead_user_id', leadIds),
  ].filter(Boolean);
}

export async function fetchDepartments(filters = {}) {
  let query = supabase
    .from('departments')
    .select(`
      *,
      lead:lead_user_id (id, full_name, display_name, email, avatar_url, job_title)
    `)
    .order(filters.sortBy || 'name', { ascending: filters.sortDirection !== 'desc' });

  if (filters.department_id) {
    query = query.eq('id', filters.department_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = applySearchOr(query, await buildDepartmentSearchClauses(filters.search));
  }

  const { data, error } = await query;

  return { data, error };
}

export async function fetchDepartmentById(id) {
  const { data, error } = await supabase
    .from('departments')
    .select(`
      *,
      lead:lead_user_id (id, full_name, display_name, email, avatar_url, job_title)
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

async function syncDepartmentLeadMembership(departmentId, leadUserId) {
  if (!departmentId || !leadUserId) return { error: null };

  const { error } = await supabase
    .from('users')
    .update({
      department_id: departmentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadUserId);

  return { error };
}

export async function createDepartment(deptData) {
  const { data, error } = await supabase
    .from('departments')
    .insert([deptData])
    .select()
    .single();

  if (error || !data) return { data, error };

  const { error: syncError } = await syncDepartmentLeadMembership(data.id, data.lead_user_id);

  return { data, error: null, syncError: syncError || null };
}

export async function updateDepartment(id, updates) {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { data, error };

  const leadUserId = Object.prototype.hasOwnProperty.call(updates, 'lead_user_id')
    ? updates.lead_user_id
    : data.lead_user_id;

  const { error: syncError } = await syncDepartmentLeadMembership(id, leadUserId);

  return { data, error: null, syncError: syncError || null };
}

export async function deleteDepartment(id) {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  return { error };
}
