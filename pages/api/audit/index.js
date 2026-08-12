import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { getAuditHistory } from '../../../lib/server/audit/auditService';

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
    const data = await getAuditHistory(getAdminClient(), {
      entityType: req.query.entityType,
      eventType: req.query.eventType,
      departmentId: req.query.departmentId,
      employeeId: req.query.employeeId,
      actorId: req.query.actorId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }, currentUser);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, data, message: 'Audit history retrieved.' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Audit history API error:', error, error.cause || '');
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'AUDIT_FORBIDDEN' : status === 400 ? 'INVALID_FILTERS' : 'AUDIT_ERROR',
        message: status >= 500 ? 'Audit history could not be loaded.' : error.message,
      },
    });
  }
}
