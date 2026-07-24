import { StandingRow, MatchHistory } from './types';
import { createRNG } from './rng';

export type StandingsMetric = 'AVG_POINT_DIFF' | 'TOTAL_POINTS' | 'WINS';

/**
 * Calculates head-to-head point differential between two players.
 * Sum of (X_score - Y_score) for matches where X and Y played against each other.
 */
export function getHeadToHeadDiff(
  playerX: string,
  playerY: string,
  matches: MatchHistory[]
): number {
  let totalDiff = 0;

  for (const m of matches) {
    if (m.scoreA === null || m.scoreB === null) continue;

    const xInA = m.teamA.includes(playerX);
    const xInB = m.teamB.includes(playerX);
    const yInA = m.teamA.includes(playerY);
    const yInB = m.teamB.includes(playerY);

    if (xInA && yInB) {
      totalDiff += (m.scoreA - m.scoreB);
    } else if (xInB && yInA) {
      totalDiff += (m.scoreB - m.scoreA);
    }
  }

  return totalDiff;
}

/**
 * Calculates the metric value for a standing row.
 */
export function getMetricValue(row: StandingRow, metric: StandingsMetric): number {
  switch (metric) {
    case 'AVG_POINT_DIFF': {
      const diff = row.sessionPointsFor - row.sessionPointsAgainst;
      return diff / Math.max(row.matchesPlayed, 1);
    }
    case 'TOTAL_POINTS':
      return row.sessionPointsFor;
    case 'WINS':
      return row.sessionWins;
    default:
      return 0;
  }
}

/**
 * Sorts session standings based on the tiebreak chain:
 * 1. Metric value desc
 * 2. Session wins desc
 * 3. Head-to-head point differential desc
 * 4. Seed Elo desc
 * 5. Seeded random desc/asc (guarantees a total order)
 */
export function sortStandings(
  standings: StandingRow[],
  matches: MatchHistory[],
  metric: StandingsMetric,
  seed: string
): StandingRow[] {
  return [...standings].sort((a, b) => {
    // 1. Metric value desc
    const valA = getMetricValue(a, metric);
    const valB = getMetricValue(b, metric);
    if (Math.abs(valA - valB) > 0.0001) {
      return valB - valA;
    }

    // 2. Session wins desc
    if (a.sessionWins !== b.sessionWins) {
      return b.sessionWins - a.sessionWins;
    }

    // 3. Head-to-head point differential desc
    const h2h = getHeadToHeadDiff(a.profileId, b.profileId, matches);
    if (h2h !== 0) {
      return h2h < 0 ? 1 : -1; // h2h is for A against B, so if positive A is better, return negative
    }

    // 4. Seed Elo desc
    if (a.seedElo !== b.seedElo) {
      return b.seedElo - a.seedElo;
    }

    // 5. Seeded random (guarantees a total order, always)
    const rngA = createRNG(`${seed}:${a.profileId}`)();
    const rngB = createRNG(`${seed}:${b.profileId}`)();
    return rngB - rngA;
  });
}
