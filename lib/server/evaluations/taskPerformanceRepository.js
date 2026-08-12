const TASK_SELECT = `
  id,
  title,
  description,
  expected_output,
  priority,
  status,
  start_date,
  due_date,
  completed_at,
  archived,
  created_at,
  department_id,
  goal_id,
  plan_id,
  company_goal_id,
  goal:goal_id (
    id,
    title,
    description,
    success_metric,
    expected_deliverables,
    company_goal_id,
    department_id
  ),
  plan:plan_id (
    id,
    title,
    description,
    plan_type,
    start_date,
    end_date,
    department_id
  ),
  company_goal:company_goal_id (
    id,
    title,
    month,
    year,
    success_metric
  )
`;

const REPORT_SELECT = `
  id,
  user_id,
  task_id,
  project_name,
  report_type,
  worked_on,
  completed_tasks,
  pending_tasks,
  blockers,
  additional_notes,
  completion_percentage,
  attachments,
  reviewed,
  reviewed_by,
  reviewed_at,
  submitted_at
`;

function assertQuery(result, message) {
  if (result.error) {
    const error = new Error(message);
    error.cause = result.error;
    throw error;
  }
  return result.data || [];
}

function periodStartTimestamp(period) {
  return `${period.start_date}T00:00:00.000Z`;
}

function periodEndTimestamp(period) {
  return `${period.end_date}T23:59:59.999Z`;
}

export async function fetchEvaluationContext(supabaseAdmin, evaluationId) {
  const result = await supabaseAdmin
    .from('employee_evaluations')
    .select(`
      id,
      employee_id,
      department_id,
      evaluation_period_id,
      weight_config_id,
      status,
      employee_name_snapshot,
      department_name_snapshot,
      employee:employee_id (id, email, full_name, display_name, status, role),
      period:evaluation_period_id (
        id,
        name,
        start_date,
        end_date,
        evaluation_deadline,
        status,
        department_id
      )
    `)
    .eq('id', evaluationId)
    .single();

  if (result.error || !result.data) {
    const error = new Error('Employee evaluation was not found.');
    error.statusCode = 404;
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

export async function fetchExistingTaskScore(supabaseAdmin, evaluationId) {
  const result = await supabaseAdmin
    .from('evaluation_component_scores')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('component', 'task_performance')
    .maybeSingle();

  if (result.error) {
    const error = new Error('Task Performance score could not be loaded.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}

async function fetchAssignments(supabaseAdmin, employeeId) {
  const result = await supabaseAdmin
    .from('task_assignees')
    .select(`
      task_id,
      user_id,
      assigned_by,
      assigned_at,
      assigner:assigned_by (id, full_name, display_name, email)
    `)
    .eq('user_id', employeeId);

  return assertQuery(result, 'Assigned tasks could not be loaded.');
}

async function fetchTasks(supabaseAdmin, taskIds, departmentId) {
  if (taskIds.length === 0) return [];

  const result = await supabaseAdmin
    .from('tasks')
    .select(TASK_SELECT)
    .in('id', taskIds)
    .eq('department_id', departmentId);

  return assertQuery(result, 'Task details could not be loaded.');
}

async function fetchDirectReports(supabaseAdmin, employeeId, taskIds, period) {
  if (taskIds.length === 0) return { reports: [], warning: null };

  const result = await supabaseAdmin
    .from('reports')
    .select(REPORT_SELECT)
    .eq('user_id', employeeId)
    .in('task_id', taskIds)
    .gte('submitted_at', periodStartTimestamp(period))
    .lte('submitted_at', periodEndTimestamp(period));

  if (result.error) {
    return {
      reports: [],
      warning: 'DIRECT_TASK_REPORT_LOOKUP_UNAVAILABLE',
    };
  }

  return { reports: result.data || [], warning: null };
}

async function fetchLegacyLinkedReports(supabaseAdmin, employeeId, taskIds, period) {
  if (taskIds.length === 0) return { reports: [], taskIdsByReport: new Map(), warning: null };

  const linksResult = await supabaseAdmin
    .from('report_tasks')
    .select('report_id, task_id')
    .in('task_id', taskIds);

  if (linksResult.error) {
    return {
      reports: [],
      taskIdsByReport: new Map(),
      warning: 'LEGACY_REPORT_TASK_LINK_LOOKUP_UNAVAILABLE',
    };
  }

  const links = linksResult.data || [];
  const reportIds = [...new Set(links.map((link) => link.report_id).filter(Boolean))];
  const taskIdsByReport = links.reduce((map, link) => {
    const existing = map.get(link.report_id) || [];
    existing.push(link.task_id);
    map.set(link.report_id, existing);
    return map;
  }, new Map());

  if (reportIds.length === 0) return { reports: [], taskIdsByReport, warning: null };

  const reportsResult = await supabaseAdmin
    .from('reports')
    .select(REPORT_SELECT)
    .eq('user_id', employeeId)
    .in('id', reportIds)
    .gte('submitted_at', periodStartTimestamp(period))
    .lte('submitted_at', periodEndTimestamp(period));

  if (reportsResult.error) {
    return {
      reports: [],
      taskIdsByReport,
      warning: 'LEGACY_LINKED_REPORT_LOOKUP_UNAVAILABLE',
    };
  }

  return { reports: reportsResult.data || [], taskIdsByReport, warning: null };
}

async function fetchReportFeedback(supabaseAdmin, reportIds) {
  if (reportIds.length === 0) return { feedback: [], warning: null };

  const result = await supabaseAdmin
    .from('admin_comments')
    .select(`
      id,
      report_id,
      comment,
      visibility,
      created_at,
      author:admin_id (id, full_name, display_name, email, role)
    `)
    .in('report_id', reportIds)
    .eq('visibility', 'employee_visible');

  if (result.error) {
    return { feedback: [], warning: 'REPORT_MANAGER_FEEDBACK_UNAVAILABLE' };
  }

  return { feedback: result.data || [], warning: null };
}

async function fetchTaskManagerFeedback(supabaseAdmin, taskIds) {
  if (taskIds.length === 0) return { feedback: [], warning: null };

  const result = await supabaseAdmin
    .from('task_comments')
    .select(`
      id,
      task_id,
      comment,
      visibility,
      created_at,
      author:user_id (id, full_name, display_name, email, role)
    `)
    .in('task_id', taskIds)
    .eq('visibility', 'employee_visible');

  if (result.error) {
    return { feedback: [], warning: 'TASK_MANAGER_FEEDBACK_UNAVAILABLE' };
  }

  const feedback = (result.data || []).filter((comment) => (
    comment.author?.role === 'admin' || comment.author?.role === 'department_lead'
  ));

  return { feedback, warning: null };
}

function mergeReports(directReports, legacyReports, taskIdsByReport) {
  const reportsById = new Map();

  directReports.forEach((report) => {
    reportsById.set(report.id, {
      ...report,
      linked_task_ids: report.task_id ? [report.task_id] : [],
    });
  });

  legacyReports.forEach((report) => {
    const existing = reportsById.get(report.id) || report;
    const linkedTaskIds = new Set([
      ...(existing.linked_task_ids || []),
      ...(taskIdsByReport.get(report.id) || []),
    ]);
    reportsById.set(report.id, { ...existing, linked_task_ids: [...linkedTaskIds] });
  });

  return [...reportsById.values()];
}

export async function fetchTaskPerformanceSources(supabaseAdmin, evaluation) {
  const assignments = await fetchAssignments(supabaseAdmin, evaluation.employee_id);
  const taskIds = [...new Set(assignments.map((assignment) => assignment.task_id).filter(Boolean))];
  const tasks = await fetchTasks(supabaseAdmin, taskIds, evaluation.department_id);
  const loadedTaskIds = tasks.map((task) => task.id);

  const [directResult, legacyResult, taskFeedbackResult] = await Promise.all([
    fetchDirectReports(supabaseAdmin, evaluation.employee_id, loadedTaskIds, evaluation.period),
    fetchLegacyLinkedReports(supabaseAdmin, evaluation.employee_id, loadedTaskIds, evaluation.period),
    fetchTaskManagerFeedback(supabaseAdmin, loadedTaskIds),
  ]);

  const reports = mergeReports(
    directResult.reports,
    legacyResult.reports,
    legacyResult.taskIdsByReport
  );
  const reportIds = reports.map((report) => report.id);
  const reportFeedbackResult = await fetchReportFeedback(supabaseAdmin, reportIds);

  const reportFeedbackByReport = reportFeedbackResult.feedback.reduce((map, feedback) => {
    const existing = map.get(feedback.report_id) || [];
    existing.push({
      id: feedback.id,
      comment: feedback.comment,
      visibility: feedback.visibility,
      created_at: feedback.created_at,
      author: feedback.author,
      source: 'report',
    });
    map.set(feedback.report_id, existing);
    return map;
  }, new Map());

  const reportsByTask = reports.reduce((map, report) => {
    const reportTaskIds = new Set([
      ...(report.linked_task_ids || []),
      ...(report.task_id ? [report.task_id] : []),
    ]);
    reportTaskIds.forEach((taskId) => {
      const existing = map.get(taskId) || [];
      existing.push({
        ...report,
        manager_feedback: reportFeedbackByReport.get(report.id) || [],
      });
      map.set(taskId, existing);
    });
    return map;
  }, new Map());

  const taskFeedbackByTask = taskFeedbackResult.feedback.reduce((map, feedback) => {
    const existing = map.get(feedback.task_id) || [];
    existing.push({
      id: feedback.id,
      comment: feedback.comment,
      visibility: feedback.visibility,
      created_at: feedback.created_at,
      author: feedback.author,
      source: 'task',
    });
    map.set(feedback.task_id, existing);
    return map;
  }, new Map());

  const assignmentByTask = new Map(assignments.map((assignment) => [assignment.task_id, {
    assignedAt: assignment.assigned_at,
    assignedBy: assignment.assigner || (assignment.assigned_by ? { id: assignment.assigned_by } : null),
  }]));

  return {
    tasks: tasks.map((task) => ({
      ...task,
      assignment: assignmentByTask.get(task.id) || null,
      reports: reportsByTask.get(task.id) || [],
      manager_feedback: taskFeedbackByTask.get(task.id) || [],
    })),
    warnings: [
      directResult.warning,
      legacyResult.warning,
      taskFeedbackResult.warning,
      reportFeedbackResult.warning,
    ].filter(Boolean),
  };
}

export async function saveTaskPerformanceScore(supabaseAdmin, {
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
      calculation_method: 'deterministic_existing_task_evaluation',
      calculation_version: evidenceMetrics.formulaVersion,
      evidence_metrics: evidenceMetrics,
      source_cutoff_at: calculatedAt,
      calculated_by: calculatedBy,
      calculated_at: hasScore ? calculatedAt : null,
    })
    .eq('evaluation_id', evaluationId)
    .eq('component', 'task_performance')
    .select('*')
    .single();

  if (result.error || !result.data) {
    const error = new Error('Task Performance score could not be saved.');
    error.cause = result.error;
    throw error;
  }

  return result.data;
}
