import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getAIClient } from '../../../lib/aiClient';
import { buildAnalysisPrompt } from '../../../utils/aiPrompts';

export async function runAiAnalysis(reportId) {
  const supabaseAdmin = getAdminClient();

  await supabaseAdmin.from('reports').update({ ai_status: 'processing' }).eq('id', reportId);

  // Fetch report data using admin client (bypasses RLS)
  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .select(`
      *,
      goals:goal_id (id, title, description, success_metric, expected_deliverables, priority, due_date, company_goal_id),
      plans:plan_id (id, title, description, plan_type),
      company_goals:company_goal_id (id, title, description, success_metric, expected_summary, priority, status, objectives, expected_outcomes)
    `)
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    console.error('Report fetch error:', reportError?.message || 'Report not found');
    throw new Error('Report not found');
  }

  // Extract goal and plan from the embedded data
  const goal = report.goals || null;
  const plan = report.plans || null;
  let companyGoal = report.company_goals || null;
  let task = null;
  delete report.goals;
  delete report.plans;
  delete report.company_goals;

  // Fetch linked task from report_tasks pivot (simple query, no RLS issues)
  try {
    const supabaseAdmin = getAdminClient();
    const { data: reportTasks } = await supabaseAdmin
      .from('report_tasks')
      .select('task_id')
      .eq('report_id', reportId)
      .maybeSingle();

    if (reportTasks?.task_id) {
      const { data: taskData } = await supabaseAdmin
        .from('tasks')
        .select('id, title, description, expected_output, priority, status, due_date, company_goal_id')
        .eq('id', reportTasks.task_id)
        .single();
      task = taskData;
    }
  } catch (e) {
    console.error('Task lookup (optional) failed:', e?.message || e);
  }

  // If no direct company goal, try inheriting from task or department goal
  if (!companyGoal) {
    const inheritedCompanyGoalId = task?.company_goal_id || goal?.company_goal_id;
    if (inheritedCompanyGoalId) {
      try {
        const { data: cgData } = await supabaseAdmin
          .from('company_monthly_goals')
          .select('id, title, description, success_metric, expected_summary, priority, status, objectives, expected_outcomes')
          .eq('id', inheritedCompanyGoalId)
          .single();
        if (cgData) {
          companyGoal = cgData;
          // Backport to reports table so the link is saved
          await supabaseAdmin.from('reports').update({ company_goal_id: inheritedCompanyGoalId }).eq('id', reportId);
        }
      } catch (cgErr) {
        console.error('Inherited company goal fetch failed:', cgErr?.message || cgErr);
      }
    }
  }

  // Get AI client
  const ai = getAIClient();

  if (!ai) {
    console.error('AI client returned null - check OPENAI_API_KEY or OPENROUTER_BASE_URL');
    await supabaseAdmin.from('report_ai_analysis').delete().eq('report_id', reportId);
    await supabaseAdmin.from('report_ai_analysis').insert([
      {
        report_id: reportId,
        summary: 'AI analysis not available. Please configure your OpenAI API key.',
        progress_score: 0,
        goal_alignment_score: 0,
        report_quality_score: 0,
        success_rate: 0,
        risk_level: 'low',
        status: 'pending',
        admin_recommendation: 'Configure AI provider to enable automatic analysis.',
        ai_comment: '',
      },
    ]);
    await supabaseAdmin.from('reports').update({ ai_status: 'failed' }).eq('id', reportId);
    return { message: 'AI not configured. Placeholder saved.' };
  }

  // Build the AI prompt
  const prompt = buildAnalysisPrompt(report, goal, plan, task, companyGoal);
  console.log('AI prompt built, length:', prompt.length);

  // Call AI
  const completion = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an AI assistant that analyzes work reports. Always respond with valid JSON only, no markdown formatting.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 1800,
  });

  const responseText = completion.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error('Empty AI response');
  }

  // Parse the AI response
  let analysis;
  try {
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch (parseError) {
    console.error('Failed to parse AI response:', responseText);
    throw new Error('Invalid AI response format');
  }

  // Programmatically calculate success rate to ensure consistency with the formula
  const calculatedSuccessRate = Math.round(
    (analysis.task_alignment_score || 0) * 0.25 +
    (analysis.task_progress_score || 0) * 0.25 +
    (analysis.goal_alignment_score || 0) * 0.20 +
    (analysis.company_goal_alignment_score || 0) * 0.15 +
    (analysis.expected_outcome_progress_score || 0) * 0.15
  );

  // Save the analysis to the database. Remove stale placeholder/failed retry rows first
  // so pages read the newest result instead of an older zero-score analysis.
  await supabaseAdmin.from('report_ai_analysis').delete().eq('report_id', reportId);

  const { error: insertError } = await supabaseAdmin.from('report_ai_analysis').insert([
    {
      report_id: reportId,
      summary: analysis.summary || '',
      completed_tasks: analysis.completed_tasks || [],
      pending_tasks: analysis.pending_tasks || [],
      blockers: analysis.blockers || [],
      goal_alignment_score: Math.min(100, Math.max(0, analysis.goal_alignment_score || 0)),
      company_goal_alignment_score: analysis.company_goal_alignment_score !== null && analysis.company_goal_alignment_score !== undefined ? Math.min(100, Math.max(0, analysis.company_goal_alignment_score)) : null,
      expected_outcome_progress_score: analysis.expected_outcome_progress_score !== null && analysis.expected_outcome_progress_score !== undefined ? Math.min(100, Math.max(0, analysis.expected_outcome_progress_score)) : null,
      company_alignment_summary: analysis.company_alignment_summary || null,
      progress_score: Math.min(100, Math.max(0, analysis.progress_score || 0)),
      report_quality_score: Math.min(100, Math.max(0, analysis.report_quality_score || 0)),
      success_rate: Math.min(100, Math.max(0, calculatedSuccessRate || analysis.success_rate || 0)),
      risk_level: analysis.risk_level || 'low',
      status: analysis.status || 'in_progress',
      admin_recommendation: analysis.admin_recommendation || '',
      ai_comment: analysis.ai_comment || '',
      task_alignment_score: analysis.task_alignment_score !== null && analysis.task_alignment_score !== undefined ? Math.min(100, Math.max(0, analysis.task_alignment_score)) : null,
      task_progress_score: analysis.task_progress_score !== null && analysis.task_progress_score !== undefined ? Math.min(100, Math.max(0, analysis.task_progress_score)) : null,
      task_status_recommendation: analysis.task_status_recommendation || null,
      task_feedback: analysis.task_feedback || null,
      raw_ai_response: analysis,
    },
  ]);

  if (insertError) {
    console.error('Failed to save AI analysis:', insertError);
    throw insertError;
  }

  // Update the report's AI status
  await supabaseAdmin.from('reports').update({ ai_status: 'completed' }).eq('id', reportId);

  return { success: true, analysis };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    const result = await runAiAnalysis(reportId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('AI analysis error:', error);

    try {
      const supabaseAdmin = getAdminClient();
      if (req.body?.reportId) {
        await supabaseAdmin.from('reports').update({ ai_status: 'failed' }).eq('id', req.body.reportId);
      }
    } catch (updateErr) {
      console.error('Failed to update AI status:', updateErr);
    }

    return res.status(500).json({ error: 'AI analysis failed: ' + (error.message || 'Unknown error') });
  }
}
