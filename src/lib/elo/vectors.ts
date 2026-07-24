import { EloMatchInput } from './calculate';

export interface TestVector {
  description: string;
  input: EloMatchInput;
  expectedExpectedScoreA: number;
  expectedMoV: number;
  expectedDelta: number; // raw value applied to team A (positive or negative)
}

export const ELO_TEST_VECTORS: TestVector[] = [
  {
    description: 'Equal ratings, clear win in POINTS FIRST_TO_TARGET mode',
    input: {
      teamA: [{ id: 'p1', ratingBefore: 1000, totalMatchesPlayed: 10 }],
      teamB: [{ id: 'p2', ratingBefore: 1000, totalMatchesPlayed: 10 }],
      scoreA: 24,
      scoreB: 12,
      scoringType: 'POINTS',
      pointsMode: 'FIRST_TO_TARGET',
      maxScoreTarget: 24,
      roundsPlanned: 8,
      courtCount: 2,
      playersPerMatch: 2,
      attendeeCount: 4, // 2 slots, expected matches = 8 * (2 / 4) = 4
    },
    expectedExpectedScoreA: 0.5,
    expectedMoV: 1 + 0.5 * (12 / 24), // 1.25
    expectedDelta: (24 / Math.sqrt(8)) * (1 + 0.5 * (12 / 24)) * (1.0 - 0.5), // K = 24 / sqrt(8) = 8.485. Delta = 8.485 * 1.25 * 0.5 = 5.3
  },
  {
    description: 'Underdog wins against favorite',
    input: {
      teamA: [
        { id: 'p1', ratingBefore: 900, totalMatchesPlayed: 10 },
        { id: 'p2', ratingBefore: 950, totalMatchesPlayed: 10 },
      ], // avg = 925
      teamB: [
        { id: 'p3', ratingBefore: 1050, totalMatchesPlayed: 10 },
        { id: 'p4', ratingBefore: 1100, totalMatchesPlayed: 10 },
      ], // avg = 1075
      scoreA: 21,
      scoreB: 19,
      scoringType: 'POINTS',
      pointsMode: 'FIRST_TO_TARGET',
      maxScoreTarget: 21,
      roundsPlanned: 6,
      courtCount: 2,
      playersPerMatch: 4,
      attendeeCount: 8, // 8 slots, expected matches = 6 * (8 / 8) = 6
    },
    expectedExpectedScoreA: 1 / (1 + Math.pow(10, (1075 - 925) / 400)), // 0.301
    expectedMoV: 1 + 0.5 * (2 / 21), // 1.0476
    expectedDelta: (24 / Math.sqrt(6)) * (1 + 0.5 * (2 / 21)) * (1.0 - (1 / (1 + Math.pow(10, 150 / 400)))),
  },
  {
    description: 'Provisional player has higher K-factor',
    input: {
      teamA: [{ id: 'p1', ratingBefore: 1000, totalMatchesPlayed: 5 }], // provisional
      teamB: [{ id: 'p2', ratingBefore: 1000, totalMatchesPlayed: 15 }], // settled
      scoreA: 24,
      scoreB: 24,
      scoringType: 'POINTS',
      pointsMode: 'TIMED',
      maxScoreTarget: 24,
      roundsPlanned: 8,
      courtCount: 2,
      playersPerMatch: 2,
      attendeeCount: 4, // expected matches = 8 * (2 / 4) = 4 -> damping = 1/2 = 0.5
    },
    expectedExpectedScoreA: 0.5,
    expectedMoV: 1.0, // draw -> margin = 0 -> MoV = 1.0
    expectedDelta: 0.0, // draw between equal ratings is 0 delta
  },
];
