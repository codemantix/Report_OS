import { getAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Task ID is required' });
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

    // 2. Fetch task details with admin client
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        departments:department_id (id, name),
        goals:goal_id (id, title, description, success_metric),
        plans:plan_id (id, title, description, plan_type),
        created_by_user:created_by (id, full_name, display_name, email, avatar_url),
        task_assignees (
          users:user_id (id, full_name, display_name, email, avatar_url, job_title)
        ),
        task_comments (
          *,
          user:user_id (id, full_name, display_name, email, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 3. Verify read permission
    const canManage = profile.role === 'admin' || profile.role === 'department_lead';

    if (!canManage) {
      // Regular user: must be assigned to the task
      const isAssignee = (task.task_assignees || []).some(
        (a) => a.users?.id === user.id || a.user_id === user.id
      );

      if (!isAssignee) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this task' });
      }
    } else if (profile.role === 'department_lead') {
      // Department leads can only read tasks in their own department
      if (task.department_id !== profile.department_id) {
        return res.status(403).json({ error: 'Forbidden: You can only view tasks in your own department' });
      }
    }

    let linkedReportsQuery = supabaseAdmin
      .from('reports')
      .select(`
        id,
        project_name,
        report_type,
        submitted_at,
        completion_percentage,
        ai_status,
        users:user_id (id, full_name, display_name, avatar_url)
      `)
      .eq('task_id', id)
      .order('submitted_at', { ascending: false });

    if (!canManage) {
      linkedReportsQuery = linkedReportsQuery.eq('user_id', user.id);
    }

    const { data: linkedReports, error: reportsError } = await linkedReportsQuery;

    if (reportsError) {
      console.error('Failed to load linked task reports:', reportsError);
    }

    return res.status(200).json({
      data: {
        ...task,
        linked_reports: linkedReports || [],
      },
    });
  } catch (err) {
    console.error('Task detail API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
