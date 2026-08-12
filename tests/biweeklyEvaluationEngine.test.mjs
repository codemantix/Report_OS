import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../utils/biweeklyEvaluationEngine.js', import.meta.url),
  'utf8'
);
const engine = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const {
  calculateBiweeklyEvaluation,
  classifyPerformanceBand,
  validatePerformanceBands,
} = engine;

function components(task, reporting, attendance, weights = [50, 30, 20]) {
  return [
    { id: 'task-score', component: 'task_performance', raw_score: task, weight: weights[0] },
    { id: 'report-score', component: 'reporting_performance', raw_score: reporting, weight: weights[1] },
    { id: 'attendance-score', component: 'attendance', raw_score: attendance, weight: weights[2] },
  ];
}

test('calculates the default 50/30/20 weighted overall score', () => {
  const result = calculateBiweeklyEvaluation(components(90, 80, 70));

  assert.equal(result.overallScore, 83);
  assert.equal(result.performanceBand, 'Very Good');
  assert.equal(result.calculatedStipendPercentage, 90);
  assert.equal(result.stipendRecommendationMode, 'percentage');
});

test('uses exact performance band boundaries and stipend recommendations', () => {
  const cases = [
    [100, 'Excellent', 100],
    [90, 'Excellent', 100],
    [89.999, 'Very Good', 90],
    [80, 'Very Good', 90],
    [79.999, 'Good', 80],
    [70, 'Good', 80],
    [69.999, 'Needs Improvement', 70],
    [60, 'Needs Improvement', 70],
  ];

  cases.forEach(([score, band, stipend]) => {
    const result = calculateBiweeklyEvaluation(components(score, score, score));
    assert.equal(result.performanceBand, band);
    assert.equal(result.calculatedStipendPercentage, stipend);
  });
});

test('classifies an authorized adjusted final score with the versioned band policy', () => {
  const band = classifyPerformanceBand(81.5);
  assert.equal(band.label, 'Very Good');
  assert.equal(band.stipendPercentage, 90);
});

test('scores below 60 require a manual stipend decision', () => {
  const result = calculateBiweeklyEvaluation(components(59.999, 59.999, 59.999));

  assert.equal(result.performanceBand, 'Review Required');
  assert.equal(result.calculatedStipendPercentage, null);
  assert.equal(result.stipendRecommendationMode, 'manual');
});

test('missing component input keeps the evaluation incomplete without a false overall score', () => {
  const result = calculateBiweeklyEvaluation(components(90, 85, null));

  assert.equal(result.calculationStatus, 'incomplete');
  assert.equal(result.overallScore, null);
  assert.equal(result.performanceBand, null);
  assert.deepEqual(result.missingComponents, ['attendance']);
});

test('supports versioned configured weights while requiring a 100 percent total', () => {
  const configured = calculateBiweeklyEvaluation(components(100, 50, 0, [40, 40, 20]));
  assert.equal(configured.overallScore, 60);

  assert.throws(
    () => calculateBiweeklyEvaluation(components(100, 100, 100, [50, 30, 10])),
    /weights must total 100/i
  );
});

test('rejects overlapping or incomplete performance-band policies', () => {
  assert.throws(
    () => validatePerformanceBands([
      { key: 'low', label: 'Low', minimumScore: 0, maximumScore: 60, recommendationMode: 'manual' },
      { key: 'high', label: 'High', minimumScore: 60, maximumScore: 100, stipendPercentage: 100, recommendationMode: 'percentage' },
    ]),
    /cannot overlap/i
  );
  assert.throws(
    () => validatePerformanceBands([
      { key: 'low', label: 'Low', minimumScore: 0, maximumScore: 49.999, recommendationMode: 'manual' },
      { key: 'high', label: 'High', minimumScore: 60, maximumScore: 100, stipendPercentage: 100, recommendationMode: 'percentage' },
    ]),
    /cannot contain score gaps/i
  );
});

test('engine outputs recommendations only and never represents approval or payment', () => {
  const result = calculateBiweeklyEvaluation(components(95, 95, 95));

  assert.equal(result.safeguards.recommendationOnly, true);
  assert.equal(result.safeguards.approvedEvaluation, false);
  assert.equal(result.safeguards.authorizedStipend, false);
  assert.equal(result.safeguards.markedPaymentPaid, false);
  assert.equal(result.safeguards.requiresHumanAuthorization, true);
});
