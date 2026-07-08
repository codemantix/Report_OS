import { supabase } from '../lib/supabaseClient';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

export async function fetchReports(filters = {}) {
  let query = supabase
    .from('reports')
    .select(`
      *,
      users:user_id (id, full_name, display_name, email, avatar_url, job_title),
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title),
      company_goals:company_goal_id (id, title, month, year),
      report_ai_analysis (*)
    `)
    .order(filters.sortBy || 'submitted_at', { ascending: filters.sortDirection === 'asc' });

  query = await applyFilters(query, filters);

  const { data, error } = await query;

  return { data, error };
}

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

async function buildReportSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const clauses = buildIlikeClauses([
    'project_name',
    'report_type',
    'worked_on',
    'completed_tasks',
    'pending_tasks',
    'blockers',
    'support_needed',
    'additional_notes',
    'ai_status',
  ], term);

  const [userIds, departmentIds, goalIds, planIds, analysisRows, taskIds] = await Promise.all([
    getIdsBySearch('users', ['full_name', 'display_name', 'email'], term),
    getIdsBySearch('departments', ['name', 'description', 'status'], term),
    getIdsBySearch('goals', ['title', 'description', 'success_metric', 'expected_deliverables', 'priority', 'status'], term),
    getIdsBySearch('department_plans', ['title', 'description', 'plan_type'], term),
    applySearchOr(
      supabase.from('report_ai_analysis').select('report_id'),
      buildIlikeClauses(['summary', 'admin_recommendation', 'ai_comment', 'risk_level', 'status'], term)
    ).then(({ data }) => (data || []).map((row) => row.report_id).filter(Boolean)).catch(() => []),
    getIdsBySearch('tasks', ['title', 'description', 'expected_output', 'priority', 'status'], term),
  ]);

  let taskReportIds = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from('report_tasks')
      .select('report_id')
      .in('task_id', taskIds);
    taskReportIds = (data || []).map((row) => row.report_id).filter(Boolean);
  }

  return [
    ...clauses,
    buildInClause('user_id', userIds),
    buildInClause('department_id', departmentIds),
    buildInClause('goal_id', goalIds),
    buildInClause('plan_id', planIds),
    buildInClause('id', [...analysisRows, ...taskReportIds]),
  ].filter(Boolean);
}

async function applyFilters(query, filters = {}) {
  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }

  if (filters.report_type) {
    query = query.eq('report_type', filters.report_type);
  }

  if (filters.ai_status) {
    query = query.eq('ai_status', filters.ai_status);
  }

  if (filters.company_goal_id) {
    query = query.eq('company_goal_id', filters.company_goal_id);
  }

  if (filters.reviewed !== undefined) {
    query = query.eq('reviewed', filters.reviewed);
  }

  if (filters.risk_level) {
    const { data: riskRows } = await supabase
      .from('report_ai_analysis')
      .select('report_id')
      .eq('risk_level', filters.risk_level);
    const reportIds = (riskRows || []).map((row) => row.report_id).filter(Boolean);
    query = reportIds.length > 0 ? query.in('id', reportIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  if (filters.dateFrom) {
    query = query.gte('submitted_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('submitted_at', filters.dateTo);
  }

  if (filters.search) {
    query = applySearchOr(query, await buildReportSearchClauses(filters.search));
  }

  return query;
}

export async function fetchReportsPaginated(filters = {}, page = 1, pageSize = 15) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  // Count query — efficient, only fetches count
  let countQuery = supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  countQuery = await applyFilters(countQuery, filters);

  const { count, error: countError } = await countQuery;

  if (countError) {
    return { data: null, error: countError, count: 0, page, pageSize, totalPages: 0 };
  }

  // Data query with pagination
  let dataQuery = supabase
    .from('reports')
    .select(`
      *,
      users:user_id (id, full_name, display_name, email, avatar_url, job_title),
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title),
      company_goals:company_goal_id (id, title, month, year),
      report_ai_analysis (*)
    `)
    .order(filters.sortBy || 'submitted_at', { ascending: filters.sortDirection === 'asc' })
    .range(start, end);

  dataQuery = await applyFilters(dataQuery, filters);

  const { data, error } = await dataQuery;

  const totalPages = Math.ceil((count || 0) / pageSize);

  return { data, error, count: count || 0, page, pageSize, totalPages };
}

export async function fetchReportById(id) {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      users:user_id (id, full_name, display_name, email, avatar_url, job_title, role),
      departments:department_id (id, name),
      goals:goal_id (id, title, description, success_metric),
      plans:plan_id (id, title, description, plan_type),
      company_goals:company_goal_id (id, title, description, month, year, objectives, expected_outcomes, success_metric, expected_summary),
      report_ai_analysis (*),
      admin_comments (
        *,
        admin:admin_id (id, full_name, display_name, email, avatar_url, job_title)
      )
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function fetchUserReports(userId, limit = 20, filters = {}) {
  let query = supabase
    .from('reports')
    .select(`
      *,
      departments:department_id (name),
      goals:goal_id (title),
      plans:plan_id (title),
      report_ai_analysis (risk_level, progress_score, goal_alignment_score, report_quality_score, success_rate, task_alignment_score, summary, admin_recommendation, ai_comment, created_at)
    `)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (filters.search) {
    query = applySearchOr(query, await buildReportSearchClauses(filters.search));
  }

  const { data, error } = await query;

  return { data, error };
}

export async function createReport(reportData) {
  const { data, error } = await supabase
    .from('reports')
    .insert([reportData])
    .select()
    .single();

  return { data, error };
}

export async function updateReport(id, updates) {
  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function markReportReviewed(id, reviewerId) {
  const { data, error } = await supabase
    .from('reports')
    .update({
      reviewed: true,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function fetchHighRiskReports() {
  const { data, error } = await supabase
    .from('report_ai_analysis')
    .select(`
      *,
      reports!inner (
        id, user_id, department_id, project_name, submitted_at, reviewed,
        users:user_id (full_name, display_name, avatar_url, job_title),
        departments:department_id (name)
      )
    `)
    .eq('risk_level', 'high')
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Bulk delete reports by IDs, clearing child table references first.
 * @param {string[]} ids - Array of report UUIDs
 */
export async function deleteReports(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { error: null };

  try {
    // Clean up dependent tables first
    await supabase.from('report_tasks').delete().in('report_id', ids);
    await supabase.from('report_ai_analysis').delete().in('report_id', ids);
    await supabase.from('admin_comments').delete().in('report_id', ids);

    const { error } = await supabase
      .from('reports')
      .delete()
      .in('id', ids);

    return { error };
  } catch (err) {
    return { error: err };
  }
}
