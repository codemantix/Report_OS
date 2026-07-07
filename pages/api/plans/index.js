import { fetchPlans } from '../../../services/planService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { department_id, plan_type } = req.query;

    const { data, error } = await fetchPlans({
      department_id: department_id || undefined,
      plan_type: plan_type || undefined,
    });

    if (error) throw error;

    return res.status(200).json({ plans: data || [] });
  } catch (error) {
    console.error('Plans API error:', error);
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
}
