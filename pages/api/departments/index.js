import { fetchDepartments } from '../../../services/departmentService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await fetchDepartments();

    if (error) throw error;

    return res.status(200).json({ departments: data || [] });
  } catch (error) {
    console.error('Departments API error:', error);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
}
