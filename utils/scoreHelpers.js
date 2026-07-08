/**
 * Calculate the weighted success rate from AI analysis scores.
 *
 * Formula:
 * Success Rate = (Goal Alignment × 0.35) + (Progress × 0.35) + (Quality × 0.15) + (Task Completion × 0.15)
 *
 * @param {Object} params
 * @param {number} params.goalAlignment - Goal alignment score (0-100)
 * @param {number} params.progress - Progress score (0-100)
 * @param {number} params.quality - Report quality score (0-100)
 * @param {number} params.taskCompletion - Task completion score (0-100)
 * @returns {number} Weighted success rate (0-100)
 */
export function calculateSuccessRate({
  taskAlignment,
  taskProgress,
  goalAlignment,
  companyGoalAlignment,
  expectedOutcomeProgress,
  progress,
  quality,
  taskCompletion
}) {
  // If new metrics are missing, fall back to old formula
  if (
    taskAlignment === undefined &&
    taskProgress === undefined &&
    companyGoalAlignment === undefined
  ) {
    return Math.round(
      (goalAlignment || 0) * 0.35 +
      (progress || 0) * 0.35 +
      (quality || 0) * 0.15 +
      (taskCompletion || 0) * 0.15
    );
  }

  return Math.round(
    (taskAlignment || 0) * 0.25 +
    (taskProgress || 0) * 0.25 +
    (goalAlignment || 0) * 0.20 +
    (companyGoalAlignment || 0) * 0.15 +
    (expectedOutcomeProgress || 0) * 0.15
  );
}

/**
 * Determine risk level based on scores and blockers.
 * @param {Object} params
 * @param {number} params.successRate - Success rate (0-100)
 * @param {number} params.progressScore - Progress score (0-100)
 * @param {Array} params.blockers - List of blockers
 * @returns {string} 'low' | 'medium' | 'high'
 */
export function determineRiskLevel({ successRate, progressScore, blockers }) {
  const hasBlockers = blockers && blockers.length > 0;
  const lowProgress = (progressScore || 0) < 40;
  const lowSuccess = (successRate || 0) < 50;

  if ((hasBlockers && lowProgress) || lowSuccess) return 'high';
  if (hasBlockers || (progressScore || 0) < 60) return 'medium';
  return 'low';
}

/**
 * Calculate task completion score based on completed vs pending tasks.
 * @param {Array} completed - List of completed tasks
 * @param {Array} pending - List of pending tasks
 * @returns {number} Score (0-100)
 */
export function calculateTaskCompletionScore(completed, pending) {
  const completedCount = completed?.length || 0;
  const pendingCount = pending?.length || 0;
  const total = completedCount + pendingCount;

  if (total === 0) return 50;
  return Math.round((completedCount / total) * 100);
}

/**
 * Clamp a score between 0 and 100.
 * @param {number} score
 * @returns {number}
 */
export function clampScore(score) {
  return Math.min(100, Math.max(0, score || 0));
}

/**
 * Get a color class for a score value.
 * @param {number} score - Score (0-100)
 * @returns {string} Tailwind color class
 */
export function getScoreColor(score) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Get a background color class for a score value.
 * @param {number} score - Score (0-100)
 * @returns {string} Tailwind background class
 */
export function getScoreBgColor(score) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

/**
 * Get a human-readable label for risk level.
 * @param {string} riskLevel - 'low' | 'medium' | 'high'
 * @returns {string}
 */
export function getRiskLabel(riskLevel) {
  const labels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };
  return labels[riskLevel] || 'Unknown';
}

/**
 * Get color class for risk level badge.
 * @param {string} riskLevel
 * @returns {string}
 */
export function getRiskBadgeColor(riskLevel) {
  const colors = {
    low: 'badge-success',
    medium: 'badge-warning',
    high: 'badge-danger',
  };
  return colors[riskLevel] || 'badge-neutral';
}
