import { supabase } from '../lib/supabaseClient';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

async function getIdsBySearch(table, fields, search, idColumn = 'id') {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const { data, error } = await applySearchOr(
    supabase.from(table).select(idColumn),
    buildIlikeClauses(fields, term)
  );

  if (error) return [];
  return (data || []).map((item) => item[idColumn]).filter(Boolean);
}

async function buildPlanSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const departmentIds = await getIdsBySearch('departments', ['name', 'description', 'status'], term);

  return [
    ...buildIlikeClauses(['title', 'description', 'plan_type'], term),
    buildInClause('department_id', departmentIds),
  ].filter(Boolean);
}

export async function fetchPlans(filters = {}) {
  let query = supabase
    .from('department_plans')
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .order(filters.sortBy || 'created_at', { ascending: filters.sortDirection === 'asc' });

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  if (filters.plan_type) {
    query = query.eq('plan_type', filters.plan_type);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = applySearchOr(query, await buildPlanSearchClauses(filters.search));
  }

  const { data, error } = await query;
  return { data, error };
}

export async function fetchPlanById(id) {
  const { data, error } = await supabase
    .from('department_plans')
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createPlan(planData) {
  const { data, error } = await supabase
    .from('department_plans')
    .insert([planData])
    .select()
    .single();

  return { data, error };
}

export async function updatePlan(id, updates) {
  const { data, error } = await supabase
    .from('department_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deletePlan(id) {
  const { error } = await supabase
    .from('department_plans')
    .delete()
    .eq('id', id);

  return { error };
}
