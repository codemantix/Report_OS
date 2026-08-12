import { getAuthenticatedUser, respondAuthFailure } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import {
  createManagedEvaluationPeriod,
  listEvaluationPeriods,
  transitionManagedEvaluationPeriod,
  updateManagedEvaluationPeriod,
} from '../../../lib/server/evaluation-periods/evaluationPeriodService';

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error('Evaluation period API error:', error, error.cause || '');
  return res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || (statusCode === 403
        ? 'EVALUATION_PERIOD_FORBIDDEN'
        : statusCode === 404
          ? 'EVALUATION_PERIOD_NOT_FOUND'
          : statusCode === 409
            ? 'EVALUATION_PERIOD_CONFLICT'
            : 'EVALUATION_PERIOD_ERROR'),
      message: statusCode >= 500 ? 'Evaluation periods could not be processed.' : error.message,
      fields: error.fields || null,
    },
  });
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    });
  }

  const currentUser = await getAuthenticatedUser(req, res);
  if (!currentUser) {
    return respondAuthFailure(res);
  }

  try {
    const supabaseAdmin = getAdminClient();
    let data;
    let message;

    if (req.method === 'GET') {
      data = await listEvaluationPeriods(supabaseAdmin, {
        departmentId: typeof req.query.departmentId === 'string' ? req.query.departmentId : null,
        status: typeof req.query.status === 'string' ? req.query.status : null,
        page: req.query.page,
        pageSize: req.query.pageSize,
      }, currentUser);
      message = 'Evaluation periods retrieved.';
    } else if (req.method === 'POST') {
      data = await createManagedEvaluationPeriod(supabaseAdmin, req.body || {}, currentUser);
      message = 'Draft evaluation period created.';
    } else if (req.method === 'PUT') {
      if (!req.body?.id) {
        return res.status(400).json({
          success: false,
          error: { code: 'EVALUATION_PERIOD_ID_REQUIRED', message: 'Evaluation period id is required.' },
        });
      }
      data = await updateManagedEvaluationPeriod(
        supabaseAdmin,
        req.body.id,
        req.body,
        currentUser
      );
      message = 'Draft evaluation period updated.';
    } else {
      if (!req.body?.id || !req.body?.status) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EVALUATION_PERIOD_TRANSITION_REQUIRED',
            message: 'Evaluation period id and next status are required.',
          },
        });
      }
      data = await transitionManagedEvaluationPeriod(
        supabaseAdmin,
        req.body.id,
        req.body.status,
        currentUser
      );
      message = 'Evaluation period status updated.';
    }

    return res.status(200).json({ success: true, data, message });
  } catch (error) {
    return sendError(res, error);
  }
}
