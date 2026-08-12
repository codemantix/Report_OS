export const REPORTING_PERFORMANCE_FORMULA_VERSION = 'reporting-performance-v1';

export const REPORTING_PERFORMANCE_DIMENSION_WEIGHTS = Object.freeze({
  submissionCompliance: 25,
  completeness: 15,
  alignment: 25,
  progress: 15,
  qualityEvidence: 15,
  managerReviewRisk: 5,
});

const GRACE_DAYS = 2;

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function average(values, fallback = 0) {
  const numeric = values
    .map(Number)
    .filter((value) => Number.isFinite(value));
  return numeric.length > 0
    ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length
    : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function addDays(dateValue, days) {
  const date = parseDate(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(startDate, endDate) {
  const start = parseDate(`${startDate}T00:00:00.000Z`);
  const end = parseDate(`${endDate}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
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

function latestAnalysis(report) {
  const analyses = Array.isArray(report.analysis)
    ? report.analysis
    : report.analysis
      ? [report.analysis]
      : [];
  const eligible = analyses.filter((analysis) => (
    analysis.status !== 'pending'
    && [
      analysis.task_alignment_score,
      analysis.goal_alignment_score,
      analysis.progress_score,
      analysis.report_quality_score,
      analysis.success_rate,
    ].some((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
  ));
  return [...eligible].sort((a, b) => (
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ))[0] || null;
}

export function classifyReportingScore(score) {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Average';
  return 'Poor';
}

function reportWorkflowClassification(report, analysis, submittedAfterPeriod = false) {
  if (
    submittedAfterPeriod
    || analysis?.risk_level === 'high'
    || analysis?.status === 'at_risk'
  ) return 'Delayed';
  if (!report.reviewed || report.ai_status !== 'completed' || !analysis) return 'Needs Review';
  return 'On Track';
}

function scoreCompleteness(report) {
  const checks = [
    { key: 'worked_on', weight: 25, present: Boolean(report.worked_on?.trim()) },
    { key: 'completed_tasks', weight: 15, present: Boolean(report.completed_tasks?.trim()) },
    { key: 'pending_tasks', weight: 10, present: Boolean(report.pending_tasks?.trim()) },
    {
      key: 'blockers_or_support',
      weight: 10,
      present: Boolean(report.blockers?.trim() || report.support_needed?.trim()),
    },
    { key: 'hours_worked', weight: 10, present: Number.isFinite(Number(report.hours_worked)) },
    {
      key: 'completion_percentage',
      weight: 15,
      present: Number.isFinite(Number(report.completion_percentage)),
    },
    { key: 'additional_notes', weight: 15, present: Boolean(report.additional_notes?.trim()) },
  ];

  return {
    score: checks.reduce((sum, check) => sum + (check.present ? check.weight : 0), 0),
    fields: checks,
    missingFields: checks.filter((check) => !check.present).map((check) => check.key),
  };
}

function metricValue(value, fallback) {
  return value === null || value === undefined ? fallback : clamp(value);
}

function scoreAlignment(report, analysis) {
  const metrics = {
    taskAlignment: metricValue(analysis?.task_alignment_score, report.task_id ? 60 : 40),
    weeklyPlanAlignment: report.plan_id ? 100 : 40,
    departmentGoalAlignment: metricValue(analysis?.goal_alignment_score, report.goal_id ? 60 : 40),
    companyGoalAlignment: metricValue(
      analysis?.company_goal_alignment_score,
      report.company_goal_id ? 60 : 40
    ),
    expectedDeliverableKpiAlignment: metricValue(
      analysis?.expected_outcome_progress_score,
      report.goal_id || report.task_id ? 55 : 40
    ),
  };

  const score = (
    metrics.taskAlignment * 0.25
    + metrics.weeklyPlanAlignment * 0.10
    + metrics.departmentGoalAlignment * 0.25
    + metrics.companyGoalAlignment * 0.20
    + metrics.expectedDeliverableKpiAlignment * 0.20
  );

  return { score: round(score), metrics };
}

function scoreProgress(report, analysis) {
  const selfReportedProgress = Number.isFinite(Number(report.completion_percentage))
    ? clamp(report.completion_percentage)
    : null;
  const metrics = [
    analysis?.progress_score,
    analysis?.task_progress_score,
    analysis?.success_rate,
    selfReportedProgress,
  ].filter((value) => value !== null && value !== undefined);

  return {
    score: round(average(metrics, selfReportedProgress ?? 0)),
    metrics: {
      progress: analysis?.progress_score ?? null,
      taskProgress: analysis?.task_progress_score ?? null,
      successRate: analysis?.success_rate ?? null,
      selfReportedProgress,
    },
  };
}

function scoreQualityEvidence(report, analysis, completeness) {
  const attachments = parseAttachments(report.attachments);
  const evidenceScore = attachments.length > 0 ? 100 : 30;
  const qualityScore = analysis?.report_quality_score;
  const score = qualityScore === null || qualityScore === undefined
    ? completeness.score * 0.70 + evidenceScore * 0.30
    : clamp(qualityScore) * 0.60 + evidenceScore * 0.40;

  return {
    score: round(score),
    qualityScore: qualityScore ?? null,
    evidenceScore,
    attachmentCount: attachments.length,
  };
}

function scoreManagerReviewRisk(report, analysis) {
  const feedback = report.manager_feedback || [];
  let score = report.reviewed ? 80 : feedback.length > 0 ? 60 : 25;
  const reasons = [];

  if (report.reviewed && feedback.length > 0) {
    score = 100;
    reasons.push('Management review includes explicit feedback.');
  } else if (report.reviewed) {
    reasons.push('Management review is recorded without written feedback.');
  } else if (feedback.length > 0) {
    reasons.push('Manager feedback exists, but the report is not marked reviewed.');
  } else {
    reasons.push('No completed manager review or feedback is available.');
  }

  if (analysis?.risk_level === 'high') {
    score -= 30;
    reasons.push('Existing AI analysis classifies this report as high risk.');
  } else if (analysis?.risk_level === 'medium') {
    score -= 10;
    reasons.push('Existing AI analysis classifies this report as medium risk.');
  }

  if (analysis?.status === 'at_risk') {
    score -= 10;
    reasons.push('Existing AI analysis classifies report status as at risk.');
  }

  return {
    score: clamp(score),
    reviewed: report.reviewed === true,
    feedbackCount: feedback.length,
    riskLevel: analysis?.risk_level || null,
    analysisStatus: analysis?.status || null,
    reasons,
  };
}

export function scoreReport(report, period) {
  const analysis = latestAnalysis(report);
  const completeness = scoreCompleteness(report);
  const alignment = scoreAlignment(report, analysis);
  const progress = scoreProgress(report, analysis);
  const qualityEvidence = scoreQualityEvidence(report, analysis, completeness);
  const managerReviewRisk = scoreManagerReviewRisk(report, analysis);
  const submittedAfterPeriod = dateKey(report.submitted_at) > period.end_date;

  const score = round(
    completeness.score * 0.20
    + alignment.score * 0.30
    + progress.score * 0.20
    + qualityEvidence.score * 0.20
    + managerReviewRisk.score * 0.10
  );

  const reasons = [
    `${completeness.fields.filter((field) => field.present).length}/${completeness.fields.length} report completeness fields are present.`,
    analysis
      ? 'Existing AI analysis supplies alignment, progress, quality, success, and risk inputs.'
      : 'No completed AI analysis exists; deterministic linkage and report-content fallbacks are used.',
    qualityEvidence.attachmentCount > 0
      ? `${qualityEvidence.attachmentCount} evidence attachment${qualityEvidence.attachmentCount === 1 ? '' : 's'} found.`
      : 'No report evidence attachment was found.',
    ...managerReviewRisk.reasons,
  ];

  return {
    reportId: report.id,
    title: report.project_name || 'Untitled report',
    reportType: report.report_type,
    submittedAt: report.submitted_at,
    submittedAfterPeriod,
    classification: classifyReportingScore(score),
    workflowClassification: reportWorkflowClassification(report, analysis, submittedAfterPeriod),
    score: clamp(score),
    dimensions: {
      completeness: completeness.score,
      alignment: alignment.score,
      progress: progress.score,
      qualityEvidence: qualityEvidence.score,
      managerReviewRisk: managerReviewRisk.score,
    },
    completeness,
    alignment,
    progress,
    qualityEvidence,
    managerReviewRisk,
    existingAnalysis: analysis ? {
      id: analysis.id,
      createdAt: analysis.created_at,
      taskAlignmentScore: analysis.task_alignment_score ?? null,
      taskProgressScore: analysis.task_progress_score ?? null,
      goalAlignmentScore: analysis.goal_alignment_score ?? null,
      companyGoalAlignmentScore: analysis.company_goal_alignment_score ?? null,
      expectedOutcomeProgressScore: analysis.expected_outcome_progress_score ?? null,
      progressScore: analysis.progress_score ?? null,
      qualityScore: analysis.report_quality_score ?? null,
      successRate: analysis.success_rate ?? null,
      riskLevel: analysis.risk_level ?? null,
      status: analysis.status ?? null,
      feedback: analysis.ai_comment || analysis.task_feedback || null,
    } : null,
    relationships: {
      task: report.task || null,
      weeklyPlan: report.plan || null,
      departmentGoal: report.goal || null,
      companyGoal: report.company_goal || null,
    },
    managerFeedback: (report.manager_feedback || []).slice(0, 5).map((feedback) => ({
      id: feedback.id,
      comment: String(feedback.comment || '').slice(0, 500),
      createdAt: feedback.created_at || null,
      author: feedback.author || null,
    })),
    reasons,
  };
}

export function buildReportingCheckpoints(period) {
  const expectedCount = Math.max(Math.ceil(inclusiveDays(period.start_date, period.end_date) / 7), 1);
  return Array.from({ length: expectedCount }, (_, index) => {
    const startDate = addDays(period.start_date, index * 7);
    const naturalEnd = addDays(startDate, 6);
    const deadline = naturalEnd > period.end_date ? period.end_date : naturalEnd;
    return {
      index: index + 1,
      startDate,
      deadline,
      graceDeadline: addDays(deadline, GRACE_DAYS),
    };
  });
}

function scoreSubmissionCompliance(reports, period) {
  const checkpoints = buildReportingCheckpoints(period);
  const unusedReports = [...reports].sort((a, b) => (
    new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  ));

  const results = checkpoints.map((checkpoint) => {
    const reportIndex = unusedReports.findIndex((report) => {
      const submitted = dateKey(report.submitted_at);
      return submitted >= checkpoint.startDate && submitted <= checkpoint.graceDeadline;
    });
    const report = reportIndex >= 0 ? unusedReports.splice(reportIndex, 1)[0] : null;
    const submittedDate = report ? dateKey(report.submitted_at) : null;
    const status = !report
      ? 'missing'
      : submittedDate <= checkpoint.deadline
        ? 'on_time'
        : 'late';

    return {
      ...checkpoint,
      status,
      reportId: report?.id || null,
      submittedAt: report?.submitted_at || null,
    };
  });

  const submittedCount = results.filter((checkpoint) => checkpoint.status !== 'missing').length;
  const onTimeCount = results.filter((checkpoint) => checkpoint.status === 'on_time').length;
  const coverageScore = (submittedCount / checkpoints.length) * 100;
  const timelinessScore = submittedCount > 0 ? (onTimeCount / submittedCount) * 100 : 0;

  return {
    score: round(coverageScore * 0.70 + timelinessScore * 0.30),
    expectedReportCount: checkpoints.length,
    submittedRequiredCount: submittedCount,
    onTimeCount,
    lateCount: results.filter((checkpoint) => checkpoint.status === 'late').length,
    missingCount: results.filter((checkpoint) => checkpoint.status === 'missing').length,
    coverageScore: round(coverageScore),
    timelinessScore: round(timelinessScore),
    checkpoints: results,
    supplementalReportIds: unusedReports.map((report) => report.id),
    timingBasis: 'Reports are matched to weekly checkpoints using submitted_at because persisted report work-period dates are not yet available.',
  };
}

export function calculateReportingPerformance(reports, period) {
  const reportBreakdown = (reports || []).map((report) => scoreReport(report, period));
  const submissionCompliance = scoreSubmissionCompliance(reports || [], period);
  const completeness = round(average(reportBreakdown.map((report) => report.dimensions.completeness)));
  const alignment = round(average(reportBreakdown.map((report) => report.dimensions.alignment)));
  const progress = round(average(reportBreakdown.map((report) => report.dimensions.progress)));
  const qualityEvidence = round(average(reportBreakdown.map((report) => report.dimensions.qualityEvidence)));
  const managerReviewRisk = round(average(reportBreakdown.map((report) => report.dimensions.managerReviewRisk)));

  const score = reportBreakdown.length === 0 ? 0 : round(
    submissionCompliance.score * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.submissionCompliance / 100
    + completeness * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.completeness / 100
    + alignment * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.alignment / 100
    + progress * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.progress / 100
    + qualityEvidence * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.qualityEvidence / 100
    + managerReviewRisk * REPORTING_PERFORMANCE_DIMENSION_WEIGHTS.managerReviewRisk / 100
  );

  const hasDelay = submissionCompliance.missingCount > 0
    || submissionCompliance.lateCount > 0
    || reportBreakdown.some((report) => report.workflowClassification === 'Delayed');
  const needsReview = reportBreakdown.some((report) => report.workflowClassification === 'Needs Review');

  return {
    score: clamp(score),
    classification: classifyReportingScore(score),
    workflowClassification: hasDelay ? 'Delayed' : needsReview ? 'Needs Review' : 'On Track',
    formulaVersion: REPORTING_PERFORMANCE_FORMULA_VERSION,
    dimensionWeights: REPORTING_PERFORMANCE_DIMENSION_WEIGHTS,
    evaluationWindow: {
      startDate: period.start_date,
      endDate: period.end_date,
      graceEndDate: addDays(period.end_date, GRACE_DAYS),
    },
    dimensions: {
      submissionCompliance: submissionCompliance.score,
      completeness,
      alignment,
      progress,
      qualityEvidence,
      managerReviewRisk,
    },
    submissionCompliance,
    summary: {
      reportCount: reportBreakdown.length,
      analyzedReportCount: reportBreakdown.filter((report) => report.existingAnalysis).length,
      reviewedReportCount: reportBreakdown.filter((report) => report.managerReviewRisk.reviewed).length,
      reportsWithEvidence: reportBreakdown.filter((report) => report.qualityEvidence.attachmentCount > 0).length,
      highRiskReportCount: reportBreakdown.filter((report) => report.existingAnalysis?.riskLevel === 'high').length,
      goodReportCount: reportBreakdown.filter((report) => report.classification === 'Good').length,
      averageReportCount: reportBreakdown.filter((report) => report.classification === 'Average').length,
      poorReportCount: reportBreakdown.filter((report) => report.classification === 'Poor').length,
    },
    reports: reportBreakdown,
    safeguards: {
      usesExistingReports: true,
      usesExistingAiAnalysis: true,
      createsAiAnalysis: false,
      modifiesReportsOrAnalysis: false,
      aiIsSoleSourceOfScore: false,
      sourceOfTruth: 'Existing reports, report_ai_analysis, report relationships, evidence, review state, and manager comments.',
    },
  };
}
