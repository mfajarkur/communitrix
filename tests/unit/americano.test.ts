import { describe, test, expect } from 'vitest';
import { generateAmericanoRound } from '../../src/lib/matchmaking/americano';
import { Attendee, PastPairing } from '../../src/lib/matchmaking/types';

describe('Americano Matchmaking Scheduler Tests', () => {
  test('N=4 precomputed perfect schedule rotation', () => {
    const attendees: Attendee[] = Array.from({ length: 4 }, (_, idx) => ({
      id: `p_${idx + 1}`,
      seedElo: 1000,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    const history: PastPairing[] = [];

    // Round 1
    const round1 = generateAmericanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history,
      seed: 'session_xyz:1',
    });

    expect(round1.courts.length).toBe(1);
    expect(round1.sitOuts.length).toBe(0);

    // Round 2
    const round2 = generateAmericanoRound({
      roundNumber: 2,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history,
      seed: 'session_xyz:2',
    });

    // Round 3
    const round3 = generateAmericanoRound({
      roundNumber: 3,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history,
      seed: 'session_xyz:3',
    });

    // Make sure we have 3 unique sets of pairings
    const getPartners = (r: typeof round1) => {
      const c = r.courts[0];
      return [c.teamA.sort().join(','), c.teamB.sort().join(',')].sort().join(' vs ');
    };

    const p1 = getPartners(round1);
    const p2 = getPartners(round2);
    const p3 = getPartners(round3);

    expect(p1).not.toBe(p2);
    expect(p2).not.toBe(p3);
    expect(p3).not.toBe(p1);
  });

  test('N=8 precomputed perfect schedule wraps around', () => {
    const attendees: Attendee[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `p_${idx + 1}`,
      seedElo: 1000,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    // Round 8 should wrap around to Round 1 mapping
    const round1 = generateAmericanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 2,
      attendees,
      history: [],
      seed: 'session_xyz:1',
    });

    const round8 = generateAmericanoRound({
      roundNumber: 8,
      playersPerMatch: 4,
      courtCount: 2,
      attendees,
      history: [],
      seed: 'session_xyz:8',
    });

    expect(JSON.stringify(round1)).toBe(JSON.stringify(round8));
  });

  test('General case N=6, courtCount=1 (2 sit-outs) uses greedy search', () => {
    const attendees: Attendee[] = Array.from({ length: 6 }, (_, idx) => ({
      id: `p_${idx + 1}`,
      seedElo: 1000,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    const round = generateAmericanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 1,
      attendees,
      history: [],
      seed: 'session_xyz:1',
    });

    expect(round.courts.length).toBe(1);
    expect(round.sitOuts.length).toBe(2);
  });

  test('Matchmaking is fully deterministic', () => {
    const attendees: Attendee[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `p_${idx + 1}`,
      seedElo: 1000,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    const round1A = generateAmericanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 2,
      attendees,
      history: [],
      seed: 'fixed_seed',
    });

    const round1B = generateAmericanoRound({
      roundNumber: 1,
      playersPerMatch: 4,
      courtCount: 2,
      attendees,
      history: [],
      seed: 'fixed_seed',
    });

    expect(JSON.stringify(round1A)).toBe(JSON.stringify(round1B));
  });
});
