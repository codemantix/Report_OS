import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scoringSource = fs.readFileSync(
  new URL('../utils/taskPerformanceScoring.js', import.meta.url),
  'utf8'
);
const scoringModule = await import(
  `data:text/javascript;base64,${Buffer.from(scoringSource).toString('base64')}`
);
const {
  calculateTaskPerformance,
  scoreTask,
  taskFallsWithinEvaluationWindow,
} = scoringModule;

const PERIOD = { start_date: '2026-08-03', end_date: '2026-08-16' };

function task(overrides = {}) {
  return {
    id: overrides.id || 'task-1',
    title: 'Existing assigned task',
    description: 'Task description',
    expected_output: 'Approved launch document',
    priority: 'medium',
    status: 'completed',
    start_date: '2026-08-03',
    due_date: '2026-08-10',
    completed_at: '2026-08-09T12:00:00Z',
    created_at: '2026-08-03T08:00:00Z',
    goal: { success_metric: 'Launch acceptance rate reaches 100%' },
    plan: { id: 'plan-1', title: 'Weekly launch plan', plan_type: 'weekly' },
    company_goal: { id: 'company-goal-1', title: 'Launch successfully' },
    reports: [],
    manager_feedback: [],
    ...overrides,
  };
}

function reviewedEvidenceReport(overrides = {}) {
  return {
    id: 'report-1',
    completion_percentage: 100,
    worked_on: 'Completed the launch document.',
    completed_tasks: 'Launch document delivered.',
    attachments: JSON.stringify([{ name: 'launch.pdf', url: 'https://example.com/launch.pdf' }]),
    reviewed: true,
    manager_feedback: [{
      id: 'feedback-1',
      comment: 'Deliverable and KPI verified.',
      created_at: '2026-08-11T10:00:00Z',
      author: { id: 'manager-1', full_name: 'Manager' },
      source: 'report',
    }],
    submitted_at: '2026-08-10T09:00:00Z',
    ...overrides,
  };
}

test('completed status alone does not produce maximum performance', () => {
  const result = scoreTask(task({ reports: [] }));
  assert.equal(result.includedInScore, true);
  assert.ok(result.score < 100);
  assert.ok(result.dimensions.deliverable <= 20);
  assert.equal(result.dimensions.evidence, 0);
  assert.match(result.reasons.join(' '), /no linked employee submission/i);
});

test('completed task can reach maximum only with deliverable, KPI, evidence, and review support', () => {
  const result = scoreTask(task({ reports: [reviewedEvidenceReport()] }));
  assert.equal(result.score, 100);
  assert.equal(result.dimensions.deliverable, 100);
  assert.equal(result.dimensions.kpi, 100);
  assert.equal(result.dimensions.evidence, 100);
  assert.equal(result.dimensions.managerReview, 100);
});

test('no eligible assigned tasks returns insufficient data instead of employee failure', () => {
  const result = calculateTaskPerformance([], PERIOD);

  assert.equal(result.score, null);
  assert.equal(result.scoringStatus, 'insufficient_data');
  assert.equal(result.safeguards.missingEligibleTasksProduceZero, false);
});

test('cancelled tasks remain explainable but are excluded from the denominator', () => {
  const cancelled = task({ id: 'cancelled', status: 'cancelled' });
  const active = task({ id: 'active', status: 'in_progress', reports: [] });
  const result = calculateTaskPerformance([cancelled, active], PERIOD);

  assert.equal(result.summary.cancelledTaskCount, 1);
  assert.equal(result.summary.scoredTaskCount, 1);
  assert.equal(result.tasks.find((item) => item.taskId === 'cancelled').includedInScore, false);
  assert.equal(result.score, scoreTask(active).score);
});

test('priority weighting produces a normalized explainable aggregate', () => {
  const high = task({
    id: 'high',
    priority: 'high',
    reports: [reviewedEvidenceReport({ id: 'high-report' })],
  });
  const low = task({
    id: 'low',
    priority: 'low',
    status: 'todo',
    completed_at: null,
    reports: [],
  });
  const result = calculateTaskPerformance([high, low], PERIOD);
  const expected = Math.round(((scoreTask(high).score * 3 + scoreTask(low).score) / 4) * 100) / 100;

  assert.equal(result.score, expected);
  assert.equal(
    Math.round(result.tasks.reduce((sum, item) => sum + item.normalizedContribution, 0)),
    Math.round(result.score)
  );
});

test('task eligibility uses assignment task dates and completion within the period', () => {
  assert.equal(taskFallsWithinEvaluationWindow(task(), PERIOD), true);
  assert.equal(taskFallsWithinEvaluationWindow(task({
    start_date: '2026-07-01',
    due_date: '2026-07-10',
    completed_at: '2026-07-09T10:00:00Z',
  }), PERIOD), false);
  assert.equal(taskFallsWithinEvaluationWindow(task({
    start_date: '2026-07-01',
    due_date: '2026-07-10',
    completed_at: '2026-08-05T10:00:00Z',
  }), PERIOD), true);
  assert.equal(taskFallsWithinEvaluationWindow(task({
    assignment: { assignedAt: '2026-08-20T09:00:00Z' },
  }), PERIOD), false);
});

test('incomplete tasks score below completed tasks without evidence', () => {
  const todo = scoreTask(task({ status: 'todo', completed_at: null, reports: [] }));
  const inProgress = scoreTask(task({ status: 'in_progress', completed_at: null, reports: [] }));
  const inReview = scoreTask(task({ status: 'in_review', completed_at: null, reports: [] }));

  assert.equal(todo.includedInScore, true);
  assert.equal(inProgress.includedInScore, true);
  assert.equal(inReview.includedInScore, true);
  assert.ok(todo.score < inProgress.score);
  assert.ok(inProgress.score < inReview.score);
  assert.ok(inReview.score < 100, 'incomplete work cannot reach maximum performance');
});

test('blocked and delayed tasks produce lower outcome baselines with explainable reasons', () => {
  const blocked = scoreTask(task({ status: 'blocked', completed_at: null, reports: [] }));
  const delayed = scoreTask(task({ status: 'delayed', completed_at: null, reports: [] }));

  assert.equal(blocked.dimensions.statusOutcome, 35);
  assert.equal(delayed.dimensions.statusOutcome, 20);
  assert.match(blocked.reasons.join(' '), /blocked/i);
  assert.match(delayed.reasons.join(' '), /delayed/i);
});

test('overdue completed tasks are penalized and on-time completions rewarded', () => {
  const overdue = scoreTask(task({
    due_date: '2026-08-05',
    completed_at: '2026-08-09T12:00:00Z',
  }));
  const onTime = scoreTask(task({
    due_date: '2026-08-10',
    completed_at: '2026-08-09T12:00:00Z',
  }));

  assert.equal(overdue.dimensions.statusOutcome, 92);
  assert.equal(onTime.dimensions.statusOutcome, 100);
  assert.match(overdue.reasons.join(' '), /after the due date/i);
  assert.match(onTime.reasons.join(' '), /on or before the due date/i);
});

test('missing evidence keeps a completed task below maximum', () => {
  const noEvidence = scoreTask(task({ status: 'completed', reports: [] }));
  const withEvidence = scoreTask(task({ status: 'completed', reports: [reviewedEvidenceReport()] }));

  assert.ok(noEvidence.score < withEvidence.score);
  assert.equal(noEvidence.dimensions.evidence, 0);
  assert.match(noEvidence.reasons.join(' '), /no linked employee submission/i);
});
