import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getEvaluationDashboard } from '../../../lib/server/evaluation-dashboard/evaluationDashboardService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return respondAuthFailure(res);

  try {
    const data = await getEvaluationDashboard(getAdminClient(), {
      periodId: req.query.periodId,
      departmentId: req.query.departmentId,
      employeeId: req.query.employeeId,
      performanceBand: req.query.performanceBand,
      approvalStatus: req.query.approvalStatus,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }, currentUser);
    return res.status(200).json({ success: true, data, message: 'Evaluation dashboard retrieved.' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Evaluation dashboard API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'EVALUATION_DASHBOARD_FORBIDDEN' : status === 400 ? 'INVALID_FILTERS' : 'EVALUATION_DASHBOARD_ERROR',
        message: status >= 500 ? 'Evaluation dashboard could not be loaded.' : error.message,
      },
    });
  }
}
