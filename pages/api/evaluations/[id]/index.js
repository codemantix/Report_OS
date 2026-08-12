import { getAuthenticatedUser } from '../../../../lib/apiAuth';
import { getAdminClient } from '../../../../lib/supabaseAdmin';
import { getEvaluationDashboardDetail } from '../../../../lib/server/evaluation-dashboard/evaluationDashboardService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } });

  try {
    const data = await getEvaluationDashboardDetail(getAdminClient(), req.query.id, currentUser);
    return res.status(200).json({ success: true, data, message: 'Employee evaluation retrieved.' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Evaluation detail API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'EVALUATION_FORBIDDEN' : status === 404 ? 'EVALUATION_NOT_FOUND' : status === 400 ? 'INVALID_EVALUATION_ID' : 'EVALUATION_DETAIL_ERROR',
        message: status >= 500 ? 'Employee evaluation could not be loaded.' : error.message,
      },
    });
  }
}
