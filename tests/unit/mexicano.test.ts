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

  test('Round >= 2: Respects custom standings metrics and matchHistory (H2H tiebreaker)', () => {
    const attendees: Attendee[] = [
      { id: 'p1', seedElo: 1000, matchesPlayed: 2, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p2', seedElo: 1000, matchesPlayed: 2, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p3', seedElo: 1000, matchesPlayed: 2, sitOutCount: 0, lastSitOutRound: null },
      { id: 'p4', seedElo: 1000, matchesPlayed: 2, sitOutCount: 0, lastSitOutRound: null },
    ];

    // Under WINS metric, p1 and p2 have 2 wins, p3 and p4 have 1 win.
    // They are tied on wins: p1 & p2 are tied with 2 wins.
    // However, they have a Head-to-Head match: p1 and p3 played against p2 and p4, score 21-10.
    // So p1 got +11 net against p2.
    // Standings points:
    const standings: StandingRow[] = [
      { profileId: 'p1', matchesPlayed: 2, sessionPointsFor: 42, sessionPointsAgainst: 20, sessionWins: 2, sessionLosses: 0, sessionDraws: 0, seedElo: 1000 },
      { profileId: 'p2', matchesPlayed: 2, sessionPointsFor: 42, sessionPointsAgainst: 30, sessionWins: 2, sessionLosses: 0, sessionDraws: 0, seedElo: 1000 },
      { profileId: 'p3', matchesPlayed: 2, sessionPointsFor: 21, sessionPointsAgainst: 40, sessionWins: 1, sessionLosses: 1, sessionDraws: 0, seedElo: 1000 },
      { profileId: 'p4', matchesPlayed: 2, sessionPointsFor: 21, sessionPointsAgainst: 40, sessionWins: 1, sessionLosses: 1, sessionDraws: 0, seedElo: 1000 },
    ];

    const matchHistory = [
      {
        id: 'm1',
        roundNumber: 1,
        teamA: ['p1', 'p3'],
        teamB: ['p2', 'p4'],
        scoreA: 21,
        scoreB: 10,
      }
    ];

    // Under 'WINS' metric:
    // Rank 1: p1 (2 wins, H2H winner over p2)
    // Rank 2: p2 (2 wins, H2H loser to p1)
    // Rank 3/4: p3/p4 (1 win, Elo/random tiebreaker)
    //
    // Let's call generateMexicanoRound with 'WINS' metric and matchHistory.
    const round = generateMexicanoRound({
      roundNumber: 2,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history: [],
      standings,
      seed: 'seed_xyz:2',
      metric: 'WINS',
      matchHistory,
    });

    const match = round.courts[0];
    
    // Team A: 1+4 (p1, p4 or p3 depending on tiebreaker)
    // Team B: 2+3 (p2, p3 or p4 depending on tiebreaker)
    // Since p1 is Rank 1, and p2 is Rank 2:
    // p1 and p2 MUST be on opposing teams!
    const inSameTeam = (match.teamA.includes('p1') && match.teamA.includes('p2')) ||
                       (match.teamB.includes('p1') && match.teamB.includes('p2'));
    expect(inSameTeam).toBe(false);
  });

  test('Proximity clustering: Priority players play and courts are clustered by rank proximity', () => {
    // 13 players: p1..p13
    // p8 (Awan) and p9 (Bayu) have 1 match played (1 bye). Others have 2 matches played.
    const attendees: Attendee[] = Array.from({ length: 13 }, (_, i) => ({
      id: `p${i + 1}`,
      seedElo: 1000 - i,
      matchesPlayed: (i === 7 || i === 8) ? 1 : 2,
      sitOutCount: (i === 7 || i === 8) ? 1 : 0,
      lastSitOutRound: (i === 7 || i === 8) ? 3 : null,
    }));

    const standings: StandingRow[] = Array.from({ length: 13 }, (_, i) => ({
      profileId: `p${i + 1}`,
      matchesPlayed: (i === 7 || i === 8) ? 1 : 2,
      sessionPointsFor: 20 - i,
      sessionPointsAgainst: 10 + i,
      sessionWins: i < 3 ? 2 : i < 7 ? 1 : 0,
      sessionLosses: 0,
      sessionDraws: 0,
      seedElo: 1000 - i,
    }));

    const round = generateMexicanoRound({
      roundNumber: 4,
      playersPerMatch: 4,
      courtCount: 2,
      attendees,
      history: [],
      standings,
      seed: 'session-wizard-4',
    });

    expect(round.courts.length).toBe(2);

    // Priority players p8 (Awan) and p9 (Bayu) MUST play (not sit out)
    expect(round.sitOuts).not.toContain('p8');
    expect(round.sitOuts).not.toContain('p9');

    // Court 1 should get top ranked playing players (from p1..p5) and NOT contain p8 or p9
    const court1Players = [...round.courts[0].teamA, ...round.courts[0].teamB];
    expect(court1Players).not.toContain('p8');
    expect(court1Players).not.toContain('p9');

    // Court 2 should contain p8 and p9 with their closest proximity neighbors (p10, p11)
    const court2Players = [...round.courts[1].teamA, ...round.courts[1].teamB];
    expect(court2Players).toContain('p8');
    expect(court2Players).toContain('p9');
    expect(court2Players).toContain('p10');
    expect(court2Players).toContain('p11');
  });
});
