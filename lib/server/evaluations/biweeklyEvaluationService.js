import { randomUUID } from 'crypto';
import {
  calculateBiweeklyEvaluation,
  validatePerformanceBands,
} from '../../../utils/biweeklyEvaluationEngine';
import {
  assertEvaluationMutable,
  assertEvaluationPeriodCalculable,
  canCalculateEvaluation,
  canReadEvaluation,
  evaluationResponse,
  validateEvaluationContext,
} from './evaluationAccess';
import { calculateAndStoreAttendancePerformance } from './attendancePerformanceService';
import { calculateAndStoreReportingPerformance } from './reportingPerformanceService';
import { calculateAndStoreTaskPerformance } from './taskPerformanceService';
import { fetchEvaluationContext } from './taskPerformanceRepository';
import {
  beginEvaluationEngineRun,
  fetchEvaluationEngineConfig,
  fetchStoredEvaluationResult,
  saveEvaluationEngineResult,
} from './biweeklyEvaluationRepository';
import { buildEvaluationCalculationSnapshot } from './biweeklyEvaluationSnapshot';
import {
  buildMissingInputNotifications,
  dispatchEvaluationNotifications,
} from '../notifications/evaluationNotifier';

function formatStoredResult(evaluation, stored) {
  const isCentralCalculationComplete = stored.evaluation.calculation_status === 'complete';
  return {
    evaluation: {
      ...evaluationResponse(evaluation),
      overallScore: isCentralCalculationComplete ? stored.evaluation.overall_score : null,
      legacyOverallScore: stored.evaluation.calculation_status === 'not_calculated'
        ? stored.evaluation.overall_score
        : null,
      calculationStatus: stored.evaluation.calculation_status,
      calculationVersion: stored.evaluation.calculation_version,
      performanceBand: stored.evaluation.performance_band,
      calculatedStipendPercentage: stored.evaluation.calculated_stipend_percentage,
      stipendRecommendationMode: stored.evaluation.stipend_recommendation_mode,
      calculatedBy: stored.evaluation.calculated_by,
      calculatedAt: stored.evaluation.calculated_at,
    },
    componentScores: stored.componentScores,
    calculationSnapshot: stored.evaluation.calculation_snapshot,
    engineEffects: {
      changedEvaluationApprovalStatus: false,
      authorizedStipend: false,
      changedPaymentStatus: false,
      requiresSeparateHumanAuthorization: true,
    },
  };
}

export async function getBiweeklyEvaluation(supabaseAdmin, evaluationId, currentUser) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );
  if (!canReadEvaluation(currentUser, evaluation)) {
    const error = new Error('You do not have access to this employee evaluation.');
    error.statusCode = 403;
    throw error;
  }

  const stored = await fetchStoredEvaluationResult(supabaseAdmin, evaluation.id);
  return formatStoredResult(evaluation, stored);
}

export async function calculateAndStoreBiweeklyEvaluation(
  supabaseAdmin,
  evaluationId,
  currentUser
) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );
  if (!canCalculateEvaluation(currentUser, evaluation)) {
    const error = new Error('Only authorized management can calculate employee evaluations.');
    error.statusCode = 403;
    throw error;
  }
  assertEvaluationMutable(evaluation, 'Employee evaluation');
  assertEvaluationPeriodCalculable(evaluation, 'Employee evaluation');

  const config = await fetchEvaluationEngineConfig(supabaseAdmin, evaluation.weight_config_id);
  validatePerformanceBands(config.performance_band_config);
  const calculationStartedAt = new Date().toISOString();
  const calculationRunId = randomUUID();
  const engineRun = await beginEvaluationEngineRun(supabaseAdmin, {
    evaluationId: evaluation.id,
    calculatedBy: currentUser.id,
    calculatedAt: calculationStartedAt,
    calculationRunId,
  });

  const taskResult = await calculateAndStoreTaskPerformance(
    supabaseAdmin,
    evaluation.id,
    currentUser
  );
  const reportingResult = await calculateAndStoreReportingPerformance(
    supabaseAdmin,
    evaluation.id,
    currentUser
  );
  const attendanceResult = await calculateAndStoreAttendancePerformance(
    supabaseAdmin,
    evaluation.id,
    currentUser
  );
  const componentResults = [taskResult, reportingResult, attendanceResult];
  const componentScores = componentResults.map((result) => result.componentScore);
  const engineResult = calculateBiweeklyEvaluation(
    componentScores,
    config.performance_band_config
  );
  const calculatedAt = new Date().toISOString();
  const snapshot = buildEvaluationCalculationSnapshot({
    evaluation,
    config,
    componentResults,
    engineResult,
    calculatedAt,
    calculationRunId,
  });
  const savedEvaluation = await saveEvaluationEngineResult(supabaseAdmin, {
    evaluationId: evaluation.id,
    result: engineResult,
    snapshot,
    calculatedBy: currentUser.id,
    calculatedAt,
    calculationRunId,
    expectedRevision: Number(engineRun.calculation_revision) + 3,
  });

  // Notify the employee when required reporting or attendance inputs are
  // missing. Deduplicated per evaluation; failures never break the calculation.
  try {
    const missingNotifications = buildMissingInputNotifications(
      evaluation,
      reportingResult.breakdown,
      attendanceResult.breakdown
    );
    if (missingNotifications.length > 0) {
      await dispatchEvaluationNotifications(supabaseAdmin, missingNotifications);
    }
  } catch (error) {
    console.error('Missing-input notifications could not be dispatched:', error);
  }

  return formatStoredResult(evaluation, {
    evaluation: savedEvaluation,
    componentScores,
  });
}
