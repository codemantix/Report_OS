export const REVIEW_TEXT_LIMIT = 5000;

function reviewValidationError(message, fields = null) {
  const error = new Error(message);
  error.fields = fields;
  return error;
}

function optionalNumber(value, fallback, field, precision) {
  if (value === '' || value === null || value === undefined) return Number(fallback);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw reviewValidationError(`${field} must be between 0 and 100.`, {
      [field]: 'Enter a value from 0 to 100.',
    });
  }
  return Number(parsed.toFixed(precision));
}

export function currentReviewRound(evaluation) {
  return [...(evaluation?.review_rounds || [])]
    .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0))[0] || null;
}

export function currentApprovalStage(evaluation) {
  const currentRound = currentReviewRound(evaluation);
  const approvals = (evaluation?.approvals || []).filter((approval) => (
    !currentRound || !approval.review_round_id || approval.review_round_id === currentRound.id
  ));
  return approvals.find((approval) => approval.status === 'pending')
    || [...approvals].sort((a, b) => Number(b.sequence_number || 0) - Number(a.sequence_number || 0))[0]
    || null;
}

export function reviewPermissions(currentUser, evaluation) {
  const activeManager = currentUser?.status === 'active'
    && ['admin', 'department_lead'].includes(currentUser.role)
    && currentUser.id !== evaluation?.employee_id
    && (currentUser.role === 'admin'
      || (currentUser.department_id && currentUser.department_id === evaluation?.department_id));
  const complete = evaluation?.calculation_status === 'complete' && evaluation?.overall_score !== null;
  const open = !['approved', 'finalized', 'cancelled'].includes(evaluation?.status);
  const stage = currentApprovalStage(evaluation);
  const assigned = !stage?.assigned_approver_id || stage.assigned_approver_id === currentUser?.id;
  const stageRoleAllowed = !stage
    || stage.approval_stage === 'department'
    || currentUser?.role === 'admin';
  const canDecide = Boolean(activeManager && complete && open && assigned && stageRoleAllowed);

  return {
    canReview: Boolean(activeManager),
    canFeedback: Boolean(activeManager),
    canReturn: canDecide,
    canApprove: canDecide,
    isOwnEvaluation: currentUser?.id === evaluation?.employee_id,
    currentStage: stage?.approval_stage || null,
    assignedToCurrentUser: Boolean(stage?.assigned_approver_id === currentUser?.id),
  };
}

export function validateEvaluationReviewInput(input, evaluation, classifyBand) {
  const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const decision = payload.decision;
  if (!['feedback', 'return', 'approve'].includes(decision)) {
    throw reviewValidationError('Decision must be feedback, return, or approve.');
  }

  const feedback = typeof payload.feedback === 'string' ? payload.feedback.trim() : '';
  const adjustmentReason = typeof payload.adjustmentReason === 'string'
    ? payload.adjustmentReason.trim()
    : '';
  if (feedback.length > REVIEW_TEXT_LIMIT) {
    throw reviewValidationError(`Feedback must be ${REVIEW_TEXT_LIMIT} characters or fewer.`, {
      feedback: 'Feedback is too long.',
    });
  }
  if (adjustmentReason.length > REVIEW_TEXT_LIMIT) {
    throw reviewValidationError(`Adjustment reason must be ${REVIEW_TEXT_LIMIT} characters or fewer.`, {
      adjustmentReason: 'Adjustment reason is too long.',
    });
  }
  if (decision !== 'approve' && !feedback) {
    throw reviewValidationError(
      decision === 'return' ? 'A reason is required when returning an evaluation.' : 'Feedback is required.',
      { feedback: decision === 'return' ? 'Enter a return reason.' : 'Enter reviewer feedback.' }
    );
  }
  if (decision !== 'approve') {
    return { decision, feedback, adjustmentReason: null };
  }

  if (evaluation.calculation_status !== 'complete' || evaluation.overall_score === null) {
    throw reviewValidationError('A complete calculated evaluation is required before approval.');
  }
  const round = currentReviewRound(evaluation);
  const basisScore = round?.proposed_score ?? evaluation.overall_score;
  const basisStipend = round?.proposed_stipend_percentage ?? evaluation.calculated_stipend_percentage;
  const basisMode = round?.proposed_stipend_mode ?? evaluation.stipend_recommendation_mode;
  const finalScore = optionalNumber(payload.finalScore, basisScore, 'finalScore', 3);
  if (!['percentage', 'manual'].includes(payload.stipendMode)) {
    throw reviewValidationError('Stipend mode must be percentage or manual.', {
      stipendMode: 'Choose a valid stipend decision.',
    });
  }
  const finalStipendMode = payload.stipendMode;
  const finalStipendPercentage = finalStipendMode === 'manual'
    ? null
    : optionalNumber(payload.finalStipendPercentage, basisStipend, 'finalStipendPercentage', 2);
  const band = classifyBand(finalScore, evaluation.weight_config?.performance_band_config);
  const stage = currentApprovalStage(evaluation);
  const linkedRecommendation = (evaluation.stipend_recommendations || []).find((recommendation) => (
    recommendation.id === stage?.stipend_recommendation_id
  )) || (evaluation.stipend_recommendations || []).find((recommendation) => recommendation.status === 'recommended');
  if (linkedRecommendation && (
    finalStipendMode !== linkedRecommendation.recommendation_mode
    || (finalStipendMode === 'percentage'
      && finalStipendPercentage !== Number(linkedRecommendation.recommended_percentage))
  )) {
    throw reviewValidationError(
      'Revise the linked monetary recommendation before changing its stipend percentage or mode.',
      { finalStipendPercentage: 'This value must match the linked monetary recommendation.' }
    );
  }

  const changed = finalScore !== Number(basisScore)
    || finalStipendPercentage !== (basisStipend === null ? null : Number(basisStipend))
    || finalStipendMode !== basisMode;
  if (changed && !adjustmentReason) {
    throw reviewValidationError('A reason is required for every score or stipend adjustment.', {
      adjustmentReason: 'Explain why the current human-reviewed proposal is being adjusted.',
    });
  }

  return {
    decision,
    feedback: feedback || null,
    adjustmentReason: adjustmentReason || null,
    finalScore,
    finalBand: band.label,
    finalStipendPercentage,
    finalStipendMode,
  };
}
