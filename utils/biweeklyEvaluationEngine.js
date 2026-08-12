export const BIWEEKLY_EVALUATION_ENGINE_VERSION = 'biweekly-evaluation-v1';

export const DEFAULT_PERFORMANCE_BANDS = Object.freeze([
  Object.freeze({
    key: 'excellent',
    label: 'Excellent',
    minimumScore: 90,
    maximumScore: 100,
    stipendPercentage: 100,
    recommendationMode: 'percentage',
  }),
  Object.freeze({
    key: 'very_good',
    label: 'Very Good',
    minimumScore: 80,
    maximumScore: 89.999,
    stipendPercentage: 90,
    recommendationMode: 'percentage',
  }),
  Object.freeze({
    key: 'good',
    label: 'Good',
    minimumScore: 70,
    maximumScore: 79.999,
    stipendPercentage: 80,
    recommendationMode: 'percentage',
  }),
  Object.freeze({
    key: 'needs_improvement',
    label: 'Needs Improvement',
    minimumScore: 60,
    maximumScore: 69.999,
    stipendPercentage: 70,
    recommendationMode: 'percentage',
  }),
  Object.freeze({
    key: 'review_required',
    label: 'Review Required',
    minimumScore: 0,
    maximumScore: 59.999,
    stipendPercentage: null,
    recommendationMode: 'manual',
  }),
]);

const REQUIRED_COMPONENTS = Object.freeze([
  'task_performance',
  'reporting_performance',
  'attendance',
]);

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function numericInRange(value, minimum, maximum, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return numeric;
}

function normalizeBands(configuredBands) {
  const bands = configuredBands || DEFAULT_PERFORMANCE_BANDS;
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new Error('At least one performance band is required.');
  }

  return bands.map((band) => {
    const minimumScore = numericInRange(band.minimumScore, 0, 100, 'Band minimum score');
    const maximumScore = numericInRange(band.maximumScore, 0, 100, 'Band maximum score');
    if (minimumScore > maximumScore) {
      throw new Error('Performance band minimum score cannot exceed its maximum score.');
    }
    if (!band.key || !band.label) {
      throw new Error('Every performance band requires a key and label.');
    }
    if (!['percentage', 'manual'].includes(band.recommendationMode)) {
      throw new Error('Performance band recommendation mode must be percentage or manual.');
    }

    const stipendPercentage = band.recommendationMode === 'manual'
      ? null
      : numericInRange(band.stipendPercentage, 0, 100, 'Stipend percentage');

    return {
      key: band.key,
      label: band.label,
      minimumScore,
      maximumScore,
      stipendPercentage,
      recommendationMode: band.recommendationMode,
    };
  });
}

export function validatePerformanceBands(configuredBands) {
  const bands = normalizeBands(configuredBands);
  const ascending = [...bands].sort((a, b) => a.minimumScore - b.minimumScore);

  if (ascending[0].minimumScore !== 0 || ascending[ascending.length - 1].maximumScore !== 100) {
    throw new Error('Performance bands must cover the complete 0 to 100 score range.');
  }

  for (let index = 1; index < ascending.length; index += 1) {
    const previous = ascending[index - 1];
    const current = ascending[index];
    if (current.minimumScore <= previous.maximumScore) {
      throw new Error('Performance bands cannot overlap.');
    }
    if (round(previous.maximumScore + 0.001) !== current.minimumScore) {
      throw new Error('Performance bands cannot contain score gaps.');
    }
  }

  return bands;
}

function normalizeComponents(componentScores) {
  const byComponent = new Map(
    (componentScores || []).map((component) => [component.component, component])
  );

  return REQUIRED_COMPONENTS.map((componentName) => {
    const component = byComponent.get(componentName);
    if (!component) {
      return { component: componentName, rawScore: null, weight: null, weightedScore: null };
    }

    const weight = numericInRange(component.weight, 0, 100, `${componentName} weight`);
    const hasScore = component.raw_score !== null && component.raw_score !== undefined;
    const rawScore = hasScore
      ? numericInRange(component.raw_score, 0, 100, `${componentName} score`)
      : null;

    return {
      component: componentName,
      rawScore,
      weight,
      weightedScore: rawScore === null ? null : round((rawScore * weight) / 100),
      componentScoreId: component.id || null,
      calculationVersion: component.calculation_version || null,
      calculatedAt: component.calculated_at || null,
      sourceCutoffAt: component.source_cutoff_at || null,
    };
  });
}

export function classifyPerformanceBand(score, configuredBands) {
  const numericScore = numericInRange(score, 0, 100, 'Overall score');
  const bands = validatePerformanceBands(configuredBands);
  const band = bands.find((candidate) => (
    numericScore >= candidate.minimumScore && numericScore <= candidate.maximumScore
  ));
  if (!band) throw new Error(`No configured performance band covers score ${numericScore}.`);
  return band;
}

export function calculateBiweeklyEvaluation(componentScores, configuredBands) {
  const components = normalizeComponents(componentScores);
  const configuredWeightTotal = round(
    components.reduce((sum, component) => sum + (component.weight || 0), 0),
    2
  );
  if (configuredWeightTotal !== 100) {
    throw new Error('Evaluation component weights must total 100.');
  }

  const missingComponents = components
    .filter((component) => component.rawScore === null)
    .map((component) => component.component);

  if (missingComponents.length > 0) {
    return {
      engineVersion: BIWEEKLY_EVALUATION_ENGINE_VERSION,
      calculationStatus: 'incomplete',
      overallScore: null,
      performanceBand: null,
      calculatedStipendPercentage: null,
      stipendRecommendationMode: null,
      components,
      configuredWeightTotal,
      missingComponents,
      safeguards: {
        recommendationOnly: true,
        approvedEvaluation: false,
        authorizedStipend: false,
        markedPaymentPaid: false,
        requiresHumanAuthorization: true,
      },
    };
  }

  const overallScore = round(
    components.reduce(
      (sum, component) => sum + ((component.rawScore * component.weight) / 100),
      0
    )
  );
  const band = classifyPerformanceBand(overallScore, configuredBands);

  return {
    engineVersion: BIWEEKLY_EVALUATION_ENGINE_VERSION,
    calculationStatus: 'complete',
    overallScore,
    performanceBand: band.label,
    performanceBandKey: band.key,
    calculatedStipendPercentage: band.stipendPercentage,
    stipendRecommendationMode: band.recommendationMode,
    components,
    configuredWeightTotal,
    missingComponents: [],
    bandPolicy: band,
    safeguards: {
      recommendationOnly: true,
      approvedEvaluation: false,
      authorizedStipend: false,
      markedPaymentPaid: false,
      requiresHumanAuthorization: true,
    },
  };
}
