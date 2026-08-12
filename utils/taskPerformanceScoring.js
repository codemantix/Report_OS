export const TASK_PERFORMANCE_FORMULA_VERSION = 'task-performance-v1';

export const TASK_PERFORMANCE_DIMENSION_WEIGHTS = Object.freeze({
  statusOutcome: 35,
  deliverable: 25,
  kpi: 20,
  evidence: 15,
  managerReview: 5,
});

const STATUS_SCORES = Object.freeze({
  todo: 10,
  in_progress: 50,
  in_review: 75,
  completed: 100,
  blocked: 35,
  delayed: 25,
});

const PRIORITY_WEIGHTS = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
  critical: 4,
});

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function dateKey(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isDateWithin(value, startDate, endDate) {
  const key = dateKey(value);
  return Boolean(key && key >= startDate && key <= endDate);
}

export function taskFallsWithinEvaluationWindow(task, period) {
  if (!task || !period?.start_date || !period?.end_date) return false;

  const assignedDate = dateKey(task.assignment?.assignedAt);
  if (assignedDate && assignedDate > period.end_date) return false;

  const completionDate = dateKey(task.completed_at);
  if (
    isDateWithin(task.completed_at, period.start_date, period.end_date)
    && (!assignedDate || !completionDate || assignedDate <= completionDate)
  ) return true;

  const originalTaskStart = dateKey(task.start_date || task.created_at);
  const taskStart = assignedDate && originalTaskStart
    ? (assignedDate > originalTaskStart ? assignedDate : originalTaskStart)
    : assignedDate || originalTaskStart;
  const taskEnd = dateKey(task.due_date || task.completed_at);

  if (taskStart && taskEnd) {
    return taskStart <= period.end_date && taskEnd >= period.start_date;
  }

  if (taskEnd) return taskEnd >= period.start_date && taskEnd <= period.end_date;

  if (taskStart) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      return taskStart >= period.start_date && taskStart <= period.end_date;
    }
    return taskStart <= period.end_date;
  }

  return false;
}

function parseAttachments(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function reportProgress(reports) {
  const values = reports
    .map((report) => Number(report.completion_percentage))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? clamp(Math.max(...values)) : null;
}

function hasSubmissionNarrative(report) {
  return Boolean(
    report.worked_on?.trim()
    || report.completed_tasks?.trim()
    || report.additional_notes?.trim()
  );
}

function buildStatusScore(task, reasons) {
  const status = STATUS_SCORES[task.status] === undefined ? 'todo' : task.status;
  let score = STATUS_SCORES[status];
  reasons.push(`Task status “${task.status || 'unknown'}” contributes a ${score}/100 outcome baseline.`);

  if (task.status === 'completed' && task.due_date && task.completed_at) {
    const completedDate = dateKey(task.completed_at);
    const dueDate = dateKey(task.due_date);
    if (completedDate && dueDate && completedDate <= dueDate) {
      score = clamp(score + 3);
      reasons.push('Completion was on or before the due date.');
    } else if (completedDate && dueDate) {
      score = clamp(score - 8);
      reasons.push('Completion occurred after the due date.');
    }
  }

  if (task.status === 'delayed') {
    score = clamp(score - 5);
    reasons.push('The task is explicitly marked delayed.');
  }

  return score;
}

function buildDeliverableScore(task, reports, evidence, statusScore, reasons) {
  const expectedDeliverable = task.expected_output?.trim() || task.goal?.expected_deliverables?.trim();
  if (!expectedDeliverable) {
    reasons.push('No explicit expected deliverable is configured; a neutral 40/100 deliverable score is used.');
    return { score: 40, expectedDeliverable: null };
  }

  if (reports.length === 0) {
    const score = task.status === 'completed' ? 20 : round(statusScore * 0.55);
    reasons.push(
      task.status === 'completed'
        ? 'The task is completed but has no linked employee submission confirming the expected deliverable.'
        : 'No linked submission exists; deliverable progress is conservatively inferred from task status.'
    );
    return { score, expectedDeliverable };
  }

  const progress = reportProgress(reports);
  let score = progress === null ? statusScore : progress;

  if (task.status === 'completed') {
    if (evidence.attachmentCount === 0) {
      score = Math.min(score, 60);
      reasons.push('Completed task has no attached evidence; deliverable satisfaction is capped at 60.');
    }
    if (!evidence.reviewed) {
      score = Math.min(score, 75);
      reasons.push('Completed task has no reviewed submission; deliverable satisfaction is capped at 75.');
    }
    if (progress === 100 && evidence.attachmentCount > 0 && evidence.reviewed) {
      score = 100;
      reasons.push('A reviewed submission reports full completion and includes evidence for the expected deliverable.');
    }
  } else {
    reasons.push('Deliverable progress is based on the strongest linked report completion percentage.');
  }

  return { score: clamp(score), expectedDeliverable };
}

function buildKpiScore(task, reports, evidence, statusScore, reasons) {
  const kpi = task.goal?.success_metric?.trim() || null;
  if (!kpi) {
    reasons.push('No linked goal KPI is configured; a neutral 50/100 KPI score is used.');
    return { score: 50, kpi: null };
  }

  const progress = reportProgress(reports);
  if (progress === null) {
    const score = task.status === 'completed' ? 20 : round(statusScore * 0.5);
    reasons.push(
      task.status === 'completed'
        ? 'The task is completed, but no linked report provides measurable KPI progress.'
        : 'No report percentage is available; KPI progress is conservatively inferred from task status.'
    );
    return { score, kpi };
  }

  let score = progress;
  if (task.status === 'completed' && !evidence.reviewed) {
    score = Math.min(score, 75);
    reasons.push('Unreviewed KPI progress is capped at 75 even when the task is marked completed.');
  } else {
    reasons.push(`Linked report progress provides a measurable KPI proxy of ${progress}/100.`);
  }

  return { score: clamp(score), kpi };
}

function buildEvidenceScore(reports, evidence, reasons) {
  if (reports.length === 0) {
    reasons.push('No employee submission or evidence is linked to this task.');
    return 0;
  }

  let score = evidence.narrativeSubmissionCount > 0 ? 40 : 25;
  reasons.push(`${reports.length} linked submission${reports.length === 1 ? '' : 's'} found.`);

  if (evidence.attachmentCount > 0) {
    score = 75;
    reasons.push(`${evidence.attachmentCount} evidence attachment${evidence.attachmentCount === 1 ? '' : 's'} found.`);
  } else {
    reasons.push('No evidence attachments were found.');
  }

  if (evidence.reviewed) {
    score += 15;
    reasons.push('At least one linked submission was reviewed by management.');
  }

  if (evidence.managerFeedbackCount > 0) {
    score += 10;
    reasons.push('Manager feedback is attached to the task or its submissions.');
  }

  return clamp(score);
}

function buildManagerReviewScore(reports, evidence, reasons) {
  if (evidence.reviewed && evidence.managerFeedbackCount > 0) {
    reasons.push('Reviewed evidence includes explicit manager feedback.');
    return 100;
  }
  if (evidence.reviewed) {
    reasons.push('Submission review is recorded, but no explicit manager feedback is present.');
    return 80;
  }
  if (evidence.managerFeedbackCount > 0) {
    reasons.push('Manager feedback exists, but the linked submission is not marked reviewed.');
    return 65;
  }
  if (reports.length > 0) {
    reasons.push('Submission exists without a completed management review.');
    return 30;
  }
  reasons.push('No management review or feedback is available.');
  return 0;
}

function buildEvidenceSummary(reports, managerFeedback = []) {
  const attachments = reports.flatMap((report) => parseAttachments(report.attachments));
  const reportFeedback = reports.flatMap((report) => report.manager_feedback || []);
  const allFeedback = [...reportFeedback, ...managerFeedback];

  return {
    reportCount: reports.length,
    reportIds: reports.map((report) => report.id),
    attachmentCount: attachments.length,
    reviewed: reports.some((report) => report.reviewed === true),
    reviewedReportIds: reports.filter((report) => report.reviewed).map((report) => report.id),
    narrativeSubmissionCount: reports.filter(hasSubmissionNarrative).length,
    managerFeedbackCount: allFeedback.length,
    managerFeedback: allFeedback.slice(0, 5).map((feedback) => ({
      id: feedback.id,
      comment: String(feedback.comment || '').slice(0, 500),
      created_at: feedback.created_at || null,
      author: feedback.author || null,
      source: feedback.source || 'report',
    })),
  };
}

export function scoreTask(task) {
  const reasons = [];
  const reports = task.reports || [];
  const managerFeedback = task.manager_feedback || [];
  const evidence = buildEvidenceSummary(reports, managerFeedback);

  if (task.status === 'cancelled') {
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      includedInScore: false,
      exclusionReason: 'Cancelled tasks remain visible but do not reward or penalize task performance.',
      score: null,
      taskWeight: 0,
      reasons: ['Task is cancelled and excluded from the normalized denominator.'],
      evidence,
    };
  }

  const statusOutcome = buildStatusScore(task, reasons);
  const deliverable = buildDeliverableScore(task, reports, evidence, statusOutcome, reasons);
  const kpi = buildKpiScore(task, reports, evidence, statusOutcome, reasons);
  const evidenceScore = buildEvidenceScore(reports, evidence, reasons);
  const managerReview = buildManagerReviewScore(reports, evidence, reasons);

  const dimensions = {
    statusOutcome,
    deliverable: deliverable.score,
    kpi: kpi.score,
    evidence: evidenceScore,
    managerReview,
  };

  const score = round(
    (statusOutcome * TASK_PERFORMANCE_DIMENSION_WEIGHTS.statusOutcome
      + deliverable.score * TASK_PERFORMANCE_DIMENSION_WEIGHTS.deliverable
      + kpi.score * TASK_PERFORMANCE_DIMENSION_WEIGHTS.kpi
      + evidenceScore * TASK_PERFORMANCE_DIMENSION_WEIGHTS.evidence
      + managerReview * TASK_PERFORMANCE_DIMENSION_WEIGHTS.managerReview) / 100
  );

  return {
    taskId: task.id,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority || 'medium',
    includedInScore: true,
    score: clamp(score),
    taskWeight: PRIORITY_WEIGHTS[task.priority] || PRIORITY_WEIGHTS.medium,
    dimensions,
    expectedDeliverable: deliverable.expectedDeliverable,
    kpi: kpi.kpi,
    dueDate: task.due_date || null,
    completionDate: task.completed_at || null,
    assignment: task.assignment || null,
    weeklyPlan: task.plan || null,
    linkedGoal: task.goal || null,
    companyGoal: task.company_goal || null,
    evidence,
    reasons,
  };
}

export function calculateTaskPerformance(tasks, period) {
  const eligibleTasks = (tasks || []).filter((task) => taskFallsWithinEvaluationWindow(task, period));
  const taskBreakdown = eligibleTasks.map(scoreTask);
  const scoredTasks = taskBreakdown.filter((task) => task.includedInScore);
  const totalWeight = scoredTasks.reduce((sum, task) => sum + task.taskWeight, 0);
  const normalizedScore = totalWeight > 0
    ? round(scoredTasks.reduce((sum, task) => sum + task.score * task.taskWeight, 0) / totalWeight)
    : null;

  const tasksWithContribution = taskBreakdown.map((task) => ({
    ...task,
    normalizedContribution: task.includedInScore && totalWeight > 0
      ? round((task.score * task.taskWeight) / totalWeight)
      : 0,
  }));

  return {
    score: normalizedScore === null ? null : clamp(normalizedScore),
    formulaVersion: TASK_PERFORMANCE_FORMULA_VERSION,
    dimensionWeights: TASK_PERFORMANCE_DIMENSION_WEIGHTS,
    evaluationWindow: {
      startDate: period.start_date,
      endDate: period.end_date,
    },
    summary: {
      assignedTaskCount: (tasks || []).length,
      eligibleTaskCount: eligibleTasks.length,
      scoredTaskCount: scoredTasks.length,
      cancelledTaskCount: taskBreakdown.filter((task) => task.status === 'cancelled').length,
      completedTaskCount: taskBreakdown.filter((task) => task.status === 'completed').length,
      tasksWithSubmissions: taskBreakdown.filter((task) => task.evidence?.reportCount > 0).length,
      tasksWithEvidence: taskBreakdown.filter((task) => task.evidence?.attachmentCount > 0).length,
      reviewedTaskCount: taskBreakdown.filter((task) => task.evidence?.reviewed).length,
    },
    tasks: tasksWithContribution,
    scoringStatus: normalizedScore === null ? 'insufficient_data' : 'scored',
    noDataReason: normalizedScore === null
      ? 'No eligible non-cancelled assigned tasks exist in this evaluation period.'
      : null,
    safeguards: {
      missingEligibleTasksProduceZero: false,
      aiChangesOfficialTaskData: false,
      completedStatusGuaranteesMaximumScore: false,
      cancelledTasksIncludedInDenominator: false,
      sourceOfTruth: 'Existing tasks, task_assignees, reports, report review state, and manager comments.',
    },
  };
}
