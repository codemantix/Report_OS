import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import {
  getStipendManagement,
  manageStipendRecommendation,
} from '../../../lib/server/stipends/stipendService';

function sendError(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error('Stipend management API error:', error, error.cause || '');
  return res.status(status).json({
    success: false,
    error: {
      code: status === 403 ? 'STIPEND_FORBIDDEN'
        : status === 409 ? 'STIPEND_CONFLICT'
          : status === 400 ? 'STIPEND_VALIDATION_ERROR' : 'STIPEND_ERROR',
      message: status >= 500 ? 'Stipend management request could not be completed.' : error.message,
      fields: error.fields || null,
    },
  });
}

export default async function handler(req, res) {
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return respondAuthFailure(res);
  try {
    if (req.method === 'GET') {
      const data = await getStipendManagement(getAdminClient(), req.query || {}, currentUser);
      return res.status(200).json({ success: true, data });
    }
    if (req.method === 'POST') {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ success: false, error: { code: 'STIPEND_VALIDATION_ERROR', message: 'A valid request body is required.' } });
      }
      const id = await manageStipendRecommendation(getAdminClient(), req.body, currentUser);
      return res.status(200).json({ success: true, data: { id }, message: 'Stipend recommendation action recorded.' });
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  } catch (error) {
    return sendError(res, error);
  }
}
