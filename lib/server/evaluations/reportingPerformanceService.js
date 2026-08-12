import { calculateReportingPerformance } from '../../../utils/reportingPerformanceScoring';
import {
  assertEvaluationMutable,
  assertEvaluationPeriodCalculable,
  canCalculateEvaluation,
  canReadEvaluation,
  evaluationResponse,
  validateEvaluationContext,
} from './evaluationAccess';
import {
  fetchEvaluationContext,
  fetchExistingReportingScore,
  fetchReportingPerformanceSources,
  saveReportingPerformanceScore,
} from './reportingPerformanceRepository';

export async function getReportingPerformance(supabaseAdmin, evaluationId, currentUser) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canReadEvaluation(currentUser, evaluation)) {
    const error = new Error('You do not have access to this Reporting Performance evaluation.');
    error.statusCode = 403;
    throw error;
  }

  const componentScore = await fetchExistingReportingScore(supabaseAdmin, evaluation.id);
  return {
    evaluation: evaluationResponse(evaluation),
    componentScore,
    breakdown: componentScore?.evidence_metrics || null,
  };
}

export async function calculateAndStoreReportingPerformance(
  supabaseAdmin,
  evaluationId,
  currentUser
) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canCalculateEvaluation(currentUser, evaluation)) {
    const error = new Error('Only authorized management can calculate Reporting Performance.');
    error.statusCode = 403;
    throw error;
  }

  assertEvaluationMutable(evaluation, 'Reporting Performance');
  assertEvaluationPeriodCalculable(evaluation, 'Reporting Performance');

  const calculatedAt = new Date().toISOString();
  const { reports, timingBasis, queryEndDate } = await fetchReportingPerformanceSources(
    supabaseAdmin,
    evaluation
  );
  const breakdown = calculateReportingPerformance(reports, evaluation.period);
  const evidenceMetrics = {
    ...breakdown,
    generatedAt: calculatedAt,
    employeeId: evaluation.employee_id,
    departmentId: evaluation.department_id,
    evaluationId: evaluation.id,
    evaluationPeriodId: evaluation.evaluation_period_id,
    reportSource: 'reports',
    aiAnalysisSource: 'existing report_ai_analysis only',
    managerFeedbackSource: 'admin_comments',
    submissionTimingBasis: timingBasis,
    queriedThroughDate: queryEndDate,
    aiUsage: {
      reusedExistingAnalysis: true,
      createdNewAnalysis: false,
      modifiedReportsOrAnalysis: false,
    },
  };

  const componentScore = await saveReportingPerformanceScore(supabaseAdmin, {
    evaluationId: evaluation.id,
    score: breakdown.score,
    evidenceMetrics,
    calculatedBy: currentUser.id,
    calculatedAt,
  });

  return {
    evaluation: evaluationResponse(evaluation),
    componentScore,
    breakdown: evidenceMetrics,
  };
}
