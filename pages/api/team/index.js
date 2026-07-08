import { getAuthenticatedUser } from '../../../lib/apiAuth';
import { getTeamMembersForCurrentUser } from '../../../services/userService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate user session
    const currentUser = await getAuthenticatedUser(req, res);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Extract query filters
    const filters = {};
    if (req.query.search) filters.search = req.query.search;
    if (req.query.department_id) filters.department_id = req.query.department_id;
    if (req.query.role) filters.role = req.query.role;
    if (req.query.status) filters.status = req.query.status;

    // 3. Fetch team members using role-based service
    const { data: members, error } = await getTeamMembersForCurrentUser(currentUser, filters);
    if (error) {
      return res.status(error.message?.includes('Unauthorized') ? 403 : 500).json({ error: error.message });
    }

    return res.status(200).json({ members: members || [] });
  } catch (error) {
    console.error('API team list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
