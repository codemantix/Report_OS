import { calculateAttendancePerformance } from '../../../utils/attendancePerformanceScoring';
import {
  assertEvaluationMutable,
  assertEvaluationPeriodCalculable,
  canCalculateEvaluation,
  canReadEvaluation,
  evaluationResponse,
  validateEvaluationContext,
} from './evaluationAccess';
import {
  fetchAttendancePerformanceSources,
  fetchEvaluationContext,
  fetchExistingAttendanceScore,
  saveAttendancePerformanceScore,
} from './attendancePerformanceRepository';

export async function getAttendancePerformance(supabaseAdmin, evaluationId, currentUser) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canReadEvaluation(currentUser, evaluation)) {
    const error = new Error('You do not have access to this Attendance Performance evaluation.');
    error.statusCode = 403;
    throw error;
  }

  const componentScore = await fetchExistingAttendanceScore(supabaseAdmin, evaluation.id);
  return {
    evaluation: evaluationResponse(evaluation),
    componentScore,
    breakdown: componentScore?.evidence_metrics || null,
  };
}

export async function calculateAndStoreAttendancePerformance(
  supabaseAdmin,
  evaluationId,
  currentUser
) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canCalculateEvaluation(currentUser, evaluation)) {
    const error = new Error('Only authorized management can calculate Attendance Performance.');
    error.statusCode = 403;
    throw error;
  }

  assertEvaluationMutable(evaluation, 'Attendance Performance');
  assertEvaluationPeriodCalculable(evaluation, 'Attendance Performance');

  const calculatedAt = new Date().toISOString();
  const { records, scoringConfig } = await fetchAttendancePerformanceSources(
    supabaseAdmin,
    evaluation
  );
  const breakdown = calculateAttendancePerformance(
    records,
    evaluation.period,
    scoringConfig.rules
  );
  const evidenceMetrics = {
    ...breakdown,
    generatedAt: calculatedAt,
    employeeId: evaluation.employee_id,
    departmentId: evaluation.department_id,
    evaluationId: evaluation.id,
    evaluationPeriodId: evaluation.evaluation_period_id,
    attendanceSource: 'attendance_records',
    periodSelectionBasis: 'employee, department, and attendance_date within inclusive period',
    includedReviewStatuses: ['confirmed', 'corrected'],
    scoringConfig,
  };

  const componentScore = await saveAttendancePerformanceScore(supabaseAdmin, {
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
