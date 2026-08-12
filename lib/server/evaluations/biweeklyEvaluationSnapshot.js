function componentSummary(componentResult) {
  const score = componentResult.componentScore;
  const metrics = componentResult.breakdown || {};
  const common = {
    componentScoreId: score.id,
    component: score.component,
    rawScore: score.raw_score === null ? null : Number(score.raw_score),
    weight: Number(score.weight),
    weightedScore: score.weighted_score === null ? null : Number(score.weighted_score),
    calculationVersion: score.calculation_version,
    calculatedAt: score.calculated_at,
    sourceCutoffAt: score.source_cutoff_at,
  };

  if (score.component === 'task_performance') {
    return {
      ...common,
      inputSummary: metrics.summary || {
        contributingTaskCount: metrics.contributingTaskCount,
        excludedTaskCount: metrics.excludedTaskCount,
      },
    };
  }
  if (score.component === 'reporting_performance') {
    return {
      ...common,
      inputSummary: {
        ...(metrics.summary || {}),
        submissionCompliance: metrics.submissionCompliance || null,
      },
    };
  }
  return {
    ...common,
    inputSummary: {
      totalApplicableSessions: metrics.totalApplicableSessions,
      present: metrics.present,
      late: metrics.late,
      absent: metrics.absent,
      excused: metrics.excused,
      scoringStatus: metrics.scoringStatus,
    },
  };
}

export function buildEvaluationCalculationSnapshot({
  evaluation,
  config,
  componentResults,
  engineResult,
  calculatedAt,
  calculationRunId,
}) {
  return {
    engineVersion: engineResult.engineVersion,
    generatedAt: calculatedAt,
    calculationRunId,
    evaluation: {
      id: evaluation.id,
      employeeId: evaluation.employee_id,
      departmentId: evaluation.department_id,
      evaluationPeriodId: evaluation.evaluation_period_id,
      periodStart: evaluation.period.start_date,
      periodEnd: evaluation.period.end_date,
    },
    configuration: {
      id: config.id,
      name: config.name,
      version: config.version,
      weights: {
        taskPerformance: Number(config.task_performance_weight),
        reportingPerformance: Number(config.reporting_performance_weight),
        attendance: Number(config.attendance_weight),
      },
      performanceBands: config.performance_band_config,
    },
    components: componentResults.map(componentSummary),
    result: {
      calculationStatus: engineResult.calculationStatus,
      overallScore: engineResult.overallScore,
      performanceBand: engineResult.performanceBand,
      performanceBandKey: engineResult.performanceBandKey || null,
      calculatedStipendPercentage: engineResult.calculatedStipendPercentage,
      stipendRecommendationMode: engineResult.stipendRecommendationMode,
      missingComponents: engineResult.missingComponents,
    },
    safeguards: engineResult.safeguards,
  };
}
