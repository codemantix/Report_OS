import { isUuid } from '../../../utils/evaluationPeriodValidation';
import { employeeSafeEvidenceMetrics } from '../../../utils/myPerformancePrivacy';
import {
  chooseCurrentPerformanceEvaluation,
  performanceDisplayResult,
} from '../../../utils/myPerformanceRules';
import { fetchEvaluationDetailSources } from '../evaluation-dashboard/evaluationDetailSourceService';
import {
  fetchCurrentDepartmentPeriod,
  fetchOwnEvaluation,
  fetchOwnEvaluations,
} from './myPerformanceRepository';

function performanceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safePerson(person) {
  return person ? {
    id: person.id,
    full_name: person.full_name || null,
    display_name: person.display_name || null,
  } : null;
}

function safeFeedback(feedback) {
  return {
    id: feedback.id,
    comment: feedback.comment,
    created_at: feedback.created_at,
    author: safePerson(feedback.author),
    source: feedback.source || null,
  };
}

function sanitizeTask(task) {
  return {
    id: task.id,
    title: task.title,
    expected_output: task.expected_output,
    priority: task.priority,
    status: task.status,
    start_date: task.start_date,
    due_date: task.due_date,
    completed_at: task.completed_at,
    goal: task.goal ? {
      id: task.goal.id,
      title: task.goal.title,
      success_metric: task.goal.success_metric,
      expected_deliverables: task.goal.expected_deliverables,
    } : null,
    plan: task.plan ? {
      id: task.plan.id,
      title: task.plan.title,
      start_date: task.plan.start_date,
      end_date: task.plan.end_date,
    } : null,
    reports: (task.reports || []).map((report) => ({
      id: report.id,
      task_id: report.task_id,
      project_name: report.project_name,
      completion_percentage: report.completion_percentage,
      attachments: report.attachments,
      reviewed: report.reviewed,
      submitted_at: report.submitted_at,
      manager_feedback: (report.manager_feedback || [])
        .filter((feedback) => feedback.visibility === 'employee_visible')
        .map(safeFeedback),
    })),
    manager_feedback: (task.manager_feedback || [])
      .filter((feedback) => feedback.visibility === 'employee_visible')
      .map(safeFeedback),
  };
}

function sanitizeReport(report) {
  return {
    id: report.id,
    task_id: report.task_id,
    project_name: report.project_name,
    report_type: report.report_type,
    worked_on: report.worked_on,
    completed_tasks: report.completed_tasks,
    pending_tasks: report.pending_tasks,
    blockers: report.blockers,
    support_needed: report.support_needed,
    completion_percentage: report.completion_percentage,
    attachments: report.attachments,
    reviewed: report.reviewed,
    reviewed_at: report.reviewed_at,
    submitted_at: report.submitted_at,
    task: report.task ? { id: report.task.id, title: report.task.title } : null,
    plan: report.plan ? { id: report.plan.id, title: report.plan.title } : null,
    goal: report.goal ? {
      id: report.goal.id,
      title: report.goal.title,
      success_metric: report.goal.success_metric,
      expected_deliverables: report.goal.expected_deliverables,
    } : null,
    manager_feedback: (report.manager_feedback || [])
      .filter((feedback) => feedback.visibility === 'employee_visible')
      .map(safeFeedback),
  };
}


function sanitizeComponentScores(scores) {
  return (scores || []).map((score) => ({
    id: score.id,
    component: score.component,
    raw_score: score.raw_score,
    weight: score.weight,
    weighted_score: score.weighted_score,
    calculation_method: score.calculation_method,
    calculation_version: score.calculation_version,
    evidence_metrics: employeeSafeEvidenceMetrics(score),
    source_cutoff_at: score.source_cutoff_at,
    calculated_at: score.calculated_at,
  }));
}

function currentRecommendation(evaluation) {
  return [...(evaluation.stipend_recommendations || [])]
    .filter((row) => ['recommended', 'approved'].includes(row.status))
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

function safeCompensationStatus(evaluation) {
  const recommendation = currentRecommendation(evaluation);
  if (!recommendation) return null;
  const payment = [...(recommendation.payment_records || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  return {
    stipend: {
      status: recommendation.status,
      recommendation_mode: recommendation.recommendation_mode,
      recommended_percentage: recommendation.recommended_percentage,
      recommended_amount: recommendation.recommended_amount,
      final_approved_amount: recommendation.final_approved_amount,
      currency: recommendation.currency,
      approved_at: recommendation.approved_at,
    },
    payment: payment ? {
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      payment_date: payment.payment_date,
      updated_at: payment.updated_at,
    } : null,
  };
}

function historyItem(evaluation) {
  const result = performanceDisplayResult(evaluation);
  return {
    id: evaluation.id,
    period: evaluation.period,
    status: evaluation.status,
    score: result.score,
    performance_band: result.performanceBand,
    result_type: result.resultType,
    calculated_at: evaluation.calculated_at,
    approved_at: evaluation.approved_at,
  };
}

export async function getMyPerformance(supabaseAdmin, query, currentUser) {
  if (!currentUser || currentUser.status !== 'active') {
    throw performanceError('An active employee account is required.', 403);
  }
  const requestedId = query?.evaluationId || null;
  if (requestedId && !isUuid(requestedId)) throw performanceError('Evaluation id is invalid.');

  const [evaluations, currentPeriod] = await Promise.all([
    fetchOwnEvaluations(supabaseAdmin, currentUser.id),
    fetchCurrentDepartmentPeriod(supabaseAdmin, currentUser.department_id),
  ]);
  const orderedEvaluations = [...evaluations].sort((a, b) => (
    String(b.period?.start_date || b.created_at || '')
      .localeCompare(String(a.period?.start_date || a.created_at || ''))
  ));
  const selected = requestedId
    ? await fetchOwnEvaluation(supabaseAdmin, currentUser.id, requestedId)
    : chooseCurrentPerformanceEvaluation(orderedEvaluations, currentPeriod);
  if (!selected) {
    return {
      currentPeriod,
      selectedEvaluation: null,
      history: [],
      sourceRecords: null,
      compensationStatus: null,
      selectionKind: 'none',
    };
  }

  const sourceRecords = await fetchEvaluationDetailSources(supabaseAdmin, selected);
  const safeSources = {
    tasks: (sourceRecords.tasks || []).map(sanitizeTask),
    reports: (sourceRecords.reports || []).map(sanitizeReport),
    attendance: (sourceRecords.attendance || []).map((record) => ({
      id: record.id,
      attendance_date: record.attendance_date,
      meeting_session: record.meeting_session,
      attendance_type: record.attendance_type,
      attendance_status: record.attendance_status,
      review_status: record.review_status,
      notes: record.notes,
      recorded_at: record.recorded_at,
    })),
    warnings: sourceRecords.warnings || [],
    sourceOfTruth: sourceRecords.sourceOfTruth,
  };
  const employeeVisibleComments = (selected.review_comments || [])
    .filter((comment) => comment.visibility === 'employee_visible')
    .map((comment) => ({
      id: comment.id,
      comment: comment.body,
      created_at: comment.created_at,
      author: safePerson(comment.author),
      source: 'evaluation_review',
    }));

  return {
    currentPeriod,
    selectedEvaluation: {
      id: selected.id,
      employee_id: selected.employee_id,
      department_id: selected.department_id,
      status: selected.status,
      calculation_status: selected.calculation_status,
      overall_score: selected.overall_score,
      performance_band: selected.performance_band,
      approved_score: selected.approved_score,
      approved_performance_band: selected.approved_performance_band,
      calculated_stipend_percentage: selected.calculated_stipend_percentage,
      approved_stipend_percentage: selected.approved_stipend_percentage,
      approved_stipend_mode: selected.approved_stipend_mode,
      current_approval_status: selected.current_approval_status,
      period: selected.period,
      component_scores: sanitizeComponentScores(selected.component_scores),
      employee_visible_comments: employeeVisibleComments,
    },
    history: orderedEvaluations.map(historyItem),
    sourceRecords: safeSources,
    compensationStatus: safeCompensationStatus(selected),
    selectionKind: currentPeriod && selected.evaluation_period_id === currentPeriod.id
      ? 'current' : 'historical',
  };
}
