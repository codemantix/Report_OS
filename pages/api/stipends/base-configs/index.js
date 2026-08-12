import { getAuthenticatedUser } from '../../../../lib/apiAuth';
import { getAdminClient } from '../../../../lib/supabaseAdmin';
import { saveBaseStipendConfig } from '../../../../lib/server/stipends/stipendService';

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', ['POST', 'PATCH']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }
  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } });
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: { code: 'STIPEND_CONFIG_VALIDATION_ERROR', message: 'A valid request body is required.' } });
    }
    const data = await saveBaseStipendConfig(
      getAdminClient(),
      req.body,
      currentUser,
      req.method === 'PATCH' ? 'update' : 'create'
    );
    return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data, message: 'Base stipend configuration saved.' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Base stipend configuration API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'STIPEND_CONFIG_FORBIDDEN'
          : status === 409 ? 'STIPEND_CONFIG_CONFLICT'
            : status === 400 ? 'STIPEND_CONFIG_VALIDATION_ERROR' : 'STIPEND_CONFIG_ERROR',
        message: status >= 500 ? 'Base stipend configuration could not be saved.' : error.message,
      },
    });
  }
}
