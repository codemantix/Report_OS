import { fetchReportById } from '../../../services/reportService';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getResendClient } from '../../../lib/resendClient';
import { buildReportConfirmationEmail } from '../../../utils/emailTemplates';
import { fetchUserById } from '../../../services/userService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // Fetch report with relations
    const { data: report, error: reportError } = await fetchReportById(reportId);

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Fetch the user
    const { data: user, error: userError } = await fetchUserById(report.user_id);

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resendClient = getResendClient();

    if (!resendClient) {
      // Log that email would have been sent
      console.log('Email would be sent to:', user.email, 'for report:', reportId);
      return res.status(200).json({
        message: 'Email client not configured. Email logged instead.',
        emailTo: user.email,
      });
    }

    // Build email
    const emailContent = buildReportConfirmationEmail(report, user);

    // Send email
    const emailResponse = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'hello@codemantixcollective.com',
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    // Log the email in the database
    const supabaseAdmin = getAdminClient();
    await supabaseAdmin.from('email_logs').insert([
      {
        report_id: reportId,
        user_id: user.id,
        email: user.email,
        subject: emailContent.subject,
        status: emailResponse.error ? 'failed' : 'sent',
        provider_response: emailResponse,
        sent_at: emailResponse.error ? null : new Date().toISOString(),
      },
    ]);

    if (emailResponse.error) {
      console.error('Email send error:', emailResponse.error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({
      success: true,
      message: 'Confirmation email sent',
      emailTo: user.email,
    });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
