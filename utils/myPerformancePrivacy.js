export function employeeSafeEvidenceMetrics(score) {
  const metrics = score?.evidence_metrics || {};
  if (score?.component === 'task_performance') {
    return {
      formulaVersion: metrics.formulaVersion || null,
      summary: metrics.summary || {},
      scoringStatus: metrics.scoringStatus || null,
      noDataReason: metrics.noDataReason || null,
      tasks: (metrics.tasks || []).map((task) => ({
        taskId: task.taskId,
        includedInScore: task.includedInScore,
        exclusionReason: task.exclusionReason || null,
        score: task.score,
        normalizedContribution: task.normalizedContribution,
        dimensions: task.dimensions || {},
        reasons: task.reasons || [],
      })),
    };
  }
  if (score?.component === 'reporting_performance') {
    return {
      formulaVersion: metrics.formulaVersion || null,
      classification: metrics.classification || null,
      workflowClassification: metrics.workflowClassification || null,
      dimensions: metrics.dimensions || {},
      summary: metrics.summary || {},
      submissionCompliance: metrics.submissionCompliance ? {
        score: metrics.submissionCompliance.score,
        expectedReportCount: metrics.submissionCompliance.expectedReportCount,
        submittedCount: metrics.submissionCompliance.submittedCount,
        onTimeCount: metrics.submissionCompliance.onTimeCount,
        lateCount: metrics.submissionCompliance.lateCount,
        missingCount: metrics.submissionCompliance.missingCount,
      } : {},
      reports: (metrics.reports || []).map((report) => ({
        reportId: report.reportId,
        score: report.score,
        classification: report.classification,
        workflowClassification: report.workflowClassification,
        dimensions: report.dimensions || {},
        analysisUsed: Boolean(report.existingAnalysis),
        reasons: report.reasons || [],
      })),
    };
  }
  return {
    formulaVersion: metrics.formulaVersion || null,
    scoringStatus: metrics.scoringStatus || null,
    totalApplicableSessions: metrics.totalApplicableSessions || 0,
    present: metrics.present || 0,
    late: metrics.late || 0,
    absent: metrics.absent || 0,
    excused: metrics.excused || 0,
    scoringRules: metrics.scoringRules || {},
    calculation: metrics.calculation || null,
    noDataReason: metrics.noDataReason || null,
  };
}
