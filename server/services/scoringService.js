export const BASE_POINTS_PER_CORRECT_ANSWER = 100;

/**
 * Standard 100-Point Marking System.
 *
 * Rules:
 * - Sahi (correct) answer: 100 points (scaled by pointsMultiplier if set, e.g. 100 * multiplier)
 * - Galat (wrong) / late answer: 0 points
 * - Ties on leaderboard are cleanly broken by fastest response time (fastestTimeMs)
 */
export function calculateScore({
  isCorrect,
  elapsedMs = 0,
  timeLimitSeconds = 15,
  pointsMultiplier = 1.0,
}) {
  if (!isCorrect) {
    return 0;
  }

  const multiplier = typeof pointsMultiplier === 'number' && pointsMultiplier > 0 ? pointsMultiplier : 1.0;
  return Math.round(BASE_POINTS_PER_CORRECT_ANSWER * multiplier);
}
