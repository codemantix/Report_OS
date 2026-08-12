import { getAuthenticatedUser } from '../../../../lib/apiAuth';
import { getAdminClient } from '../../../../lib/supabaseAdmin';
import { reviewEmployeeEvaluation } from '../../../../lib/server/evaluation-dashboard/evaluationReviewService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } });
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        error: { code: 'REVIEW_VALIDATION_ERROR', message: 'A valid review request body is required.' },
      });
    }
    const data = await reviewEmployeeEvaluation(getAdminClient(), req.query.id, req.body, currentUser);
    return res.status(200).json({
      success: true,
      data,
      message: data.finalized ? 'Final evaluation approval recorded.' : 'Evaluation review action recorded.',
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Evaluation review API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'REVIEW_FORBIDDEN' : status === 409 ? 'REVIEW_CONFLICT' : status === 400 ? 'REVIEW_VALIDATION_ERROR' : 'REVIEW_ERROR',
        message: status >= 500 ? 'Evaluation review action could not be completed.' : error.message,
        fields: error.fields || null,
      },
    });
  }
}
