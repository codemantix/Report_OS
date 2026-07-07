import { getAdminClient } from '../../../lib/supabaseAdmin';
import { runAiAnalysis } from './analyze';

function hasAnalysis(report) {
  const analysis = report.report_ai_analysis;
  return Array.isArray(analysis) ? analysis.length > 0 : Boolean(analysis);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(Math.max(Number(req.body?.limit) || 10, 1), 25);
  const includeFailed = req.body?.includeFailed !== false;

  try {
    const supabaseAdmin = getAdminClient();
    const { data: reports, error } = await supabaseAdmin
      .from('reports')
      .select('id, ai_status, submitted_at, report_ai_analysis (id)')
      .order('submitted_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    const candidates = (reports || [])
      .filter((report) => {
        if (report.ai_status === 'processing') return false;
        if (!hasAnalysis(report)) return true;
        if (report.ai_status === 'pending') return true;
        return includeFailed && report.ai_status === 'failed';
      })
      .slice(0, limit);

    const results = [];

    for (const report of candidates) {
      try {
        await runAiAnalysis(report.id);
        results.push({ reportId: report.id, status: 'completed' });
      } catch (error) {
        await supabaseAdmin.from('reports').update({ ai_status: 'failed' }).eq('id', report.id);
        results.push({
          reportId: report.id,
          status: 'failed',
          error: error.message || 'Unknown error',
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      remainingEstimate: Math.max((reports || []).length - candidates.length, 0),
      results,
    });
  } catch (error) {
    console.error('Pending AI analysis error:', error);
    return res.status(500).json({ error: 'Pending AI analysis failed: ' + (error.message || 'Unknown error') });
  }
}
