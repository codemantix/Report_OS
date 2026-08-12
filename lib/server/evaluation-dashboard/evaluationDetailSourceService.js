import { fetchAttendancePerformanceSources } from '../evaluations/attendancePerformanceRepository';
import { fetchReportingPerformanceSources } from '../evaluations/reportingPerformanceRepository';
import { fetchTaskPerformanceSources } from '../evaluations/taskPerformanceRepository';
import { taskFallsWithinEvaluationWindow } from '../../../utils/taskPerformanceScoring';

function warning(source, reason) {
  return {
    source,
    message: reason?.message || `${source} source records could not be loaded.`,
  };
}

export async function fetchEvaluationDetailSources(supabaseAdmin, evaluation) {
  const [taskResult, reportingResult, attendanceResult] = await Promise.allSettled([
    fetchTaskPerformanceSources(supabaseAdmin, evaluation),
    fetchReportingPerformanceSources(supabaseAdmin, evaluation),
    fetchAttendancePerformanceSources(supabaseAdmin, evaluation),
  ]);

  const taskMetrics = (evaluation.component_scores || [])
    .find((score) => score.component === 'task_performance')?.evidence_metrics?.tasks || [];
  const taskIds = new Set(taskMetrics.map((task) => task.taskId));
  const loadedTasks = taskResult.status === 'fulfilled' ? taskResult.value.tasks : [];
  const reportingMetrics = (evaluation.component_scores || [])
    .find((score) => score.component === 'reporting_performance')?.evidence_metrics?.reports || [];
  const reportIds = new Set(reportingMetrics.map((report) => report.reportId));
  const loadedReports = reportingResult.status === 'fulfilled' ? reportingResult.value.reports : [];
  const attendanceMetrics = (evaluation.component_scores || [])
    .find((score) => score.component === 'attendance')?.evidence_metrics || null;
  const attendanceIds = new Set((attendanceMetrics?.applicableRecords || []).map((record) => record.id));
  const loadedAttendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value.records : [];

  return {
    tasks: taskIds.size > 0
      ? loadedTasks.filter((task) => taskIds.has(task.id))
      : loadedTasks.filter((task) => taskFallsWithinEvaluationWindow(task, evaluation.period)),
    reports: reportIds.size > 0
      ? loadedReports.filter((report) => reportIds.has(report.id))
      : loadedReports,
    attendance: attendanceMetrics
      ? loadedAttendance.filter((record) => attendanceIds.has(record.id))
      : loadedAttendance,
    warnings: [
      ...(taskResult.status === 'fulfilled'
        ? (taskResult.value.warnings || []).map((message) => ({ source: 'tasks', message }))
        : [warning('tasks', taskResult.reason)]),
      ...(reportingResult.status === 'rejected'
        ? [warning('reports', reportingResult.reason)]
        : []),
      ...(attendanceResult.status === 'rejected'
        ? [warning('attendance', attendanceResult.reason)]
        : []),
    ],
    sourceOfTruth: {
      tasks: 'task_assignees and tasks',
      reports: 'reports and existing report_ai_analysis',
      attendance: 'attendance_records',
      editableCopiesCreated: false,
    },
  };
}
