import { calculateTaskPerformance } from '../../../utils/taskPerformanceScoring';
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
  fetchExistingTaskScore,
  fetchTaskPerformanceSources,
  saveTaskPerformanceScore,
} from './taskPerformanceRepository';

export async function getTaskPerformance(supabaseAdmin, evaluationId, currentUser) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canReadEvaluation(currentUser, evaluation)) {
    const error = new Error('You do not have access to this Task Performance evaluation.');
    error.statusCode = 403;
    throw error;
  }

  const componentScore = await fetchExistingTaskScore(supabaseAdmin, evaluation.id);
  return {
    evaluation: evaluationResponse(evaluation),
    componentScore,
    breakdown: componentScore?.evidence_metrics || null,
  };
}

export async function calculateAndStoreTaskPerformance(
  supabaseAdmin,
  evaluationId,
  currentUser
) {
  const evaluation = validateEvaluationContext(
    await fetchEvaluationContext(supabaseAdmin, evaluationId)
  );

  if (!canCalculateEvaluation(currentUser, evaluation)) {
    const error = new Error('Only authorized management can calculate Task Performance.');
    error.statusCode = 403;
    throw error;
  }

  assertEvaluationMutable(evaluation, 'Task Performance');
  assertEvaluationPeriodCalculable(evaluation, 'Task Performance');

  const calculatedAt = new Date().toISOString();
  const { tasks, warnings } = await fetchTaskPerformanceSources(supabaseAdmin, evaluation);
  const breakdown = calculateTaskPerformance(tasks, evaluation.period);
  const evidenceMetrics = {
    ...breakdown,
    generatedAt: calculatedAt,
    employeeId: evaluation.employee_id,
    departmentId: evaluation.department_id,
    evaluationId: evaluation.id,
    evaluationPeriodId: evaluation.evaluation_period_id,
    taskAssignmentSource: 'task_assignees',
    taskSource: 'tasks',
    submissionSource: 'reports with report_tasks legacy fallback',
    managerFeedbackSource: 'admin_comments and manager-authored task_comments',
    sourceWarnings: warnings,
    aiUsage: {
      usedForScore: false,
      modifiedOfficialTaskData: false,
    },
  };

  const componentScore = await saveTaskPerformanceScore(supabaseAdmin, {
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
