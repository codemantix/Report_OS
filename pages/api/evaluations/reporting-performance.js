import { getAuthenticatedUser } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import {
  calculateAndStoreReportingPerformance,
  getReportingPerformance,
} from '../../../lib/server/evaluations/reportingPerformanceService';

function errorResponse(res, error) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    console.error('Reporting Performance API error:', error, error.cause || '');
  }
  return res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 403
        ? 'REPORTING_PERFORMANCE_FORBIDDEN'
        : statusCode === 404
          ? 'EVALUATION_NOT_FOUND'
          : statusCode === 409
            ? 'EVALUATION_STATE_CONFLICT'
            : 'REPORTING_PERFORMANCE_ERROR',
      message: statusCode >= 500
        ? 'Reporting Performance could not be processed.'
        : error.message,
    },
  });
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    });
  }

  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
    });
  }
  if (currentUser.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_INACTIVE', message: 'This account cannot access evaluations.' },
    });
  }

  const evaluationId = req.method === 'GET'
    ? req.query.evaluationId
    : req.body?.evaluationId;

  if (!evaluationId || typeof evaluationId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'EVALUATION_ID_REQUIRED', message: 'A valid evaluationId is required.' },
    });
  }

  try {
    const supabaseAdmin = getAdminClient();
    const data = req.method === 'POST'
      ? await calculateAndStoreReportingPerformance(supabaseAdmin, evaluationId, currentUser)
      : await getReportingPerformance(supabaseAdmin, evaluationId, currentUser);

    return res.status(200).json({
      success: true,
      data,
      message: req.method === 'POST'
        ? 'Reporting Performance calculated from existing reports and analyses.'
        : 'Reporting Performance retrieved.',
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
