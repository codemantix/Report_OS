import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';


export default async function handler(req, res) {
  const supabaseAdmin = getAdminClient();

  if (req.method === 'POST') {
    try {
      const currentUser = await getAuthenticatedUser(req, res);
      if (!currentUser) return respondAuthFailure(res);

      const { reportId, comment } = req.body;

      if (!reportId || !comment) {
        return res.status(400).json({ error: 'Report ID and comment are required' });
      }

      const authorName = currentUser.display_name
        || currentUser.full_name
        || currentUser.email
        || 'Reviewer';

      const { data, error } = await supabaseAdmin.from('admin_comments').insert([
        {
          report_id: reportId,
          admin_id: currentUser.id,
          author_name_snapshot: authorName,
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

  if (req.method === 'PUT') {
    try {
      const { commentId, comment } = req.body;

      if (!commentId || !comment) {
        return res.status(400).json({ error: 'Comment ID and comment text are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('admin_comments')
        .update({ comment: comment })
        .eq('id', commentId)
        .select(`
          *,
          admin:admin_id (id, full_name, display_name, email, avatar_url, job_title)
        `)
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        comment: data,
      });
    } catch (error) {
      console.error('Edit comment error:', error);
      return res.status(500).json({ error: 'Failed to edit comment' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { commentId, reportId } = req.query;

      if (commentId) {
        // Delete specific comment
        const { error } = await supabaseAdmin
          .from('admin_comments')
          .delete()
          .eq('id', commentId);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Comment deleted' });
      }

      if (reportId) {
        // Delete report and all its relations:
        // 1. report_tasks links
        await supabaseAdmin.from('report_tasks').delete().eq('report_id', reportId);

        // 2. report_ai_analysis records
        await supabaseAdmin.from('report_ai_analysis').delete().eq('report_id', reportId);

        // 3. admin_comments records
        await supabaseAdmin.from('admin_comments').delete().eq('report_id', reportId);

        // 4. Finally, the report itself
        const { error } = await supabaseAdmin
          .from('reports')
          .delete()
          .eq('id', reportId);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Report deleted' });
      }

      return res.status(400).json({ error: 'Either commentId or reportId is required' });
    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
