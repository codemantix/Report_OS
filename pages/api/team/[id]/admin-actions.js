import { getAuthenticatedUser } from '../../../../lib/apiAuth';
import { changeUserRole, changeUserDepartment, updateUserStatus } from '../../../../services/userService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: targetUserId } = req.query;
  const { action, value } = req.body;

  if (!targetUserId || !action) {
    return res.status(400).json({ error: 'Target user ID and action are required' });
  }

  try {
    // 1. Authenticate session user
    const currentUser = await getAuthenticatedUser(req, res);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Restrict access to Admins only
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }

    // 3. Process actions
    let result;
    switch (action) {
      case 'change_role':
        if (!value) {
          return res.status(400).json({ error: 'Role value is required' });
        }
        result = await changeUserRole({
          adminId: currentUser.id,
          targetUserId,
          role: value
        });
        break;

      case 'change_department':
        // Department ID can be null (no department)
        result = await changeUserDepartment({
          adminId: currentUser.id,
          targetUserId,
          departmentId: value || null
        });
        break;

      case 'change_status':
        if (!value) {
          return res.status(400).json({ error: 'Status value is required' });
        }
        result = await updateUserStatus({
          adminId: currentUser.id,
          targetUserId,
          status: value
        });
        break;

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    return res.status(200).json({
      success: true,
      profile: result.data,
      message: `Action ${action} completed successfully`
    });
  } catch (error) {
    console.error('API admin actions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
