import { getAdminClient } from '../../../lib/supabaseAdmin';

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

  const { taskId, action, previousValue, newValue, metadata } = req.body;

  if (!taskId || !action) {
    return res.status(400).json({ error: 'Task ID and action are required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('task_activity_logs')
      .insert([
        {
          task_id: taskId,
          user_id: user.id,
          action,
          previous_value: previousValue || null,
          new_value: newValue || null,
          metadata: metadata || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Log activity API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
