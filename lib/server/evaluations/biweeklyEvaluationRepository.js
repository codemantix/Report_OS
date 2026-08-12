const MUTABLE_EVALUATION_STATUSES = ['draft', 'scoring', 'rejected'];

export async function beginEvaluationEngineRun(supabaseAdmin, {
  evaluationId,
  calculatedBy,
  calculatedAt,
  calculationRunId,
}) {
  const result = await supabaseAdmin
    .from('employee_evaluations')
    .update({
      overall_score: null,
      calculation_status: 'incomplete',
      calculation_version: null,
      performance_band: null,
      calculated_stipend_percentage: null,
      stipend_recommendation_mode: null,
      calculation_snapshot: {
        generatedAt: calculatedAt,
        calculationRunId,
        state: 'calculation_started',
        safeguards: {
          recommendationOnly: true,
          requiresHumanAuthorization: true,
        },
      },
      calculation_run_id: calculationRunId,
      evidence_cutoff_at: null,
      calculated_by: calculatedBy,
      calculated_at: calculatedAt,
    })
    .eq('id', evaluationId)
    .in('status', MUTABLE_EVALUATION_STATUSES)
    .select('id, calculation_revision, calculation_run_id')
    .maybeSingle();

  if (result.error || !result.data) {
    const error = new Error('Evaluation is no longer in a mutable calculation state.');
    error.statusCode = 409;
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

export async function fetchEvaluationEngineConfig(supabaseAdmin, weightConfigId) {
  const result = await supabaseAdmin
    .from('evaluation_weight_configs')
    .select(`
      id,
      name,
      version,
      task_performance_weight,
      reporting_performance_weight,
      attendance_weight,
      performance_band_config
    `)
    .eq('id', weightConfigId)
    .single();

  if (result.error || !result.data) {
    const error = new Error('Evaluation engine configuration could not be loaded.');
    error.statusCode = 409;
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

export async function fetchStoredEvaluationResult(supabaseAdmin, evaluationId) {
  const [evaluationResult, componentsResult] = await Promise.all([
    supabaseAdmin
      .from('employee_evaluations')
      .select(`
        id,
        employee_id,
        evaluation_period_id,
        department_id,
        weight_config_id,
        status,
        overall_score,
        calculation_status,
        calculation_version,
        performance_band,
        calculated_stipend_percentage,
        stipend_recommendation_mode,
        calculation_snapshot,
        evidence_cutoff_at,
        calculated_by,
        calculated_at,
        employee_name_snapshot,
        department_name_snapshot
      `)
      .eq('id', evaluationId)
      .single(),
    supabaseAdmin
      .from('evaluation_component_scores')
      .select('*')
      .eq('evaluation_id', evaluationId)
      .order('component', { ascending: true }),
  ]);

  if (evaluationResult.error || !evaluationResult.data) {
    const error = new Error('Employee evaluation result could not be loaded.');
    error.statusCode = 404;
    error.cause = evaluationResult.error;
    throw error;
  }
  if (componentsResult.error) {
    const error = new Error('Evaluation component scores could not be loaded.');
    error.cause = componentsResult.error;
    throw error;
  }

  return {
    evaluation: evaluationResult.data,
    componentScores: componentsResult.data || [],
  };
}

export async function saveEvaluationEngineResult(supabaseAdmin, {
  evaluationId,
  result,
  snapshot,
  calculatedBy,
  calculatedAt,
  calculationRunId,
  expectedRevision,
}) {
  const sourceCutoffs = result.components
    .map((component) => component.sourceCutoffAt)
    .filter(Boolean)
    .sort();
  const latestSourceCutoff = sourceCutoffs[sourceCutoffs.length - 1] || null;

  const updateResult = await supabaseAdmin
    .from('employee_evaluations')
    .update({
      overall_score: result.overallScore,
      calculation_status: result.calculationStatus,
      calculation_version: result.engineVersion,
      performance_band: result.performanceBand,
      calculated_stipend_percentage: result.calculatedStipendPercentage,
      stipend_recommendation_mode: result.stipendRecommendationMode,
      calculation_snapshot: snapshot,
      evidence_cutoff_at: latestSourceCutoff,
      calculated_by: calculatedBy,
      calculated_at: calculatedAt,
    })
    .eq('id', evaluationId)
    .in('status', MUTABLE_EVALUATION_STATUSES)
    .eq('calculation_status', 'incomplete')
    .eq('calculation_run_id', calculationRunId)
    .eq('calculation_revision', expectedRevision)
    .select(`
      id,
      employee_id,
      evaluation_period_id,
      department_id,
      weight_config_id,
      status,
      overall_score,
      calculation_status,
      calculation_version,
      performance_band,
      calculated_stipend_percentage,
      stipend_recommendation_mode,
      calculation_snapshot,
      calculation_run_id,
      calculation_revision,
      evidence_cutoff_at,
      calculated_by,
      calculated_at,
      employee_name_snapshot,
      department_name_snapshot
    `)
    .single();

  if (updateResult.error || !updateResult.data) {
    const error = new Error('Evaluation changed state before the central result could be saved.');
    error.statusCode = 409;
    error.cause = updateResult.error;
    throw error;
  }

  return updateResult.data;
}
