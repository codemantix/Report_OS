import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scoringSource = fs.readFileSync(
  new URL('../utils/reportingPerformanceScoring.js', import.meta.url),
  'utf8'
);
const scoringModule = await import(
  `data:text/javascript;base64,${Buffer.from(scoringSource).toString('base64')}`
);
const {
  buildReportingCheckpoints,
  calculateReportingPerformance,
  classifyReportingScore,
  scoreReport,
} = scoringModule;

const PERIOD = { start_date: '2026-08-03', end_date: '2026-08-16' };

function analysis(overrides = {}) {
  return {
    id: overrides.id || 'analysis-1',
    task_alignment_score: 90,
    task_progress_score: 90,
    goal_alignment_score: 90,
    company_goal_alignment_score: 90,
    expected_outcome_progress_score: 90,
    progress_score: 90,
    report_quality_score: 90,
    success_rate: 90,
    risk_level: 'low',
    status: 'completed',
    ai_comment: 'Clear and aligned report.',
    created_at: '2026-08-08T12:00:00Z',
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    id: overrides.id || 'report-1',
    project_name: 'Weekly delivery report',
    report_type: 'weekly',
    worked_on: 'Completed planned delivery work.',
    completed_tasks: 'Completed assigned launch task.',
    pending_tasks: 'No pending tasks.',
    blockers: 'No blockers.',
    support_needed: 'No support needed.',
    hours_worked: 40,
    completion_percentage: 100,
    additional_notes: 'All expected deliverables submitted.',
    attachments: JSON.stringify([{ name: 'evidence.pdf', url: 'https://example.com/evidence.pdf' }]),
    ai_status: 'completed',
    reviewed: true,
    submitted_at: '2026-08-07T16:00:00Z',
    task_id: 'task-1',
    plan_id: 'plan-1',
    goal_id: 'goal-1',
    company_goal_id: 'company-goal-1',
    analysis: [analysis()],
    manager_feedback: [{
      id: 'comment-1',
      comment: 'Report and evidence verified.',
      created_at: '2026-08-08T13:00:00Z',
      author: { id: 'manager-1', full_name: 'Manager' },
    }],
    ...overrides,
  };
}

test('bi-weekly periods produce two required weekly reporting checkpoints', () => {
  const checkpoints = buildReportingCheckpoints(PERIOD);
  assert.equal(checkpoints.length, 2);
  assert.equal(checkpoints[0].deadline, '2026-08-09');
  assert.equal(checkpoints[1].deadline, '2026-08-16');
});

test('missing required reports produces a zero Poor and Delayed result', () => {
  const result = calculateReportingPerformance([], PERIOD);
  assert.equal(result.score, 0);
  assert.equal(result.classification, 'Poor');
  assert.equal(result.workflowClassification, 'Delayed');
  assert.equal(result.submissionCompliance.missingCount, 2);
});

test('complete timely reviewed reports with existing analysis score Good and On Track', () => {
  const reports = [
    report(),
    report({
      id: 'report-2',
      submitted_at: '2026-08-14T16:00:00Z',
      analysis: [analysis({ id: 'analysis-2' })],
    }),
  ];
  const result = calculateReportingPerformance(reports, PERIOD);

  assert.ok(result.score >= 80);
  assert.equal(result.classification, 'Good');
  assert.equal(result.workflowClassification, 'On Track');
  assert.equal(result.submissionCompliance.onTimeCount, 2);
  assert.equal(result.summary.analyzedReportCount, 2);
  assert.equal(result.safeguards.createsAiAnalysis, false);
});

test('eligible existing AI analysis is reused while placeholders are ignored', () => {
  const analyzed = scoreReport(report({
    analysis: [
      analysis(),
      analysis({
        id: 'pending-placeholder',
        status: 'pending',
        task_alignment_score: null,
        task_progress_score: null,
        goal_alignment_score: null,
        company_goal_alignment_score: null,
        expected_outcome_progress_score: null,
        progress_score: null,
        report_quality_score: null,
        success_rate: null,
        created_at: '2026-08-09T12:00:00Z',
      }),
    ],
  }), PERIOD);
  const fallback = scoreReport(report({
    id: 'report-fallback',
    analysis: [],
    ai_status: 'pending',
    reviewed: false,
    manager_feedback: [],
  }), PERIOD);

  assert.equal(analyzed.existingAnalysis.id, 'analysis-1');
  assert.equal(fallback.existingAnalysis, null);
  assert.equal(fallback.workflowClassification, 'Needs Review');
  assert.match(fallback.reasons.join(' '), /deterministic linkage and report-content fallbacks/i);
});

test('late or high-risk reports are classified Delayed with explainable risk impact', () => {
  const lateHighRisk = report({
    submitted_at: '2026-08-17T10:00:00Z',
    analysis: [analysis({ risk_level: 'high', status: 'at_risk' })],
  });
  const scored = scoreReport(lateHighRisk, PERIOD);

  assert.equal(scored.workflowClassification, 'Delayed');
  assert.ok(scored.managerReviewRisk.score < 100);
  assert.match(scored.managerReviewRisk.reasons.join(' '), /high risk/i);
});

test('Good Average and Poor classifications use stable normalized thresholds', () => {
  assert.equal(classifyReportingScore(80), 'Good');
  assert.equal(classifyReportingScore(79.99), 'Average');
  assert.equal(classifyReportingScore(60), 'Average');
  assert.equal(classifyReportingScore(59.99), 'Poor');
});
