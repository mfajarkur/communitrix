import { K_BASE, K_PROVISIONAL } from './constants';
import { calculateMoV } from './normalize';

export interface PlayerInput {
  id: string;
  ratingBefore: number;
  totalMatchesPlayed: number; // to check if provisional (< 10 matches)
}

export interface EloMatchInput {
  teamA: PlayerInput[];
  teamB: PlayerInput[];
  scoreA: number;
  scoreB: number;
  scoringType: 'POINTS' | 'GAMES';
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED';
  maxScoreTarget: number;
  // Session details for K-factor damping
  roundsPlanned: number | null;
  courtCount: number;
  playersPerMatch: 2 | 4;
  attendeeCount: number;
}

export interface PlayerDelta {
  id: string;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
  kFactor: number;
}

export interface EloMatchResult {
  teamADeltas: PlayerDelta[];
  teamBDeltas: PlayerDelta[];
  expectedScoreA: number;
  mov: number;
  kEff: number;
}

export function calculateElo(input: EloMatchInput): EloMatchResult {
  const {
    teamA,
    teamB,
    scoreA,
    scoreB,
    scoringType,
    pointsMode,
    maxScoreTarget,
    roundsPlanned,
    courtCount,
    playersPerMatch,
    attendeeCount,
  } = input;

  // 1. Calculate Expected Matches per Player
  let expectedMatches = 1;
  const activeCount = Math.max(attendeeCount, 1);
  const playingSlots = Math.min(Math.floor(activeCount / playersPerMatch), courtCount) * playersPerMatch;

  if (roundsPlanned !== null && roundsPlanned !== undefined) {
    expectedMatches = Math.floor(roundsPlanned * (playingSlots / activeCount));
  } else {
    expectedMatches = Math.floor((courtCount * playersPerMatch / activeCount) * 8);
  }
  expectedMatches = Math.max(expectedMatches, 1);

  // 2. Calculate Format Damping
  const formatDamping = 1 / Math.sqrt(expectedMatches);

  // 3. Calculate Team average ratings
  const avgRatingA = teamA.reduce((sum, p) => sum + p.ratingBefore, 0) / teamA.length;
  const avgRatingB = teamB.reduce((sum, p) => sum + p.ratingBefore, 0) / teamB.length;

  // 4. Expected Score (E_A)
  const expectedScoreA = 1 / (1 + Math.pow(10, (avgRatingB - avgRatingA) / 400));

  // 5. Outcome (W_A)
  let wA = 0.5;
  if (scoreA > scoreB) {
    wA = 1.0;
  } else if (scoreB > scoreA) {
    wA = 0.0;
  }

  // 6. Margin of Victory (MoV)
  const mov = calculateMoV(scoreA, scoreB, scoringType, pointsMode, maxScoreTarget);

  // 7. Calculate individual K_eff and find the mean
  const allPlayers = [...teamA, ...teamB];
  const playerKEffs = allPlayers.map(p => {
    const isProvisional = p.totalMatchesPlayed < 10;
    const kBaseVal = isProvisional ? K_PROVISIONAL : K_BASE;
    return kBaseVal * formatDamping;
  });

  // Zero-sum constraint: Use the mean K_eff of all players in the match
  const kEff = playerKEffs.reduce((sum, k) => sum + k, 0) / allPlayers.length;

  // 8. Delta calculation
  const rawDelta = kEff * mov * (wA - expectedScoreA);
  // Round to 2 decimal places to match database numeric(6,2) representation
  const delta = Math.round(rawDelta * 100) / 100;

  const getDeltas = (team: PlayerInput[], sign: number): PlayerDelta[] => {
    return team.map(p => {
      const isProvisional = p.totalMatchesPlayed < 10;
      const kFactor = (isProvisional ? K_PROVISIONAL : K_BASE) * formatDamping;
      const pDelta = sign * delta;
      // Round ratings after to 2 decimal places
      const ratingAfter = Math.round((p.ratingBefore + pDelta) * 100) / 100;
      return {
        id: p.id,
        ratingBefore: p.ratingBefore,
        delta: pDelta,
        ratingAfter,
        kFactor,
      };
    });
  };

  return {
    teamADeltas: getDeltas(teamA, 1),
    teamBDeltas: getDeltas(teamB, -1),
    expectedScoreA,
    mov,
    kEff,
  };
}
