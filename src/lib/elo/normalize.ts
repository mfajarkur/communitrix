import { MARGIN_WEIGHT } from './constants';

export function calculateMoV(
  scoreA: number,
  scoreB: number,
  scoringType: 'POINTS' | 'GAMES',
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED',
  maxScoreTarget: number
): number {
  const margin = Math.abs(scoreA - scoreB);
  let denom = maxScoreTarget;

  if (scoringType === 'POINTS' && pointsMode === 'TIMED') {
    denom = Math.max(scoreA + scoreB, 1);
  }

  // Prevent division by zero
  if (denom <= 0) {
    denom = 1;
  }

  const m = Math.min(Math.max(margin / denom, 0), 1);
  return 1 + MARGIN_WEIGHT * m;
}
