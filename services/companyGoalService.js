import { supabase } from '../lib/supabaseClient';

/**
 * Create a new company monthly goal.
 */
export async function createCompanyGoal(goalData) {
  const { data, error } = await supabase
    .from('company_monthly_goals')
    .insert([goalData])
    .select(`
      *,
      owner:owner_id (id, full_name, display_name, email, avatar_url)
    `)
    .single();

  return { data, error };
}

/**
 * Update an existing company monthly goal.
 */
export async function updateCompanyGoal(id, updates) {
  const { data, error } = await supabase
    .from('company_monthly_goals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      owner:owner_id (id, full_name, display_name, email, avatar_url)
    `)
    .single();

  return { data, error };
}

/**
 * Fetch company goals with optional filters.
 */
export async function fetchCompanyGoals(filters = {}) {
  let query = supabase
    .from('company_monthly_goals')
    .select(`
      *,
      owner:owner_id (id, full_name, display_name, email, avatar_url)
    `)
    .order(filters.sortBy || 'created_at', { ascending: filters.sortDirection === 'asc' });

  if (filters.month) {
    query = query.eq('month', filters.month);
  }
  if (filters.year) {
    query = query.eq('year', filters.year);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,success_metric.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Fetch only active and in-progress company goals.
 */
export async function fetchActiveCompanyGoals() {
  const { data, error } = await supabase
    .from('company_monthly_goals')
    .select(`
      id, title, month, year, status, priority,
      owner:owner_id (id, full_name, display_name, avatar_url)
    `)
    .in('status', ['active', 'in_progress'])
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  return { data, error };
}

/**
 * Fetch a single company goal by ID with full details.
 */
export async function fetchCompanyGoalById(id) {
  const { data, error } = await supabase
    .from('company_monthly_goals')
    .select(`
      *,
      owner:owner_id (id, full_name, display_name, email, avatar_url, job_title),
      created_by_user:created_by (id, full_name, display_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

/**
 * Archive a company goal.
 */
export async function archiveCompanyGoal(id) {
  const { data, error } = await supabase
    .from('company_monthly_goals')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch alignment data for a single company goal — linked department goals, tasks, reports.
 */
export async function fetchCompanyGoalAlignmentData(companyGoalId) {
  const [goalsResult, tasksResult, reportsResult] = await Promise.all([
    supabase
      .from('goals')
      .select(`
        id, title, status, priority,
        departments:department_id (id, name)
      `)
      .eq('company_goal_id', companyGoalId),

    supabase
      .from('tasks')
      .select(`
        id, title, status, priority,
        departments:department_id (id, name)
      `)
      .eq('company_goal_id', companyGoalId),

    supabase
      .from('reports')
      .select(`
        id, project_name, submitted_at, ai_status,
        users:user_id (id, full_name, display_name, avatar_url),
        departments:department_id (id, name),
        report_ai_analysis (
          company_goal_alignment_score,
          expected_outcome_progress_score,
          company_alignment_summary,
          success_rate
        )
      `)
      .eq('company_goal_id', companyGoalId)
      .order('submitted_at', { ascending: false }),
  ]);

  return {
    goals: goalsResult.data || [],
    tasks: tasksResult.data || [],
    reports: reportsResult.data || [],
    errors: {
      goals: goalsResult.error,
      tasks: tasksResult.error,
      reports: reportsResult.error,
    },
  };
}

/**
 * Fetch a progress summary for company goals in a given month/year.
 */
export async function fetchCompanyProgressSummary(month, year) {
  const filters = {};
  if (month) filters.month = month;
  if (year) filters.year = year;

  const { data: goals, error } = await fetchCompanyGoals(filters);

  if (error || !goals) {
    return { data: null, error };
  }

  const goalIds = goals.map((g) => g.id);

  if (goalIds.length === 0) {
    return {
      data: {
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        linkedDepartmentGoals: 0,
        linkedTasks: 0,
        linkedReports: 0,
        avgAlignmentScore: 0,
      },
      error: null,
    };
  }

  const [deptGoalsResult, tasksResult, reportsResult] = await Promise.all([
    supabase
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .in('company_goal_id', goalIds),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('company_goal_id', goalIds),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .in('company_goal_id', goalIds),
  ]);

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'in_progress').length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;

  // Calculate avg outcomes completed
  let totalOutcomes = 0;
  let completedOutcomes = 0;
  goals.forEach((g) => {
    const outcomes = g.expected_outcomes || [];
    totalOutcomes += outcomes.length;
    completedOutcomes += outcomes.filter((o) => o.completed).length;
  });

  return {
    data: {
      totalGoals: goals.length,
      activeGoals,
      completedGoals,
      linkedDepartmentGoals: deptGoalsResult.count || 0,
      linkedTasks: tasksResult.count || 0,
      linkedReports: reportsResult.count || 0,
      totalOutcomes,
      completedOutcomes,
    },
    error: null,
  };
}
