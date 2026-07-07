import { supabase } from '../lib/supabaseClient';

export async function fetchDashboardStats() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    { count: totalReports },
    { count: weeklyReports },
    { data: aiAnalyses },
    { count: unreviewedReports },
    { data: highRiskData },
    { count: totalGoals },
    { data: goalsData },
  ] = await Promise.all([
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('submitted_at', startOfWeek.toISOString()),
    supabase.from('report_ai_analysis').select('progress_score, goal_alignment_score, report_quality_score, success_rate, risk_level'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('reviewed', false),
    supabase.from('report_ai_analysis').select('id').eq('risk_level', 'high'),
    supabase.from('goals').select('*', { count: 'exact', head: true }),
    supabase.from('goals').select('status'),
  ]);

  const totalAnalyses = aiAnalyses?.length || 0;
  const avgSuccessRate = aiAnalyses?.reduce((sum, a) => sum + (a.success_rate || 0), 0) / (totalAnalyses || 1);
  const avgGoalAlignment = aiAnalyses?.reduce((sum, a) => sum + (a.goal_alignment_score || 0), 0) / (totalAnalyses || 1);
  const avgProgressScore = aiAnalyses?.reduce((sum, a) => sum + (a.progress_score || 0), 0) / (totalAnalyses || 1);
  const avgQualityScore = aiAnalyses?.reduce((sum, a) => sum + (a.report_quality_score || 0), 0) / (totalAnalyses || 1);

  const completedGoals = goalsData?.filter((g) => g.status === 'completed').length || 0;
  const delayedGoals = goalsData?.filter((g) => g.status === 'delayed').length || 0;
  const blockedGoals = goalsData?.filter((g) => g.status === 'blocked').length || 0;
  const highRiskCount = highRiskData?.length || 0;

  return {
    totalReports: totalReports || 0,
    weeklyReports: weeklyReports || 0,
    avgSuccessRate: Math.round(avgSuccessRate),
    avgGoalAlignment: Math.round(avgGoalAlignment),
    avgProgressScore: Math.round(avgProgressScore),
    avgQualityScore: Math.round(avgQualityScore),
    highRiskReports: highRiskCount,
    unreviewedReports: unreviewedReports || 0,
    completedGoals,
    delayedGoals,
    blockedGoals,
    totalGoals: totalGoals || 0,
  };
}

export async function fetchDepartmentProgress() {
  const { data: departments, error } = await supabase
    .from('departments')
    .select(`
      id,
      name,
      reports (
        id,
        report_ai_analysis (progress_score, goal_alignment_score, success_rate, risk_level)
      )
    `);

  if (error) return { data: null, error };

  const progress = departments.map((dept) => {
    const analyses = dept.reports
      ?.map((r) => r.report_ai_analysis)
      .filter(Boolean)
      .flat() || [];

    const avgProgress = analyses.reduce((sum, a) => sum + (a.progress_score || 0), 0) / (analyses.length || 1);
    const avgAlignment = analyses.reduce((sum, a) => sum + (a.goal_alignment_score || 0), 0) / (analyses.length || 1);
    const avgSuccess = analyses.reduce((sum, a) => sum + (a.success_rate || 0), 0) / (analyses.length || 1);
    const highRisk = analyses.filter((a) => a.risk_level === 'high').length;

    return {
      id: dept.id,
      name: dept.name,
      reportCount: analyses.length,
      avgProgress: Math.round(avgProgress),
      avgAlignment: Math.round(avgAlignment),
      avgSuccess: Math.round(avgSuccess),
      highRiskCount: highRisk,
    };
  });

  return { data: progress, error: null };
}

export async function fetchRecentReports(limit = 10) {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      id, project_name, report_type, submitted_at, reviewed, ai_status,
      users:user_id (full_name, display_name, avatar_url, job_title),
      departments:department_id (name),
      report_ai_analysis (risk_level, goal_alignment_score, progress_score, success_rate, created_at)
    `)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  return { data, error };
}
