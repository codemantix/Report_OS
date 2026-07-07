export function buildReportConfirmationEmail(report, user) {
  const submittedAt = new Date(report.submitted_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const departmentName = report.departments?.name || 'Not specified';

  return {
    subject: 'Codemantix Report Submission Confirmation',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
          .header { text-align: center; padding-bottom: 32px; border-bottom: 1px solid #E2E8F0; }
          .logo { font-size: 24px; font-weight: 800; color: #1E3A8A; letter-spacing: -0.5px; }
          .badge { display: inline-block; padding: 8px 16px; background: #1E3A8A; color: white; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 16px; }
          .content { padding: 32px 0; }
          .greeting { font-size: 18px; font-weight: 600; color: #0F172A; margin-bottom: 8px; }
          .message { color: #64748B; line-height: 1.6; margin-bottom: 24px; }
          .section { background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
          .section-title { font-size: 14px; font-weight: 600; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #F1F5F9; }
          .field { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F8FAFC; }
          .field-label { color: #64748B; font-size: 14px; }
          .field-value { color: #0F172A; font-size: 14px; font-weight: 500; text-align: right; max-width: 60%; }
          .text-block { color: #0F172A; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
          .footer { text-align: center; padding-top: 32px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Codemantix</div>
            <div class="badge">Report Submitted ✓</div>
          </div>
          <div class="content">
            <div class="greeting">Hello ${user.full_name},</div>
            <div class="message">Your report has been successfully submitted and saved. Here is a copy of your submission for your records.</div>

            <div class="section">
              <div class="section-title">Report Overview</div>
              <div class="field">
                <span class="field-label">Department</span>
                <span class="field-value">${departmentName}</span>
              </div>
              <div class="field">
                <span class="field-label">Report Type</span>
                <span class="field-value">${report.report_type}</span>
              </div>
              <div class="field">
                <span class="field-label">Project</span>
                <span class="field-value">${report.project_name || 'N/A'}</span>
              </div>
              <div class="field">
                <span class="field-label">Date Submitted</span>
                <span class="field-value">${submittedAt}</span>
              </div>
              <div class="field" style="border-bottom: none;">
                <span class="field-label">Hours Worked</span>
                <span class="field-value">${report.hours_worked || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">What You Worked On</div>
              <div class="text-block">${report.worked_on || 'N/A'}</div>
            </div>

            <div class="section">
              <div class="section-title">Completed Tasks</div>
              <div class="text-block">${report.completed_tasks || 'None specified'}</div>
            </div>

            <div class="section">
              <div class="section-title">Pending Tasks</div>
              <div class="text-block">${report.pending_tasks || 'None specified'}</div>
            </div>

            ${report.blockers ? `
            <div class="section">
              <div class="section-title">Blockers</div>
              <div class="text-block">${report.blockers}</div>
            </div>` : ''}

            ${report.support_needed ? `
            <div class="section">
              <div class="section-title">Support Needed</div>
              <div class="text-block">${report.support_needed}</div>
            </div>` : ''}

            ${report.additional_notes ? `
            <div class="section">
              <div class="section-title">Additional Notes</div>
              <div class="text-block">${report.additional_notes}</div>
            </div>` : ''}

            <div class="message" style="text-align: center; margin-top: 24px;">
              Thank you for keeping your work documented.<br>
              <strong>Codemantix Collective</strong>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated confirmation. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Codemantix Collective. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export function buildAdminNotificationEmail(report, user, analysis) {
  return {
    subject: `New Report: ${report.project_name || 'Untitled'} by ${user.full_name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: system-ui; background: #F8FAFC; padding: 40px 24px;">
        <div style="max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1E3A8A;">New Report Submitted</h2>
          <p style="color: #64748B;">${user.full_name} submitted a ${report.report_type} report.</p>
          <p style="color: #64748B;">View it in the admin dashboard to review and see AI analysis.</p>
        </div>
      </body>
      </html>
    `,
  };
}
