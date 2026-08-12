import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/myPerformanceRules.js', import.meta.url), 'utf8');
const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const privacySource = fs.readFileSync(new URL('../utils/myPerformancePrivacy.js', import.meta.url), 'utf8');
const privacy = await import(`data:text/javascript;base64,${Buffer.from(privacySource).toString('base64')}`);
const {
  chooseCurrentPerformanceEvaluation,
  isOwnPerformanceEvaluation,
  performanceDisplayResult,
} = rules;
const { employeeSafeEvidenceMetrics } = privacy;

test('employee access is limited to an active user own evaluation', () => {
  const user = { id: 'employee-1', status: 'active' };
  assert.equal(isOwnPerformanceEvaluation(user, { employee_id: 'employee-1' }), true);
  assert.equal(isOwnPerformanceEvaluation(user, { employee_id: 'employee-2' }), false);
  assert.equal(isOwnPerformanceEvaluation({ ...user, status: 'inactive' }, { employee_id: 'employee-1' }), false);
});

test('current active period evaluation takes precedence over newer history ordering', () => {
  const evaluations = [
    { id: 'history', evaluation_period_id: 'period-old', period: { start_date: '2026-08-01' } },
    { id: 'current', evaluation_period_id: 'period-current', period: { start_date: '2026-07-01' } },
  ];
  assert.equal(chooseCurrentPerformanceEvaluation(evaluations, { id: 'period-current' }).id, 'current');
});

test('latest evaluation is used when no active evaluation-period record exists', () => {
  const evaluations = [
    { id: 'older', period: { start_date: '2026-06-01' } },
    { id: 'latest', period: { start_date: '2026-07-01' } },
  ];
  assert.equal(chooseCurrentPerformanceEvaluation(evaluations, null).id, 'latest');
  assert.equal(chooseCurrentPerformanceEvaluation([], null), null);
});

test('employee reporting evidence excludes AI free-text, IDs, risk metadata, and relationship objects', () => {
  const safe = employeeSafeEvidenceMetrics({
    component: 'reporting_performance',
    evidence_metrics: {
      summary: { reportCount: 1 },
      reports: [{
        reportId: 'report-1', score: 80, dimensions: { qualityEvidence: 75 },
        existingAnalysis: { id: 'analysis-private', feedback: 'private AI text', riskLevel: 'high' },
        relationships: { task: { description: 'private detail' } },
        reasons: ['Existing analysis supplied numeric inputs.'],
      }],
    },
  });
  assert.equal(safe.reports[0].analysisUsed, true);
  assert.equal('existingAnalysis' in safe.reports[0], false);
  assert.equal('relationships' in safe.reports[0], false);
  assert.equal(JSON.stringify(safe).includes('private AI text'), false);
  assert.equal(JSON.stringify(safe).includes('analysis-private'), false);
});

test('employee task evidence exposes contribution reasons but not assignment or manager comment payloads', () => {
  const safe = employeeSafeEvidenceMetrics({
    component: 'task_performance',
    evidence_metrics: { tasks: [{
      taskId: 'task-1', includedInScore: true, normalizedContribution: 42,
      reasons: ['Evidence contributed.'], assignment: { assignedBy: { email: 'private@example.com' } },
      evidence: { managerFeedback: [{ comment: 'private comment' }] },
    }] },
  });
  assert.equal(safe.tasks[0].normalizedContribution, 42);
  assert.equal('assignment' in safe.tasks[0], false);
  assert.equal('evidence' in safe.tasks[0], false);
});

test('approved human result is displayed separately from calculated fallback', () => {
  assert.deepEqual(performanceDisplayResult({
    overall_score: 81, performance_band: 'Very Good',
    approved_score: 84, approved_performance_band: 'Very Good',
  }), { score: 84, performanceBand: 'Very Good', resultType: 'approved' });
  assert.deepEqual(performanceDisplayResult({
    overall_score: 71, performance_band: 'Good', approved_score: null,
  }), { score: 71, performanceBand: 'Good', resultType: 'calculated' });
});
