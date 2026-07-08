import { getAuthenticatedUser } from '../../../lib/apiAuth';
import { getTeamMemberProfile, getTeamMemberStats, updateTeamMemberByAdmin } from '../../../services/userService';

export default async function handler(req, res) {
  const { id: targetUserId } = req.query;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID is required' });
  }

  // 1. Authenticate user session
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // 2. Fetch target user profile and stats in parallel
      const [profileRes, statsRes] = await Promise.all([
        getTeamMemberProfile({ currentUser, targetUserId }),
        getTeamMemberStats({ currentUser, targetUserId })
      ]);

      if (profileRes.error) {
        const status = profileRes.error.message?.includes('Unauthorized') ? 403 : 404;
        return res.status(status).json({ error: profileRes.error.message });
      }

      if (statsRes.error) {
        return res.status(500).json({ error: statsRes.error.message });
      }

      return res.status(200).json({
        profile: profileRes.data,
        stats: statsRes.data
      });
    } catch (error) {
      console.error('API get team member error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      // Admins only
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
      }

      const { full_name, display_name, phone_number, job_title, bio } = req.body;
      const payload = {
        full_name,
        display_name,
        phone_number,
        job_title,
        bio,
        updated_at: new Date().toISOString()
      };

      // Clean undefined
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) delete payload[key];
      });

      const { data, error } = await updateTeamMemberByAdmin({
        adminId: currentUser.id,
        targetUserId,
        payload
      });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ profile: data, message: 'User updated successfully' });
    } catch (error) {
      console.error('API update team member error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
