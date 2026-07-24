import { describe, test, expect } from 'vitest';
import { calculateElo } from '../../src/lib/elo/calculate';
import { ELO_TEST_VECTORS } from '../../src/lib/elo/vectors';

describe('Elo Engine Tests', () => {
  test('Matches test vectors exactly', () => {
    for (const vector of ELO_TEST_VECTORS) {
      const result = calculateElo(vector.input);
      
      // Verify expected values
      expect(result.expectedScoreA).toBeCloseTo(vector.expectedExpectedScoreA, 4);
      expect(result.mov).toBeCloseTo(vector.expectedMoV, 4);
      
      // Check that the sum of deltas is exactly 0 (Zero-sum invariant)
      const sumDeltas = [...result.teamADeltas, ...result.teamBDeltas].reduce((s, p) => s + p.delta, 0);
      expect(sumDeltas).toBe(0);

      // Verify A's first player delta matches the expected delta within rounding
      expect(result.teamADeltas[0].delta).toBeCloseTo(vector.expectedDelta, 1);
    }
  });

  test('K-factor damping calculation is correct', () => {
    // 8 rounds planned, courtCount=2, playersPerMatch=4, attendeeCount=8
    // activeCount = 8. playingSlots = min(2, 2) * 4 = 8.
    // expectedMatches = roundsPlanned * (playingSlots / activeCount) = 8 * (8 / 8) = 8
    // damping = 1 / sqrt(8) = 1 / 2.828427 = 0.35355
    // K_base = 24 -> K_eff_settled = 24 * 0.35355 = 8.485
    // K_prov = 48 -> K_eff_prov = 48 * 0.35355 = 16.97
    const input = {
      teamA: [{ id: 'p1', ratingBefore: 1000, totalMatchesPlayed: 12 }], // settled
      teamB: [{ id: 'p2', ratingBefore: 1000, totalMatchesPlayed: 5 }], // provisional
      scoreA: 24,
      scoreB: 12,
      scoringType: 'POINTS' as const,
      pointsMode: 'FIRST_TO_TARGET' as const,
      maxScoreTarget: 24,
      roundsPlanned: 8,
      courtCount: 2,
      playersPerMatch: 4 as const,
      attendeeCount: 8,
    };

    const result = calculateElo(input);
    
    // Average K-factor: (8.485 + 16.97) / 2 = 12.7275
    expect(result.kEff).toBeCloseTo(12.7279, 4);
    
    // Check that provisional player A1 delta is calculated using the average K-factor
    // raw delta = 12.7279 * MoV(1.25) * (W - E) (1.0 - 0.5) = 12.7279 * 1.25 * 0.5 = 7.95
    expect(result.teamADeltas[0].delta).toBeCloseTo(7.95, 1);
  });

  test('Elo is zero-sum in all cases', () => {
    const input = {
      teamA: [
        { id: 'p1', ratingBefore: 1120, totalMatchesPlayed: 10 },
        { id: 'p2', ratingBefore: 980, totalMatchesPlayed: 15 },
      ],
      teamB: [
        { id: 'p3', ratingBefore: 1050, totalMatchesPlayed: 5 },
        { id: 'p4', ratingBefore: 1000, totalMatchesPlayed: 20 },
      ],
      scoreA: 15,
      scoreB: 21,
      scoringType: 'POINTS' as const,
      pointsMode: 'FIRST_TO_TARGET' as const,
      maxScoreTarget: 21,
      roundsPlanned: null,
      courtCount: 2,
      playersPerMatch: 4 as const,
      attendeeCount: 10,
    };

    const result = calculateElo(input);
    const sumDeltas = [...result.teamADeltas, ...result.teamBDeltas].reduce((s, p) => s + p.delta, 0);
    expect(sumDeltas).toBe(0);
    
    // Check delta signs: Team B won, so Team A deltas should be negative and B positive
    expect(result.teamADeltas[0].delta).toBeLessThan(0);
    expect(result.teamBDeltas[0].delta).toBeGreaterThan(0);
  });
});
