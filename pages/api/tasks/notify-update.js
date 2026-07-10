import { getAdminClient } from '../../../lib/supabaseAdmin';

function getTaskUpdateEmailHtml({ task, updaterName, recipientName, actionType, previousValue, newValue, appUrl, appName }) {
  const priorityColor = {
    urgent: '#DC2626',
    high: '#EA580C',
    medium: '#D97706',
    low: '#2563EB'
  }[task.priority] || '#4B5563';

  let changeNotice = '';
  if (actionType === 'status_change') {
    const fromStr = (previousValue || 'todo').replace(/_/g, ' ');
    const toStr = (newValue || 'todo').replace(/_/g, ' ');
    changeNotice = `
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #B45309; font-weight: 600;">
          Status changed from <span style="text-transform: capitalize; text-decoration: line-through; color: #9CA3AF;">${fromStr}</span> to <span style="text-transform: capitalize; color: #D97706; border-bottom: 2px dashed #F59E0B;">${toStr}</span>
        </p>
      </div>
    `;
  } else {
    changeNotice = `
      <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #1D4ED8; font-weight: 600;">
          Task details were updated by the team lead/admin.
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Updated</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #F8FAFC;
          color: #1E293B;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 10px auto;
          background: #FFFFFF;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          border: 1px solid #E2E8F0;
        }
        .header {
          background: #1E3A8A;
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          color: #FFFFFF;
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .content {
          padding: 32px;
        }
        .greeting {
          font-size: 16px;
          line-height: 24px;
          margin-bottom: 20px;
        }
        .task-card {
          background: #F8FAFC;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          padding: 24px;
          margin-bottom: 28px;
        }
        .task-title {
          font-size: 18px;
          font-weight: 700;
          color: #1E3A8A;
          margin-top: 0;
          margin-bottom: 12px;
        }
        .task-meta {
          display: table;
          width: 100%;
          margin-bottom: 16px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 16px;
        }
        .meta-col {
          display: table-cell;
          width: 50%;
        }
        .meta-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748B;
          margin-bottom: 4px;
        }
        .meta-value {
          font-size: 14px;
          font-weight: 600;
          color: #0F172A;
        }
        .task-desc {
          font-size: 14px;
          line-height: 22px;
          color: #475569;
          margin-bottom: 0;
        }
        .section-header {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1E3A8A;
          margin-top: 20px;
          margin-bottom: 8px;
        }
        .btn-wrapper {
          text-align: center;
          margin: 32px 0 16px;
        }
        .btn {
          display: inline-block;
          background: #1E3A8A;
          color: #FFFFFF !important;
          text-decoration: none;
          padding: 12px 30px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
        }
        .footer {
          background: #F1F5F9;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #64748B;
          border-top: 1px solid #E2E8F0;
        }
        .footer a {
          color: #1E3A8A;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>
        <div class="content">
          <p class="greeting">Hi ${recipientName},</p>
          <p class="greeting">The task <strong>"${task.title}"</strong> has been updated by <strong>${updaterName}</strong>.</p>
          
          ${changeNotice}

          <div class="task-card">
            <h2 class="task-title">${task.title}</h2>
            
            <div class="task-meta">
              <div class="meta-col">
                <div class="meta-label">Priority</div>
                <div class="meta-value" style="color: ${priorityColor}; text-transform: capitalize;">${task.priority}</div>
              </div>
              <div class="meta-col">
                <div class="meta-label">Current Status</div>
                <div class="meta-value" style="text-transform: capitalize;">${task.status.replace(/_/g, ' ')}</div>
              </div>
            </div>

            ${task.description ? `
              <div class="section-header">Description</div>
              <p class="task-desc">${task.description.replace(/\n/g, '<br>')}</p>
            ` : ''}
          </div>

          <div class="btn-wrapper">
            <a href="${appUrl}/dashboard/tasks/${task.id}" class="btn">View Task Details</a>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification from ${appName}.</p>
          <p>Managed by <a href="${appUrl}">${appName}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = getAdminClient();

  // Get auth token from authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { taskId, actionType, previousValue, newValue } = req.body;

  if (!taskId || !actionType) {
    return res.status(400).json({ error: 'Task ID and actionType are required' });
  }

  try {
    // 1. Fetch task details
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, description, priority, due_date, status, created_by')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 2. Fetch updater profile
    const { data: updater, error: updaterError } = await supabaseAdmin
      .from('users')
      .select('full_name, display_name')
      .eq('id', user.id)
      .single();

    const updaterName = updater?.display_name || updater?.full_name || 'A team member';

    // 3. Fetch assignees for this specific task only
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', taskId);

    const assigneeIds = (assignments || []).map((a) => a.user_id).filter(Boolean);

    // Build recipient list: assignees + creator, excluding the updater themselves
    const recipientIdsSet = new Set([...assigneeIds, task.created_by]);
    recipientIdsSet.delete(user.id); // Exclude self
    const recipientIds = Array.from(recipientIdsSet);

    if (recipientIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No other users to notify' });
    }

    // 4. Fetch profiles of recipients
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, display_name')
      .in('id', recipientIds);

    if (recipientsError || !recipients || recipients.length === 0) {
      return res.status(200).json({ success: true, message: 'No recipients found with valid profiles' });
    }

    // 5. Initialize Resend
    const { Resend } = require('resend');
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    if (!resend) {
      console.warn('Resend API key is missing. Skipping task update notifications.');
      return res.status(200).json({ success: true, message: 'Resend API key missing, skipped email' });
    }

    const fromEmail = process.env.FROM_EMAIL || 'hello@codemantixcollective.com';
    const appName = 'Codemantix Report OS';
    const appUrl = process.env.APP_URL || 'https://report.codemantixcollective.com/';

    // 6. Send emails in parallel
    const emailPromises = recipients.map(async (recipient) => {
      if (!recipient.email) return;

      const recipientName = recipient.display_name || recipient.full_name || 'Team Member';
      const emailHtml = getTaskUpdateEmailHtml({
        task,
        updaterName,
        recipientName,
        actionType,
        previousValue,
        newValue,
        appUrl,
        appName
      });

      return resend.emails.send({
        from: `${appName} <${fromEmail}>`,
        to: recipient.email,
        subject: `Task Updated: ${task.title}`,
        html: emailHtml
      });
    });

    await Promise.all(emailPromises);

    return res.status(200).json({ success: true, message: `Notified ${recipients.length} respective persons` });
  } catch (err) {
    console.error('Task update notification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
