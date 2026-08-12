import { fetchEvaluationContext } from './taskPerformanceRepository';

export { fetchEvaluationContext };

export async function fetchExistingAttendanceScore(supabaseAdmin, evaluationId) {
  const result = await supabaseAdmin
    .from('evaluation_component_scores')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('component', 'attendance')
    .maybeSingle();

  if (result.error) {
    const error = new Error('Attendance Performance score could not be loaded.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

export async function fetchAttendancePerformanceSources(supabaseAdmin, evaluation) {
  const [attendanceResult, configResult] = await Promise.all([
    supabaseAdmin
      .from('attendance_records')
      .select(`
        id,
        attendance_date,
        attendance_status,
        review_status,
        meeting_session,
        attendance_type,
        evaluation_period_id,
        notes,
        recorded_by,
        recorded_at,
        recorder:recorded_by (id, full_name, display_name, email)
      `)
      .eq('employee_id', evaluation.employee_id)
      .eq('department_id', evaluation.department_id)
      .or(`evaluation_period_id.eq.${evaluation.evaluation_period_id},evaluation_period_id.is.null`)
      .gte('attendance_date', evaluation.period.start_date)
      .lte('attendance_date', evaluation.period.end_date)
      .order('attendance_date', { ascending: true })
      .order('recorded_at', { ascending: true }),
    supabaseAdmin
      .from('evaluation_weight_configs')
      .select(`
        id,
        name,
        version,
        attendance_weight,
        attendance_present_score,
        attendance_late_score,
        attendance_absent_score,
        attendance_excused_score
      `)
      .eq('id', evaluation.weight_config_id)
      .single(),
  ]);

  if (attendanceResult.error) {
    const error = new Error('Official attendance records could not be loaded.');
    error.cause = attendanceResult.error;
    throw error;
  }
  if (configResult.error || !configResult.data) {
    const error = new Error('Attendance scoring configuration could not be loaded.');
    error.statusCode = 409;
    error.cause = configResult.error;
    throw error;
  }

  const config = configResult.data;
  return {
    records: attendanceResult.data || [],
    scoringConfig: {
      id: config.id,
      name: config.name,
      version: config.version,
      componentWeight: Number(config.attendance_weight),
      rules: {
        present: Number(config.attendance_present_score),
        late: Number(config.attendance_late_score),
        absent: Number(config.attendance_absent_score),
        excused: Number(config.attendance_excused_score),
      },
    },
  };
}

export async function saveAttendancePerformanceScore(supabaseAdmin, {
  evaluationId,
  score,
  evidenceMetrics,
  calculatedBy,
  calculatedAt,
}) {
  const hasScore = score !== null && score !== undefined;
  const result = await supabaseAdmin
    .from('evaluation_component_scores')
    .update({
      raw_score: hasScore ? score : null,
      calculation_method: 'configurable_official_attendance_average',
      calculation_version: evidenceMetrics.formulaVersion,
      evidence_metrics: evidenceMetrics,
      source_cutoff_at: calculatedAt,
      calculated_by: calculatedBy,
      calculated_at: hasScore ? calculatedAt : null,
    })
    .eq('evaluation_id', evaluationId)
    .eq('component', 'attendance')
    .select('*')
    .single();

  if (result.error || !result.data) {
    const error = new Error('Attendance Performance score could not be saved.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}
