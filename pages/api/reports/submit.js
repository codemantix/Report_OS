import { supabase } from '../../../lib/supabaseClient';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { runAiAnalysis } from './analyze';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId, taskId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // Link report to task if provided
    if (taskId) {
      try {
        await supabase
          .from('report_tasks')
          .upsert(
            { report_id: reportId, task_id: taskId },
            { onConflict: 'report_id,task_id' }
          );
      } catch (linkErr) {
        console.error('Task linking error:', linkErr);
      }
    }

    // Analyze the submitted report so dashboards and report details are populated.
    try {
      await runAiAnalysis(reportId);
    } catch (analysisErr) {
      console.error('AI analysis trigger failed:', analysisErr);
      try {
        const supabaseAdmin = getAdminClient();
        await supabaseAdmin.from('reports').update({ ai_status: 'failed' }).eq('id', reportId);
      } catch (statusErr) {
        console.error('Failed to update AI status:', statusErr);
      }
    }

    // Trigger email confirmation (non-blocking)
    try {
      const supabaseAdmin = getAdminClient();
      const { data: report } = await supabaseAdmin
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single();

      if (report) {
        const { data: userProfile } = await supabaseAdmin
          .from('users')
          .select('full_name, email, department_id')
          .eq('id', report.user_id)
          .single();

        if (userProfile?.email) {
          const { Resend } = require('resend');
          const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
          if (resend) {
            const fromEmail = process.env.FROM_EMAIL || 'noreply@codemantix.com';
            const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Codemantix';
            await resend.emails.send({
              from: `${appName} <${fromEmail}>`,
              to: userProfile.email,
              subject: `${appName} — Report Submission Confirmation`,
              html: `<p>Hi ${userProfile.full_name},</p><p>Your report has been submitted successfully.</p><p>Report ID: ${reportId}</p>`,
            });
          }
        }
      }
    } catch (emailErr) {
      console.error('Email trigger failed:', emailErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Report submitted successfully',
      reportId,
    });
  } catch (error) {
    console.error('Report submission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
