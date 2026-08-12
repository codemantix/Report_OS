import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getManagementAnalytics } from '../../../lib/server/management-analytics/managementAnalyticsService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) {
    return respondAuthFailure(res);
  }

  try {
    const data = await getManagementAnalytics(getAdminClient(), {
      periodId: req.query.periodId,
      departmentId: req.query.departmentId,
      employeeId: req.query.employeeId,
      performanceBand: req.query.performanceBand,
    }, currentUser);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, data, message: 'Management analytics retrieved.' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Management analytics API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'MANAGEMENT_ANALYTICS_FORBIDDEN' : status === 400 ? 'INVALID_FILTERS' : 'MANAGEMENT_ANALYTICS_ERROR',
        message: status >= 500 ? 'Management analytics could not be loaded.' : error.message,
      },
    });
  }
}
