function buildSection(label, data, fields) {
  if (!data) return `## ${label}\nNot linked.`;
  const lines = fields.map((f) => {
    const val = data[f.key];
    return `- **${f.label}**: ${val || f.fallback || 'N/A'}`;
  });
  return `## ${label}\n${lines.join('\n')}`;
}

const goalFields = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'success_metric', label: 'Success Metric' },
  { key: 'expected_deliverables', label: 'Expected Deliverables' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due Date' },
];

const planFields = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'plan_type', label: 'Plan Type' },
];

const taskFields = [
  { key: 'title', label: 'Title' },
  { key: 'expected_output', label: 'Expected Output' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'due_date', label: 'Due Date' },
];

function taskScoring(task) {
  if (!task) {
    return [
      '"task_alignment_score": null',
      '"task_progress_score": null',
      '"task_status_recommendation": null',
      '"task_feedback": null',
      '"success_rate": <0-100 integer calculated as (goal_alignment * 0.35) + (progress * 0.35) + (quality * 0.15) + (task_completion * 0.15)>',
    ].join(',\n  ');
  }
  return [
    '"task_alignment_score": <0-100 integer based on how well the report aligns with the task expected output>',
    '"task_progress_score": <0-100 integer based on task completion progress>',
    '"task_status_recommendation": "<todo|in_progress|in_review|completed|blocked|delayed>"',
    '"task_feedback": "Feedback on how the report relates to the assigned task"',
    '"success_rate": <0-100 integer calculated as (task_alignment * 0.25) + (task_progress * 0.25) + (goal_alignment * 0.20) + (plan_alignment * 0.15) + (quality * 0.15)>',
  ].join(',\n  ');
}

export function buildAnalysisPrompt(report, goal, plan, task) {
  return [
    'You are analyzing a work report for the Codemantix Collective team.',
    '',
    '## Report Information',
    `- **Report Type**: ${report.report_type}`,
    `- **Project Name**: ${report.project_name || 'N/A'}`,
    `- **Worked On**: ${report.worked_on}`,
    `- **Completed Tasks**: ${report.completed_tasks || 'None specified'}`,
    `- **Pending Tasks**: ${report.pending_tasks || 'None specified'}`,
    `- **Blockers**: ${report.blockers || 'None reported'}`,
    `- **Support Needed**: ${report.support_needed || 'None reported'}`,
    `- **Hours Worked**: ${report.hours_worked || 'Not specified'}`,
    `- **Completion Percentage**: ${report.completion_percentage || 0}%`,
    `- **Additional Notes**: ${report.additional_notes || 'None'}`,
    '',
    buildSection('Related Goal', goal, goalFields),
    '',
    buildSection('Related Department Plan', plan, planFields),
    '',
    buildSection('Related Task', task, taskFields),
    '',
    '## Analysis Task',
    'Analyze this report in detail and return a JSON object only. Do not include markdown formatting or code blocks.',
    'Base the analysis on the submitted work, linked goal, linked plan, linked task, blockers, pending items, completion percentage, and report clarity.',
    'Be specific: mention concrete completed work, gaps, risks, and practical next steps where applicable.',
    '',
    '{',
    '  "summary": "A clear 3-4 sentence summary of the report covering completed work, pending work, blockers, and overall status",',
    '  "completed_tasks": ["List of completed tasks as an array of strings"],',
    '  "pending_tasks": ["List of pending tasks as an array of strings"],',
    '  "blockers": ["List of blockers as an array of strings"],',
    '  "goal_alignment_score": <0-100 integer based on how well the work connects to the goal\'s success metrics and deliverables>,',
    '  "progress_score": <0-100 integer based on completed tasks, completion percentage, and movement toward outcomes>,',
    '  "report_quality_score": <0-100 integer based on clarity, specificity, measurable output, and detail>,',
    '  ' + taskScoring(task),
    '  "risk_level": "<low|medium|high based on blockers, delays, and low scores>",',
    '  "status": "<in_progress|completed|at_risk>",',
    '  "admin_recommendation": "Admin-only guidance in 3-5 sentences: what the admin should verify, follow up on, approve, unblock, or discuss with the team member. Include any risks, accountability concerns, or missing information.",',
    '  "ai_comment": "Detailed analyzed comment for the report submitter in 2-4 short paragraphs. Explain what went well, how the work aligns with the goal/task, what is unclear or missing, risks/blockers, and concrete next steps to improve progress and future reports."',
    '}',
    '',
  ].join('\n');
}

export function buildBatchAnalysisPrompt(reportsWithDetails) {
  const reportsJson = JSON.stringify(reportsWithDetails, null, 2);
  return [
    `Analyze the following batch of team reports and return a JSON array of analysis objects.`,
    '',
    reportsJson,
    '',
    'For each report (matching by report_id), return:',
    '{',
    '  "report_id": "the report id",',
    '  "summary": "summary text",',
    '  "goal_alignment_score": 0-100,',
    '  "progress_score": 0-100,',
    '  "report_quality_score": 0-100,',
    '  "success_rate": 0-100,',
    '  "risk_level": "low|medium|high",',
    '  "status": "in_progress|completed|at_risk",',
    '  "admin_recommendation": "Admin-only guidance in 3-5 sentences with follow-up actions, risks, and missing information",',
    '  "ai_comment": "Detailed analyzed comment in 2-4 short paragraphs covering strengths, alignment, gaps, risks/blockers, and next steps"',
    '}',
    '',
    'Return only a valid JSON array, no markdown or code blocks.',
  ].join('\n');
}
