import { getAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId, comment } = req.body;

    if (!reportId || !comment) {
      return res.status(400).json({ error: 'Report ID and comment are required' });
    }

    const supabaseAdmin = getAdminClient();

    // For now, use the first admin user found (in production, get from session)
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const { data, error } = await supabaseAdmin.from('admin_comments').insert([
      {
        report_id: reportId,
        admin_id: adminUser?.id || null,
        comment: comment,
      },
    ]).select(`
      *,
      admin:admin_id (id, full_name, display_name, email, avatar_url, job_title)
    `).single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      comment: data,
    });
  } catch (error) {
    console.error('Admin comment error:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}
