import { describe, test, expect } from 'vitest';
import { sortStandings, getHeadToHeadDiff, getMetricValue } from '../../src/lib/matchmaking/standings';
import { StandingRow, MatchHistory } from '../../src/lib/matchmaking/types';

describe('Session Standings Tests', () => {
  test('Metric calculation AVG_POINT_DIFF is normalized per match', () => {
    // Player A has +12 in 2 matches. Avg = +6.
    // Player B has +10 in 1 match. Avg = +10.
    const rowA: StandingRow = {
      profileId: 'A',
      matchesPlayed: 2,
      sessionPointsFor: 44,
      sessionPointsAgainst: 32, // +12
      sessionWins: 2,
      sessionLosses: 0,
      sessionDraws: 0,
      seedElo: 1000,
    };

    const rowB: StandingRow = {
      profileId: 'B',
      matchesPlayed: 1,
      sessionPointsFor: 21,
      sessionPointsAgainst: 11, // +10
      sessionWins: 1,
      sessionLosses: 0,
      sessionDraws: 0,
      seedElo: 1000,
    };

    expect(getMetricValue(rowA, 'AVG_POINT_DIFF')).toBe(6);
    expect(getMetricValue(rowB, 'AVG_POINT_DIFF')).toBe(10);
  });

  test('Ties resolved by Head-to-Head Point Differential', () => {
    // Player A and Player B are tied on AVG_POINT_DIFF (+5 each) and wins (1 each)
    const standings: StandingRow[] = [
      {
        profileId: 'A',
        matchesPlayed: 2,
        sessionPointsFor: 30,
        sessionPointsAgainst: 20, // +10 net, avg = +5
        sessionWins: 1,
        sessionLosses: 1,
        sessionDraws: 0,
        seedElo: 1000,
      },
      {
        profileId: 'B',
        matchesPlayed: 2,
        sessionPointsFor: 30,
        sessionPointsAgainst: 20, // +10 net, avg = +5
        sessionWins: 1,
        sessionLosses: 1,
        sessionDraws: 0,
        seedElo: 1000,
      },
    ];

    // History: X and Y played against each other in round 1
    // Team (A, C) vs (B, D) with score 21 - 15. A gets +6 net against B.
    const matches: MatchHistory[] = [
      {
        id: 'm1',
        roundNumber: 1,
        teamA: ['A', 'C'],
        teamB: ['B', 'D'],
        scoreA: 21,
        scoreB: 15,
      },
    ];

    expect(getHeadToHeadDiff('A', 'B', matches)).toBe(6);
    expect(getHeadToHeadDiff('B', 'A', matches)).toBe(-6);

    const sorted = sortStandings(standings, matches, 'AVG_POINT_DIFF', 'seed_xyz');
    expect(sorted[0].profileId).toBe('A');
    expect(sorted[1].profileId).toBe('B');
  });

  test('Ties resolved by Seed Elo if Head-to-Head is tied or 0', () => {
    // Player A (Elo 1050) and Player B (Elo 1000) are tied on metric and wins, no H2H
    const standings: StandingRow[] = [
      {
        profileId: 'B',
        matchesPlayed: 1,
        sessionPointsFor: 21,
        sessionPointsAgainst: 15, // +6
        sessionWins: 1,
        sessionLosses: 0,
        sessionDraws: 0,
        seedElo: 1000,
      },
      {
        profileId: 'A',
        matchesPlayed: 1,
        sessionPointsFor: 21,
        sessionPointsAgainst: 15, // +6
        sessionWins: 1,
        sessionLosses: 0,
        sessionDraws: 0,
        seedElo: 1050,
      },
    ];

    const sorted = sortStandings(standings, [], 'AVG_POINT_DIFF', 'seed_xyz');
    expect(sorted[0].profileId).toBe('A'); // higher seed elo
    expect(sorted[1].profileId).toBe('B');
  });

  test('Seeded random provides a stable total order for equal players', () => {
    // Equal players in every metric, no H2H
    const standings: StandingRow[] = [
      {
        profileId: 'A',
        matchesPlayed: 1,
        sessionPointsFor: 20,
        sessionPointsAgainst: 20,
        sessionWins: 0,
        sessionLosses: 1,
        sessionDraws: 0,
        seedElo: 1000,
      },
      {
        profileId: 'B',
        matchesPlayed: 1,
        sessionPointsFor: 20,
        sessionPointsAgainst: 20,
        sessionWins: 0,
        sessionLosses: 1,
        sessionDraws: 0,
        seedElo: 1000,
      },
    ];

    const sorted1 = sortStandings(standings, [], 'AVG_POINT_DIFF', 'seed_xyz');
    const sorted2 = sortStandings(standings, [], 'AVG_POINT_DIFF', 'seed_xyz');
    
    // Check stability
    expect(sorted1[0].profileId).toBe(sorted2[0].profileId);
    expect(sorted1[1].profileId).toBe(sorted2[1].profileId);
  });
});
