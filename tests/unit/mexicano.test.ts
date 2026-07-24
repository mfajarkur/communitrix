import { describe, test, expect } from 'vitest';
import { generateMexicanoRound } from '../../src/lib/matchmaking/mexicano';
import { Attendee, PastPairing, StandingRow } from '../../src/lib/matchmaking/types';

describe('Mexicano Matchmaking Scheduler Tests', () => {
  test('Round 1: Sorted by seedElo descending and paired 1+4 vs 2+3', () => {
    const attendees: Attendee[] = [
      { id: 'p1', seedElo: 1200, matchesPlayed: 0, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p2', seedElo: 900, matchesPlayed: 0, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p3', seedElo: 1100, matchesPlayed: 0, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p4', seedElo: 1000, matchesPlayed: 0, sitOutCount: 0, lastSitOutRound: null },
    ];

    // Sorted ranks:
    // 1st: p1 (1200)
    // 2nd: p3 (1100)
    // 3rd: p4 (1000)
    // 4th: p2 (900)

    const round = generateMexicanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history: [],
      standings: [],
      seed: 'seed_xyz:1',
    });

    expect(round.courts.length).toBe(1);
    const match = round.courts[0];
    
    // Team A: 1+4 (p1, p2)
    // Team B: 2+3 (p3, p4)
    expect(match.teamA).toContain('p1');
    expect(match.teamA).toContain('p2');
    expect(match.teamB).toContain('p3');
    expect(match.teamB).toContain('p4');
  });

  test('Round >= 2: Sorted by session standings', () => {
    const attendees: Attendee[] = [
      { id: 'p1', seedElo: 1000, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p2', seedElo: 1000, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p3', seedElo: 1000, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p4', seedElo: 1000, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
    ];

    const standings: StandingRow[] = [
      { profileId: 'p1', matchesPlayed: 1, sessionPointsFor: 10, sessionPointsAgainst: 20, sessionWins: 0, sessionLosses: 1, sessionDraws: 0, seedElo: 1000 }, // -10 (Rank 4)
      { profileId: 'p2', matchesPlayed: 1, sessionPointsFor: 25, sessionPointsAgainst: 5, sessionWins: 1, sessionLosses: 0, sessionDraws: 0, seedElo: 1000 },  // +20 (Rank 1)
      { profileId: 'p3', matchesPlayed: 1, sessionPointsFor: 21, sessionPointsAgainst: 15, sessionWins: 1, sessionLosses: 0, sessionDraws: 0, seedElo: 1000 }, // +6 (Rank 2)
      { profileId: 'p4', matchesPlayed: 1, sessionPointsFor: 15, sessionPointsAgainst: 21, sessionWins: 0, sessionLosses: 1, sessionDraws: 0, seedElo: 1000 }, // -6 (Rank 3)
    ];

    // Sorted standings rank:
    // 1st: p2 (+20)
    // 2nd: p3 (+6)
    // 3rd: p4 (-6)
    // 4th: p1 (-10)

    const round = generateMexicanoRound({
      roundNumber: 2,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history: [],
      standings,
      seed: 'seed_xyz:2',
    });

    const match = round.courts[0];
    // Team A: 1+4 (p2, p1)
    // Team B: 2+3 (p3, p4)
    expect(match.teamA).toContain('p2');
    expect(match.teamA).toContain('p1');
    expect(match.teamB).toContain('p3');
    expect(match.teamB).toContain('p4');
  });

  test('avoid_repeat_partner swaps pairing to 1+3 vs 2+4 if repeated', () => {
    const attendees: Attendee[] = [
      { id: 'p1', seedElo: 1200, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p2', seedElo: 900, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p3', seedElo: 1100, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p4', seedElo: 1000, matchesPlayed: 1, sitOutCount: 0, lastSitOutRound: null },
    ];

    const standings: StandingRow[] = [
      { profileId: 'p1', matchesPlayed: 1, sessionPointsFor: 21, sessionPointsAgainst: 0, sessionWins: 1, sessionLosses: 0, sessionDraws: 0, seedElo: 1200 },
      { profileId: 'p3', matchesPlayed: 1, sessionPointsFor: 21, sessionPointsAgainst: 0, sessionWins: 1, sessionLosses: 0, sessionDraws: 0, seedElo: 1100 },
      { profileId: 'p4', matchesPlayed: 1, sessionPointsFor: 0, sessionPointsAgainst: 21, sessionWins: 0, sessionLosses: 1, sessionDraws: 0, seedElo: 1000 },
      { profileId: 'p2', matchesPlayed: 1, sessionPointsFor: 0, sessionPointsAgainst: 21, sessionWins: 0, sessionLosses: 1, sessionDraws: 0, seedElo: 900 },
    ];

    // Standings sort order: p1, p3, p4, p2.
    // Default pairing would be 1+4 (p1, p2) vs 2+3 (p3, p4)

    // History: in previous round 1, p1 and p2 were indeed partners (and p3 and p4 were partners)
    const history: PastPairing[] = [
      {
        roundNumber: 1,
        teamA: ['p1', 'p2'],
        teamB: ['p3', 'p4'],
      },
    ];

    const round = generateMexicanoRound({
      roundNumber: 2,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history,
      standings,
      seed: 'seed_xyz:2',
      options: { avoidRepeatPartner: true },
    });

    const match = round.courts[0];
    
    // Should be swapped to 1+3 (p1, p4) vs 2+4 (p3, p2) due to avoidRepeatPartner
    expect(match.teamA).toContain('p1');
    expect(match.teamA).toContain('p4');
    expect(match.teamB).toContain('p3');
    expect(match.teamB).toContain('p2');
  });
});
