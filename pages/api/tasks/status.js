import { getAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
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

  const { taskId, status } = req.body;

  if (!taskId || !status) {
    return res.status(400).json({ error: 'Task ID and status are required' });
  }

  try {
    // 1. Fetch user role and department
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, department_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const canManage = profile.role === 'admin' || profile.role === 'department_lead';

    // 2. Fetch current task status and department
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('status, department_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 3. Verify permissions
    let isAssignee = false;

    if (!canManage) {
      // Check if user is assigned to this task
      const { data: assignees, error: assigneesError } = await supabaseAdmin
        .from('task_assignees')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', user.id);

      isAssignee = assignees && assignees.length > 0;

      if (!isAssignee) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this task' });
      }

      // Check if trying to mark completed
      if (status === 'completed') {
        return res.status(403).json({ error: 'Forbidden: Only leads and admins can mark tasks as completed' });
      }
    } else if (profile.role === 'department_lead') {
      // Department leads can only manage tasks in their own department
      if (task.department_id !== profile.department_id) {
        return res.status(403).json({ error: 'Forbidden: You can only manage tasks in your own department' });
      }
    }

    // 4. Update status with supabaseAdmin (bypassing RLS)
    const updates = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 5. Log activity
    await supabaseAdmin.from('task_activity_logs').insert([
      {
        task_id: taskId,
        user_id: user.id,
        action: 'status_changed',
        previous_value: task.status,
        new_value: status,
      },
    ]);

    // 6. Trigger status change email notification (non-blocking)
    try {
      const appUrl = process.env.APP_URL || 'https://report.codemantixcollective.com/';
      fetch(`${appUrl}/api/tasks/notify-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId,
          actionType: 'status_change',
          previousValue: task.status,
          newValue: status
        })
      }).catch((err) => console.error('Status change notification trigger error:', err));
    } catch (notifyErr) {
      console.error('Failed to trigger update notification:', notifyErr);
    }

    return res.status(200).json({ success: true, data: updatedTask });
  } catch (err) {
    console.error('Task status update API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
