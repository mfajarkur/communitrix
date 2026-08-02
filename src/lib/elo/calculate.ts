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
  // Selects which rule set applies (docs/communitrix-elo-adjustment-brief.md). Defaults to 1 —
  // the original flat-split formula, which every match created before formula_version=2 shipped
  // must keep reproducing exactly, even on replay, so historical results never silently shift.
  // 2 adds the Carry Rule (partner delta split by within-team Elo gap, see getDeltas below).
  formulaVersion?: number;
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
    formulaVersion = 1,
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

  // 3. Calculate Team average & Effective ratings (GAP_PENALTY_FRACTION = 0.25). Gated behind
  // formulaVersion >= 2 — matches created under version 1 (and any historical match replayed
  // via void/replay) must keep using the raw average forever, per the formula-versioning
  // guarantee in docs/communitrix-elo-adjustment-brief.md Patch 2.
  const avgRatingA = teamA.reduce((sum, p) => sum + p.ratingBefore, 0) / teamA.length;
  const avgRatingB = teamB.reduce((sum, p) => sum + p.ratingBefore, 0) / teamB.length;

  const gapA = teamA.length === 2 ? Math.abs(teamA[0].ratingBefore - teamA[1].ratingBefore) : 0;
  const gapB = teamB.length === 2 ? Math.abs(teamB[0].ratingBefore - teamB[1].ratingBefore) : 0;

  const effRatingA = formulaVersion >= 2 ? avgRatingA - 0.25 * gapA : avgRatingA;
  const effRatingB = formulaVersion >= 2 ? avgRatingB - 0.25 * gapB : avgRatingB;

  // 4. Expected Score (E_A)
  const expectedScoreA = 1 / (1 + Math.pow(10, (effRatingB - effRatingA) / 400));

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

  // Carry Rule (formula_version >= 2, docs/communitrix-elo-adjustment-brief.md Patch 5): within
  // a doubles team, the delta both partners would get under the flat v1 split is instead shared
  // unevenly based on their own internal Elo gap — the lower-rated partner keeps more of a win
  // (up to 60%) and loses less of a loss (as little as 35%), scaled by how large that gap is
  // relative to GAP_REFERENCE. Singles matches and formulaVersion < 2 are unaffected: every
  // player on the team still gets the full, identical team delta (unchanged v1 behavior).
  const GAP_REFERENCE = 150;

  const buildDelta = (p: PlayerInput, pDelta: number): PlayerDelta => {
    const isProvisional = p.totalMatchesPlayed < 10;
    const kFactor = (isProvisional ? K_PROVISIONAL : K_BASE) * formatDamping;
    const ratingAfter = Math.round((p.ratingBefore + pDelta) * 100) / 100;
    return { id: p.id, ratingBefore: p.ratingBefore, delta: pDelta, ratingAfter, kFactor };
  };

  const getDeltas = (team: PlayerInput[], sign: number): PlayerDelta[] => {
    const teamDelta = sign * delta;

    if (formulaVersion < 2 || team.length < 2) {
      return team.map(p => buildDelta(p, teamDelta));
    }

    const sorted = [...team].sort((a, b) => a.ratingBefore - b.ratingBefore);
    const [lower, higher] = sorted;
    const eloGap = higher.ratingBefore - lower.ratingBefore;
    const skew = Math.min(eloGap / GAP_REFERENCE, 1.0);

    // isWinningTeam mirrors sign directly against wA rather than the team's own delta sign,
    // since a favorite that draws an underdog can still have a negative teamDelta despite wA
    // being 0.5 either way — this deliberately treats "not a clean win" the same as a loss for
    // share purposes, per the original design.
    const isWinningTeam = sign === 1 ? wA === 1.0 : wA === 0.0;
    const lowerShare = isWinningTeam ? 0.5 + skew * 0.1 : 1 - (0.5 + skew * 0.15);

    // Round only one side and derive the other by subtraction so the pair always sums to
    // exactly teamDelta, preserving the zero-sum invariant even after independent rounding.
    const lowerDelta = Math.round(teamDelta * lowerShare * 100) / 100;
    const higherDelta = Math.round((teamDelta - lowerDelta) * 100) / 100;

    return [buildDelta(lower, lowerDelta), buildDelta(higher, higherDelta)];
  };

  return {
    teamADeltas: getDeltas(teamA, 1),
    teamBDeltas: getDeltas(teamB, -1),
    expectedScoreA,
    mov,
    kEff,
  };
}
