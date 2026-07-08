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

async function buildGoalSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const departmentIds = await getIdsBySearch('departments', ['name', 'description', 'status'], term);

  return [
    ...buildIlikeClauses(['title', 'description', 'success_metric', 'expected_deliverables', 'priority', 'status'], term),
    buildInClause('department_id', departmentIds),
  ].filter(Boolean);
}

export async function fetchGoals(filters = {}) {
  let query = supabase
    .from('goals')
    .select(`
      *,
      departments:department_id (id, name),
      company_goals:company_goal_id (id, title, month, year),
      goal_assignees (
        users:user_id (id, full_name, display_name, email, avatar_url, job_title)
      )
    `)
    .order(filters.sortBy || 'created_at', { ascending: filters.sortDirection === 'asc' });

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.company_goal_id) {
    query = query.eq('company_goal_id', filters.company_goal_id);
  }

  if (filters.year) {
    const year = parseInt(filters.year, 10);
    if (filters.month) {
      const month = parseInt(filters.month, 10);
      const monthStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      query = query.gte('due_date', `${year}-${monthStr}-01T00:00:00Z`)
                   .lte('due_date', `${year}-${monthStr}-${lastDay}T23:59:59Z`);
    } else {
      query = query.gte('due_date', `${year}-01-01T00:00:00Z`)
                   .lte('due_date', `${year}-12-31T23:59:59Z`);
    }
  } else if (filters.month) {
    // If only month is selected, default to current year
    const year = new Date().getFullYear();
    const month = parseInt(filters.month, 10);
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    query = query.gte('due_date', `${year}-${monthStr}-01T00:00:00Z`)
                 .lte('due_date', `${year}-${monthStr}-${lastDay}T23:59:59Z`);
  }

  if (filters.search) {
    query = applySearchOr(query, await buildGoalSearchClauses(filters.search));
  }

  const { data, error } = await query;
  return { data, error };
}

export async function fetchGoalById(id) {
  const { data, error } = await supabase
    .from('goals')
    .select(`
      *,
      departments:department_id (id, name),
      company_goals:company_goal_id (id, title, month, year),
      goal_assignees (
        users:user_id (id, full_name, display_name, email, avatar_url, job_title)
      )
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

async function syncGoalAssignees(goalId, assigneeIds = []) {
  const uniqueAssigneeIds = [...new Set((assigneeIds || []).filter(Boolean))];

  const { data: existingRows, error: fetchError } = await supabase
    .from('goal_assignees')
    .select('user_id')
    .eq('goal_id', goalId);

  if (fetchError) return { error: fetchError };

  const existingIds = new Set((existingRows || []).map((row) => row.user_id).filter(Boolean));
  const desiredIds = new Set(uniqueAssigneeIds);
  const removedIds = [...existingIds].filter((userId) => !desiredIds.has(userId));

  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('goal_assignees')
      .delete()
      .eq('goal_id', goalId)
      .in('user_id', removedIds);

    if (deleteError) return { error: deleteError };
  }

  if (uniqueAssigneeIds.length === 0) return { error: null };

  const rows = uniqueAssigneeIds.map((userId) => ({
    goal_id: goalId,
    user_id: userId,
  }));

  const { error: upsertError } = await supabase
    .from('goal_assignees')
    .upsert(rows, { onConflict: 'goal_id,user_id', ignoreDuplicates: true });

  return { error: upsertError };
}

export async function createGoal(goalData) {
  const { assignee_ids = [], ...goalPayload } = goalData;

  const { data, error } = await supabase
    .from('goals')
    .insert([goalPayload])
    .select()
    .single();

  if (error || !data) return { data, error };

  const { error: assigneeError } = await syncGoalAssignees(data.id, assignee_ids);

  return { data, error: assigneeError || null };
}

export async function updateGoal(id, updates) {
  const { assignee_ids, ...goalPayload } = updates;

  const { data, error } = await supabase
    .from('goals')
    .update(goalPayload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { data, error };

  if (Array.isArray(assignee_ids)) {
    const { error: assigneeError } = await syncGoalAssignees(id, assignee_ids);
    return { data, error: assigneeError || null };
  }

  return { data, error: null };
}

export async function deleteGoal(id) {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  return { error };
}

export async function assignGoal(goalId, userId) {
  const { data, error } = await supabase
    .from('goal_assignees')
    .upsert([{ goal_id: goalId, user_id: userId }], {
      onConflict: 'goal_id,user_id',
      ignoreDuplicates: true,
    })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function removeGoalAssignment(id) {
  const { error } = await supabase
    .from('goal_assignees')
    .delete()
    .eq('id', id);

  return { error };
}

export async function fetchGoalsByUserId(userId) {
  const { data, error } = await supabase
    .from('goal_assignees')
    .select(`
      *,
      goals (
        *,
        departments:department_id (id, name)
      )
    `)
    .eq('user_id', userId);

  return { data, error };
}
