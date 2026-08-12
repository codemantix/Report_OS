// Email templates for evaluation notifications. Reuses the visual language of
// the existing Report OS email templates (deep-blue header, CTA button, footer).

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell({ recipientName, headline, message, ctaLabel, ctaUrl, appName, appUrl, details = '' }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(headline)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 10px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #E2E8F0; }
        .header { background: #1E3A8A; padding: 32px; text-align: center; }
        .header h1 { color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
        .content { padding: 32px; }
        .greeting { font-size: 16px; line-height: 24px; margin-bottom: 20px; }
        .details { background: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0; padding: 20px; margin-bottom: 24px; font-size: 14px; line-height: 22px; color: #475569; }
        .btn-wrapper { text-align: center; margin: 32px 0 16px; }
        .btn { display: inline-block; background: #1E3A8A; color: #FFFFFF !important; text-decoration: none; padding: 12px 30px; font-size: 14px; font-weight: 600; border-radius: 8px; }
        .footer { background: #F1F5F9; padding: 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
        .footer a { color: #1E3A8A; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>${escapeHtml(appName)}</h1></div>
        <div class="content">
          <p class="greeting">Hi ${escapeHtml(recipientName)},</p>
          <p class="greeting">${message}</p>
          ${details ? `<div class="details">${details}</div>` : ''}
          <div class="btn-wrapper">
            <a href="${escapeHtml(ctaUrl)}" class="btn">${escapeHtml(ctaLabel)}</a>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification from ${escapeHtml(appName)}.</p>
          <p>Managed by <a href="${escapeHtml(appUrl)}">${escapeHtml(appName)}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function periodLine(period) {
  if (!period) return '';
  const start = new Date(`${period.start_date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium' });
  const end = new Date(`${period.end_date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return `<strong>${escapeHtml(period.name)}</strong> (${start} – ${end})`;
}

export function buildEvaluationNotificationEmail({
  type,
  recipientName = 'there',
  period,
  evaluation,
  departmentName,
  appUrl = 'https://report.codemantixcollective.com/',
  appName = 'Codemantix Report OS',
  ctaLabel,
  ctaUrl,
  details = '',
}) {
  const periodText = periodLine(period);
  const employeeName = evaluation?.employee_name_snapshot
    || evaluation?.employee?.full_name
    || 'the employee';
  const defaultCta = ctaUrl || '/dashboard';
  const defaultCtaLabel = ctaLabel || 'Open Dashboard';

  switch (type) {
    case 'period_opened':
      return {
        subject: `Evaluation period opened: ${period?.name || 'New period'}`,
        html: shell({
          recipientName,
          headline: 'Evaluation Period Opened',
          message: `A new bi-weekly evaluation period is now open: ${periodText}. Please make sure your reports and attendance are up to date before the evaluation deadline.`,
          ctaLabel: defaultCtaLabel,
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details: details || (period?.evaluation_deadline
            ? `Evaluation deadline: ${new Date(period.evaluation_deadline).toLocaleString()}.`
            : ''),
        }),
      };
    case 'report_missing':
      return {
        subject: `Report missing for ${period?.name || 'evaluation period'}`,
        html: shell({
          recipientName,
          headline: 'Report Missing',
          message: `Your report for ${periodText} has not been found. Required reports feed into your Reporting Performance score.`,
          ctaLabel: 'Submit Report',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
    case 'attendance_missing':
      return {
        subject: `Attendance information missing for ${period?.name || 'evaluation period'}`,
        html: shell({
          recipientName,
          headline: 'Attendance Information Missing',
          message: `No attendance records were found for you in ${periodText}. Attendance contributes to your evaluation, so please ensure your sessions are recorded.`,
          ctaLabel: 'Review Attendance',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
    case 'ready_for_review':
      return {
        subject: `Evaluation ready for review: ${employeeName}`,
        html: shell({
          recipientName,
          headline: 'Evaluation Ready for Review',
          message: `The evaluation for ${escapeHtml(employeeName)} in ${periodText} has been calculated and is ready for your review.`,
          ctaLabel: 'Review Evaluation',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details: details || (evaluation?.performance_band
            ? `Calculated band: ${escapeHtml(evaluation.performance_band)}.`
            : ''),
        }),
      };
    case 'returned_for_review':
      return {
        subject: `Evaluation returned for review: ${employeeName}`,
        html: shell({
          recipientName,
          headline: 'Evaluation Returned for Review',
          message: `The evaluation for ${escapeHtml(employeeName)} in ${periodText} was returned for revision. Please address the reviewer feedback and resubmit.`,
          ctaLabel: 'View Evaluation',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
    case 'approved':
      return {
        subject: `Evaluation approved: ${employeeName}`,
        html: shell({
          recipientName,
          headline: 'Evaluation Approved',
          message: `The evaluation for ${escapeHtml(employeeName)} in ${periodText} was approved.`,
          ctaLabel: 'View Evaluation',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details: details || (evaluation?.approved_score !== null && evaluation?.approved_score !== undefined
            ? `Approved score: ${evaluation.approved_score}.`
            : ''),
        }),
      };
    case 'stipend_approved':
      return {
        subject: `Stipend approved for ${employeeName}`,
        html: shell({
          recipientName,
          headline: 'Stipend Approved',
          message: `A stipend recommendation for ${escapeHtml(employeeName)} in ${periodText} was approved.`,
          ctaLabel: 'View Stipend',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
    case 'payment_recorded':
      return {
        subject: `Payment recorded for ${employeeName}`,
        html: shell({
          recipientName,
          headline: 'Payment Recorded',
          message: `A stipend payment for ${escapeHtml(employeeName)} in ${periodText} was recorded.`,
          ctaLabel: 'View Payments',
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
    default:
      return {
        subject: 'Report OS Notification',
        html: shell({
          recipientName,
          headline: 'Notification',
          message,
          ctaLabel: defaultCtaLabel,
          ctaUrl: `${appUrl.replace(/\/$/, '')}${defaultCta}`,
          appName,
          appUrl,
          details,
        }),
      };
  }
}

export { shell };
