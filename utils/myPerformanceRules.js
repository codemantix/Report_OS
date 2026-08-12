export function isOwnPerformanceEvaluation(currentUser, evaluation) {
  return Boolean(
    currentUser?.status === 'active'
    && currentUser.id
    && evaluation?.employee_id === currentUser.id
  );
}

export function chooseCurrentPerformanceEvaluation(evaluations, currentPeriod) {
  const matching = currentPeriod
    ? (evaluations || []).find((evaluation) => evaluation.evaluation_period_id === currentPeriod.id)
    : null;
  return matching || [...(evaluations || [])].sort((a, b) => (
    String(b.period?.start_date || b.created_at || '')
      .localeCompare(String(a.period?.start_date || a.created_at || ''))
  ))[0] || null;
}

export function performanceDisplayResult(evaluation) {
  const approved = evaluation?.approved_score !== null
    && evaluation?.approved_score !== undefined;
  return {
    score: approved ? Number(evaluation.approved_score)
      : evaluation?.overall_score === null || evaluation?.overall_score === undefined
        ? null : Number(evaluation.overall_score),
    performanceBand: approved
      ? evaluation.approved_performance_band
      : evaluation?.performance_band || null,
    resultType: approved ? 'approved' : 'calculated',
  };
}
