import { Attendee, PastPairing, PlannedMatch, RoundOutput, StandingRow, MatchHistory } from './types';
import { selectSitOuts } from './sitout';
import { sortStandings, StandingsMetric } from './standings';
import { createRNG } from './rng';

export interface MexicanoOptions {
  avoidRepeatPartner?: boolean;
}

/**
 * Generates combinations of size k from array arr.
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0 || k > arr.length) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = getCombinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

export function generateMexicanoRound(input: {
  roundNumber: number;
  playersPerMatch: 2 | 4;
  courtCount: number;
  attendees: Attendee[];
  history: PastPairing[];
  standings: StandingRow[];
  seed: string;
  options?: MexicanoOptions;
  metric?: StandingsMetric;
  matchHistory?: MatchHistory[];
}): RoundOutput {
  const { roundNumber, playersPerMatch, courtCount, attendees, history, standings, seed, options, metric, matchHistory } = input;
  const activeCount = attendees.length;

  // 1. Calculate capacity
  const playingSlots = Math.min(Math.floor(activeCount / playersPerMatch), courtCount) * playersPerMatch;
  const sitOutCount = activeCount - playingSlots;

  if (playingSlots === 0) {
    throw new Error('INSUFFICIENT_PLAYERS');
  }

  // 2. Sort ALL active attendees by overall standings rank (0 to activeCount - 1)
  let rankedAttendees: Attendee[] = [];
  if (roundNumber === 1 || standings.length === 0) {
    // Round 1 or empty standings: Sort by seedElo desc, tiebreak by id
    rankedAttendees = [...attendees].sort((a, b) => {
      if (b.seedElo !== a.seedElo) {
        return b.seedElo - a.seedElo;
      }
      return a.id.localeCompare(b.id);
    });
  } else {
    // Sort standings by the provided metric & matchHistory
    const activeStandings = standings.filter(s => attendees.some(p => p.id === s.profileId));
    const sortedActiveStandings = sortStandings(activeStandings, matchHistory || [], metric || 'AVG_POINT_DIFF', seed);

    // Map back to attendees
    const idToAttendee = new Map(attendees.map(a => [a.id, a]));
    rankedAttendees = sortedActiveStandings.map(s => idToAttendee.get(s.profileId)!).filter(Boolean);

    // Append any attendees missing from standings (e.g. late additions)
    const inStandings = new Set(rankedAttendees.map(a => a.id));
    const missing = attendees.filter(a => !inStandings.has(a.id)).sort((a, b) => b.seedElo - a.seedElo);
    rankedAttendees = [...rankedAttendees, ...missing];
  }

  // Map each attendee's overall rank index
  const rankIndexMap = new Map<string, number>();
  rankedAttendees.forEach((att, idx) => {
    rankIndexMap.set(att.id, idx);
  });

  let sitOuts: string[] = [];
  let playingPool: Attendee[] = [];

  if (sitOutCount === 0) {
    playingPool = rankedAttendees;
  } else {
    // Determine priority levels for sit-out protection
    const minMatchesPlayed = Math.min(...attendees.map(a => a.matchesPlayed));

    // Tier 0 (Protected / Must Play): players with fewest matches played or sat out last round
    const protectedIds = new Set(
      attendees
        .filter(a => a.matchesPlayed === minMatchesPlayed || a.lastSitOutRound === roundNumber - 1)
        .map(a => a.id)
    );

    // Candidates eligible to sit out
    const sitOutCandidates = attendees.filter(a => !protectedIds.has(a.id));

    let candidatePool: Attendee[] = sitOutCandidates;

    if (sitOutCandidates.length < sitOutCount) {
      // If Tier 1 candidates are fewer than required sit-outs, include Tier 0 candidates
      candidatePool = [...attendees];
    }

    // Sort candidatePool by sit-out priority so the highest-priority sit-out candidates are first
    candidatePool.sort((a, b) => {
      // 1. Prefer sitting out players with MORE matches played
      if (a.matchesPlayed !== b.matchesPlayed) {
        return b.matchesPlayed - a.matchesPlayed;
      }
      // 2. Prefer sitting out players who sat out fewer times
      if (a.sitOutCount !== b.sitOutCount) {
        return a.sitOutCount - b.sitOutCount;
      }
      // 3. Last sit out round asc (sat out longer ago)
      const aLast = a.lastSitOutRound ?? -1;
      const bLast = b.lastSitOutRound ?? -1;
      return aLast - bLast;
    });

    // Cap candidate pool to top 14 candidates if larger to guarantee fast execution
    if (candidatePool.length > 14) {
      candidatePool = candidatePool.slice(0, 14);
    }

    // Generate sit-out candidate combinations
    const combinations = getCombinations(candidatePool, sitOutCount);

    let bestSitOutSet: string[] = [];
    let bestCost = Infinity;

    for (const combo of combinations) {
      const sitOutIds = new Set(combo.map(a => a.id));
      const pool = rankedAttendees.filter(a => !sitOutIds.has(a.id));

      if (pool.length !== playingSlots) continue;

      // 1. Calculate Sit-Out Priority / Protection Cost
      let sitOutCost = 0;
      for (const p of combo) {
        // Penalty for sitting out a player with min matches played (MUST PLAY)
        if (p.matchesPlayed === minMatchesPlayed) {
          sitOutCost += 1_000_000;
        }
        // Penalty for sitting out a player who sat out last round
        if (p.lastSitOutRound === roundNumber - 1) {
          sitOutCost += 100_000;
        }
        // Penalty for sitting out a player who has sat out fewer times so far
        sitOutCost += (100 - p.sitOutCount) * 1_000;
        // Prefer sitting out players with more matches played
        sitOutCost += (100 - p.matchesPlayed) * 100;

        // Small deterministic tiebreak per player
        const rngP = createRNG(`${seed}:${p.id}`)();
        sitOutCost += rngP * 10;
      }

      // 2. Calculate Proximity Spread Cost across all courts
      let proximityCost = 0;
      const numCourts = playingSlots / playersPerMatch;
      for (let c = 0; c < numCourts; c++) {
        const courtPlayers = pool.slice(c * playersPerMatch, (c + 1) * playersPerMatch);
        const minIdx = rankIndexMap.get(courtPlayers[0].id) ?? 0;
        const maxIdx = rankIndexMap.get(courtPlayers[courtPlayers.length - 1].id) ?? 0;
        const spread = maxIdx - minIdx;
        proximityCost += spread * spread;
      }

      // Total Cost combines Sit-Out Fairness & Proximity
      const totalCost = sitOutCost + proximityCost * 1_000;

      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestSitOutSet = combo.map(a => a.id);
      }
    }

    if (bestSitOutSet.length === 0) {
      sitOuts = selectSitOuts(attendees, sitOutCount, roundNumber, seed);
    } else {
      sitOuts = bestSitOutSet;
    }

    playingPool = rankedAttendees.filter(a => !sitOuts.includes(a.id));
  }

  // 4. Group playing pool into courts of size playersPerMatch
  const courts: PlannedMatch[] = [];
  const numCourts = playingSlots / playersPerMatch;

  for (let c = 0; c < numCourts; c++) {
    const courtIdx = c + 1;
    const courtPlayers = playingPool.slice(c * playersPerMatch, (c + 1) * playersPerMatch);

    if (playersPerMatch === 2) {
      // Singles: 1v2, 3v4...
      courts.push({
        courtNumber: courtIdx,
        teamA: [courtPlayers[0].id],
        teamB: [courtPlayers[1].id],
      });
    } else {
      // Doubles: 4 players
      const p1 = courtPlayers[0].id;
      const p2 = courtPlayers[1].id;
      const p3 = courtPlayers[2].id;
      const p4 = courtPlayers[3].id;

      // Mexicano rule: (1 + 4) vs (2 + 3)
      let teamA = [p1, p4];
      let teamB = [p2, p3];

      if (options?.avoidRepeatPartner && history.length > 0) {
        const prevRound = roundNumber - 1;
        const prevMatches = history.filter(h => h.roundNumber === prevRound);

        const partnersRepeated = prevMatches.some(m => {
          const checkPartner = (team: string[]) => {
            const hasP1 = team.includes(p1);
            const hasP4 = team.includes(p4);
            const hasP2 = team.includes(p2);
            const hasP3 = team.includes(p3);
            return (hasP1 && hasP4) || (hasP2 && hasP3);
          };
          return checkPartner(m.teamA) || checkPartner(m.teamB);
        });

        if (partnersRepeated) {
          // Alternative: (1 + 3) vs (2 + 4)
          teamA = [p1, p3];
          teamB = [p2, p4];
        }
      }

      courts.push({
        courtNumber: courtIdx,
        teamA,
        teamB,
      });
    }
  }

  return {
    courts,
    sitOuts,
  };
}

