import { Attendee, PastPairing, PlannedMatch, RoundOutput, StandingRow, MatchHistory } from './types';
import { selectSitOuts } from './sitout';
import { sortStandings, StandingsMetric } from './standings';
import { createRNG } from './rng';

export interface MexicanoOptions {
  avoidRepeatPartner?: boolean;
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

  // 2. Select sit-outs
  const sitOuts = selectSitOuts(attendees, sitOutCount, roundNumber, seed);
  const playingPool = attendees.filter(a => !sitOuts.includes(a.id));

  // 3. Sort playing pool based on round number
  let sortedPool: Attendee[] = [];
  if (roundNumber === 1) {
    // Round 1: Sort by seedElo desc, tiebreak by id
    sortedPool = [...playingPool].sort((a, b) => {
      if (b.seedElo !== a.seedElo) {
        return b.seedElo - a.seedElo;
      }
      return a.id.localeCompare(b.id);
    });
  } else {
    // Round n >= 2: Sort by standings (we map standings to only active playing pool)
    const activeStandings = standings.filter(s => playingPool.some(p => p.id === s.profileId));
    // Sort them using the provided metric (defaulting to 'AVG_POINT_DIFF') and match history
    const sortedActiveStandings = sortStandings(activeStandings, matchHistory || [], metric || 'AVG_POINT_DIFF', seed);
    
    // Map back to attendees
    const idToAttendee = new Map(playingPool.map(a => [a.id, a]));
    sortedPool = sortedActiveStandings.map(s => idToAttendee.get(s.profileId)!).filter(Boolean);
  }

  // 4. Group into courts
  const courts: PlannedMatch[] = [];
  const numCourts = playingSlots / playersPerMatch;

  for (let c = 0; c < numCourts; c++) {
    const courtIdx = c + 1;
    const courtPlayers = sortedPool.slice(c * playersPerMatch, (c + 1) * playersPerMatch);

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

      // Default: (1 + 4) vs (2 + 3)
      let teamA = [p1, p4];
      let teamB = [p2, p3];

      if (options?.avoidRepeatPartner && history.length > 0) {
        // Find previous round's matches
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
