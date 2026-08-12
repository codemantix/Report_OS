import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getMyPerformance } from '../../../lib/server/my-performance/myPerformanceService';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return respondAuthFailure(res);
  try {
    const data = await getMyPerformance(getAdminClient(), req.query || {}, currentUser);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('My Performance API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'PERFORMANCE_FORBIDDEN'
          : status === 404 ? 'PERFORMANCE_NOT_FOUND'
            : status === 400 ? 'PERFORMANCE_VALIDATION_ERROR' : 'PERFORMANCE_ERROR',
        message: status >= 500 ? 'Your performance information could not be loaded.' : error.message,
      },
    });
  }
}
