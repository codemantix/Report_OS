import { fetchGoals } from '../../../services/goalService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { department_id, status } = req.query;

    const { data, error } = await fetchGoals({
      department_id: department_id || undefined,
      status: status || undefined,
    });

    if (error) throw error;

    return res.status(200).json({ goals: data || [] });
  } catch (error) {
    console.error('Goals API error:', error);
    return res.status(500).json({ error: 'Failed to fetch goals' });
  }
}
