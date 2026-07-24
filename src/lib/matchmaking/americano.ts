import { Attendee, PastPairing, PlannedMatch, RoundOutput } from './types';
import { createRNG, seededShuffle } from './rng';
import { selectSitOuts } from './sitout';

// Precomputed perfect schedules for N = 4 and N = 8
// These map player indices 0..N-1 to courts and teams
// Format: Round -> Court -> [teamA_indices, teamB_indices]
const PRECOMPUTED_SCHEDULES: Record<number, number[][][][]> = {
  4: [
    // 3 rounds
    [[[0, 3], [1, 2]]],
    [[[1, 3], [0, 2]]],
    [[[2, 3], [0, 1]]],
  ],
  8: [
    // 7 rounds
    [[[0, 7], [1, 5]], [[2, 3], [4, 6]]],
    [[[1, 7], [2, 6]], [[3, 4], [0, 5]]],
    [[[2, 7], [0, 3]], [[4, 5], [1, 6]]],
    [[[3, 7], [1, 4]], [[5, 6], [0, 2]]],
    [[[4, 7], [2, 5]], [[0, 6], [1, 3]]],
    [[[5, 7], [3, 6]], [[0, 1], [2, 4]]],
    [[[6, 7], [0, 4]], [[1, 2], [3, 5]]],
  ],
};

/**
 * Implements Americano Matchmaking.
 */
export function generateAmericanoRound(input: {
  roundNumber: number;
  playersPerMatch: 2 | 4;
  courtCount: number;
  attendees: Attendee[];
  history: PastPairing[];
  seed: string;
}): RoundOutput {
  const { roundNumber, playersPerMatch, courtCount, attendees, history, seed } = input;
  const activeCount = attendees.length;

  // 1. Calculate capacity
  const playingSlots = Math.min(Math.floor(activeCount / playersPerMatch), courtCount) * playersPerMatch;
  const sitOutCount = activeCount - playingSlots;

  if (playingSlots === 0) {
    throw new Error('INSUFFICIENT_PLAYERS');
  }

  // 2. Select sit-outs
  const sitOuts = selectSitOuts(attendees, sitOutCount, roundNumber, seed);
  const playingPool = attendees.filter(a => !sitOuts.includes(a.id));

  // 3. Check for precomputed perfect schedules (only if doubles/4 players per match and no active player limit changes)
  if (
    playersPerMatch === 4 &&
    (playingSlots === 4 || playingSlots === 8) &&
    PRECOMPUTED_SCHEDULES[playingSlots]
  ) {
    const schedule = PRECOMPUTED_SCHEDULES[playingSlots];
    const roundIdx = (roundNumber - 1) % schedule.length;
    const roundLayout = schedule[roundIdx];

    // Map stable sorted playing pool to the precomputed indices
    // We sort the playing pool by ID so the mapping is completely deterministic
    const sortedPlayers = [...playingPool].sort((a, b) => a.id.localeCompare(b.id));

    const courts: PlannedMatch[] = roundLayout.map((court, idx) => {
      const teamAIndices = court[0];
      const teamBIndices = court[1];
      return {
        courtNumber: idx + 1,
        teamA: teamAIndices.map(i => sortedPlayers[i].id),
        teamB: teamBIndices.map(i => sortedPlayers[i].id),
      };
    });

    return { courts, sitOuts };
  }

  // 4. General case: Greedy + Local Search (2-opt) optimization
  // Pre-process pairing counts from history
  const playerIds = attendees.map(a => a.id);
  const n = playerIds.length;
  const idToIndex = new Map<string, number>();
  playerIds.forEach((id, idx) => idToIndex.set(id, idx));

  const partnerCount = Array.from({ length: n }, () => new Int32Array(n));
  const opponentCount = Array.from({ length: n }, () => new Int32Array(n));

  for (const match of history) {
    // Add partner counts
    const updatePairs = (team: string[]) => {
      for (let i = 0; i < team.length; i++) {
        const u = idToIndex.get(team[i]);
        if (u === undefined) continue;
        for (let j = i + 1; j < team.length; j++) {
          const v = idToIndex.get(team[j]);
          if (v === undefined) continue;
          partnerCount[u][v]++;
          partnerCount[v][u]++;
        }
      }
    };
    updatePairs(match.teamA);
    updatePairs(match.teamB);

    // Add opponent counts
    for (const aId of match.teamA) {
      const u = idToIndex.get(aId);
      if (u === undefined) continue;
      for (const bId of match.teamB) {
        const v = idToIndex.get(bId);
        if (v === undefined) continue;
        opponentCount[u][v]++;
        opponentCount[v][u]++;
      }
    }
  }

  // Cost weights
  const W_PARTNER = 10;
  const W_OPPONENT = 3;
  const W_BALANCE = 1;

  // Map playing pool to current index list
  const playingIndices = playingPool.map(a => idToIndex.get(a.id)!);
  const eloMap = new Map<number, number>();
  playingPool.forEach(a => eloMap.set(idToIndex.get(a.id)!, a.seedElo));

  interface CourtAssignment {
    teamA: number[];
    teamB: number[];
  }

  // Helper to calculate total cost of an assignment
  const getAssignmentCost = (courts: CourtAssignment[]): number => {
    // Clone partner/opponent counts to simulate this round's addition
    const simPartner = partnerCount.map(row => new Int32Array(row));
    const simOpponent = opponentCount.map(row => new Int32Array(row));

    let balanceCost = 0;

    for (const c of courts) {
      // Balance cost
      const eloA = c.teamA.reduce((sum, idx) => sum + eloMap.get(idx)!, 0);
      const eloB = c.teamB.reduce((sum, idx) => sum + eloMap.get(idx)!, 0);
      balanceCost += Math.abs(eloA - eloB) / 100;

      // Add partnerships
      const addPartnerSim = (team: number[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            simPartner[team[i]][team[j]]++;
            simPartner[team[j]][team[i]]++;
          }
        }
      };
      addPartnerSim(c.teamA);
      addPartnerSim(c.teamB);

      // Add opponents
      for (const a of c.teamA) {
        for (const b of c.teamB) {
          simOpponent[a][b]++;
          simOpponent[b][a]++;
        }
      }
    }

    // Sum squared terms (undirected)
    let partnerSqSum = 0;
    let opponentSqSum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        partnerSqSum += simPartner[i][j] * simPartner[i][j];
        opponentSqSum += simOpponent[i][j] * simOpponent[i][j];
      }
    }

    return W_PARTNER * partnerSqSum + W_OPPONENT * opponentSqSum + W_BALANCE * balanceCost;
  };

  // Helper to optimize the intra-court configuration of a court of 4 players
  const optimizeCourtPairing = (players: number[]): CourtAssignment => {
    if (playersPerMatch === 2) {
      return { teamA: [players[0]], teamB: [players[1]] };
    }
    const [p0, p1, p2, p3] = players;
    const configs = [
      { teamA: [p0, p1], teamB: [p2, p3] },
      { teamA: [p0, p2], teamB: [p1, p3] },
      { teamA: [p0, p3], teamB: [p1, p2] },
    ];

    let bestConfig = configs[0];
    let minCost = Infinity;

    for (const conf of configs) {
      // Temp evaluation cost just for this court
      let bal = Math.abs(conf.teamA.reduce((s, idx) => s + eloMap.get(idx)!, 0) - conf.teamB.reduce((s, idx) => s + eloMap.get(idx)!, 0)) / 100;
      let part = 0;
      let opp = 0;

      // partnerships
      const pA1 = conf.teamA[0], pA2 = conf.teamA[1];
      const pB1 = conf.teamB[0], pB2 = conf.teamB[1];
      part += Math.pow(partnerCount[pA1][pA2] + 1, 2) - Math.pow(partnerCount[pA1][pA2], 2);
      part += Math.pow(partnerCount[pB1][pB2] + 1, 2) - Math.pow(partnerCount[pB1][pB2], 2);

      // opponents
      opp += Math.pow(opponentCount[pA1][pB1] + 1, 2) - Math.pow(opponentCount[pA1][pB1], 2);
      opp += Math.pow(opponentCount[pA1][pB2] + 1, 2) - Math.pow(opponentCount[pA1][pB2], 2);
      opp += Math.pow(opponentCount[pA2][pB1] + 1, 2) - Math.pow(opponentCount[pA2][pB1], 2);
      opp += Math.pow(opponentCount[pA2][pB2] + 1, 2) - Math.pow(opponentCount[pA2][pB2], 2);

      const score = W_PARTNER * part + W_OPPONENT * opp + W_BALANCE * bal;
      if (score < minCost) {
        minCost = score;
        bestConfig = conf;
      }
    }

    return bestConfig;
  };

  const rng = createRNG(seed);
  let bestGlobalCost = Infinity;
  let bestCourts: CourtAssignment[] = [];

  const candidatesCount = 200;

  for (let c = 0; c < candidatesCount; c++) {
    // Generate seeded shuffle of the playing pool
    const shuffled = seededShuffle(playingIndices, rng);

    // Chunk into courts
    const courts: CourtAssignment[] = [];
    const numCourts = playingSlots / playersPerMatch;
    for (let i = 0; i < numCourts; i++) {
      const courtPlayers = shuffled.slice(i * playersPerMatch, (i + 1) * playersPerMatch);
      courts.push(optimizeCourtPairing(courtPlayers));
    }

    let currentCost = getAssignmentCost(courts);

    // Run 2-opt swaps
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50) { // Safety ceiling of 50 iterations
      improved = false;
      iterations++;

      // Scan all pairs of players on different courts
      for (let c1 = 0; c1 < numCourts; c1++) {
        for (let c2 = c1 + 1; c2 < numCourts; c2++) {
          const playersC1 = [...courts[c1].teamA, ...courts[c1].teamB];
          const playersC2 = [...courts[c2].teamA, ...courts[c2].teamB];

          for (let i = 0; i < playersC1.length; i++) {
            for (let j = 0; j < playersC2.length; j++) {
              // Try swapping playersC1[i] and playersC2[j]
              const nextC1Players = [...playersC1];
              const nextC2Players = [...playersC2];
              nextC1Players[i] = playersC2[j];
              nextC2Players[j] = playersC1[i];

              // Optimize the two affected courts
              const optC1 = optimizeCourtPairing(nextC1Players);
              const optC2 = optimizeCourtPairing(nextC2Players);

              // Build draft court list
              const draftCourts = [...courts];
              draftCourts[c1] = optC1;
              draftCourts[c2] = optC2;

              const draftCost = getAssignmentCost(draftCourts);
              if (draftCost < currentCost) {
                courts[c1] = optC1;
                courts[c2] = optC2;
                currentCost = draftCost;
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    if (currentCost < bestGlobalCost) {
      bestGlobalCost = currentCost;
      bestCourts = courts;
    }
  }

  // Map the best assignment indices back to profile IDs
  const courtsOutput: PlannedMatch[] = bestCourts.map((c, idx) => ({
    courtNumber: idx + 1,
    teamA: c.teamA.map(idxVal => playerIds[idxVal]),
    teamB: c.teamB.map(idxVal => playerIds[idxVal]),
  }));

  return {
    courts: courtsOutput,
    sitOuts,
  };
}
