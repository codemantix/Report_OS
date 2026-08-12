import { randomUUID } from 'crypto';
import { classifyPerformanceBand } from '../../../utils/biweeklyEvaluationEngine';
import { isUuid } from '../../../utils/evaluationPeriodValidation';
import {
  reviewPermissions,
  validateEvaluationReviewInput,
} from '../../../utils/evaluationReviewRules';
import {
  fetchEvaluationDetail,
  saveEvaluationReviewDecision,
} from './evaluationDashboardRepository';
import {
  buildEmployeeEvaluationNotification,
  buildReadyForReviewNotifications,
  dispatchEvaluationNotifications,
} from '../notifications/evaluationNotifier';
import { EVALUATION_NOTIFICATION_TYPES } from '../../../utils/evaluationNotificationRules';

function reviewError(message, statusCode = 400, fields = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.fields = fields;
  return error;
}

export function evaluationReviewPermissions(currentUser, evaluation) {
  return reviewPermissions(currentUser, evaluation);
}

export async function reviewEmployeeEvaluation(
  supabaseAdmin,
  evaluationId,
  input,
  currentUser
) {
  if (!isUuid(evaluationId)) throw reviewError('Evaluation id is invalid.');
  const evaluation = await fetchEvaluationDetail(supabaseAdmin, evaluationId);
  const permissions = evaluationReviewPermissions(currentUser, evaluation);
  const requestedDecision = input && typeof input === 'object' ? input.decision : null;
  const permissionKey = requestedDecision === 'feedback'
    ? 'canFeedback'
    : requestedDecision === 'return'
      ? 'canReturn'
      : 'canApprove';
  if (!permissions[permissionKey]) {
    throw reviewError('You are not authorized for this evaluation review action.', 403);
  }

  let validated;
  try {
    validated = validateEvaluationReviewInput(input, evaluation, classifyPerformanceBand);
  } catch (error) {
    throw reviewError(error.message, 400, error.fields || null);
  }

  const result = await saveEvaluationReviewDecision(supabaseAdmin, {
    p_evaluation_id: evaluation.id,
    p_decision: validated.decision,
    p_reviewer_id: currentUser.id,
    p_final_score: validated.finalScore ?? null,
    p_final_band: validated.finalBand ?? null,
    p_final_stipend_percentage: validated.finalStipendPercentage ?? null,
    p_final_stipend_mode: validated.finalStipendMode ?? null,
    p_feedback: validated.feedback || null,
    p_adjustment_reason: validated.adjustmentReason || null,
    p_request_id: randomUUID(),
  });

  // Notifications are advisory and never affect the review outcome. Each send
  // is deduplicated and failures are logged, so a delivery error cannot break
  // the review response.
  try {
    const refreshedEvaluation = await fetchEvaluationDetail(supabaseAdmin, evaluation.id);
    await dispatchReviewNotifications(
      supabaseAdmin,
      refreshedEvaluation || evaluation,
      result,
      currentUser,
      validated.feedback
    );
  } catch (error) {
    console.error('Review notifications could not be dispatched:', error);
  }

  return result;
}

async function dispatchReviewNotifications(supabaseAdmin, evaluation, result, currentUser, feedback) {
  const decision = result?.decision;
  const notifications = [];

  if (decision === 'approve' && result?.finalized) {
    notifications.push(buildEmployeeEvaluationNotification(
      EVALUATION_NOTIFICATION_TYPES.approved,
      evaluation,
      evaluation.approved_score !== null && evaluation.approved_score !== undefined
        ? `Approved score: ${evaluation.approved_score}.`
        : ''
    ));
  } else if (decision === 'return') {
    notifications.push(buildEmployeeEvaluationNotification(
      EVALUATION_NOTIFICATION_TYPES.returnedForReview,
      evaluation,
      feedback ? `Reviewer feedback: ${feedback}` : ''
    ));
  } else if (decision === 'approve' && result?.approvalStatus === 'pending') {
    // Evaluation (or the next approval stage) is now awaiting a reviewer.
    const readyNotifications = await buildReadyForReviewNotifications(
      supabaseAdmin,
      evaluation,
      { excludeUserId: currentUser.id }
    );
    notifications.push(...readyNotifications);
  }

  if (notifications.length > 0) {
    await dispatchEvaluationNotifications(supabaseAdmin, notifications);
  }
}
