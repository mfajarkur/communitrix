import { describe, test, expect } from 'vitest';
import { selectSitOuts } from '../../src/lib/matchmaking/sitout';
import { Attendee } from '../../src/lib/matchmaking/types';

describe('Sit-out Fairness Simulation Tests', () => {
  const runSimulation = (n: number, playersPerMatch: 2 | 4, rounds: number) => {
    // Initialize attendees
    let attendees: Attendee[] = Array.from({ length: n }, (_, idx) => ({
      id: `p_${idx + 1}`,
      seedElo: 1000,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    const courtCount = 2; // Fixed number of courts for capacity
    const playingSlots = Math.min(Math.floor(n / playersPerMatch), courtCount) * playersPerMatch;
    const sitOutCount = n - playingSlots;

    for (let r = 1; r <= rounds; r++) {
      const seed = `session_xyz:${r}`;
      const sitOuts = selectSitOuts(attendees, sitOutCount, r, seed);

      // Verify consecutive sit-out constraint: no player sits out twice in a row
      sitOuts.forEach(sid => {
        const player = attendees.find(a => a.id === sid)!;
        if (player.lastSitOutRound !== null) {
          expect(player.lastSitOutRound).not.toBe(r - 1);
        }
      });

      // Update counters
      attendees = attendees.map(a => {
        if (sitOuts.includes(a.id)) {
          return {
            ...a,
            sitOutCount: a.sitOutCount + 1,
            lastSitOutRound: r,
          };
        } else {
          return {
            ...a,
            matchesPlayed: a.matchesPlayed + 1,
          };
        }
      });
    }

    // Verify maximum spread constraint: maximum difference in sit_out_count is <= 1
    const counts = attendees.map(a => a.sitOutCount);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    expect(maxCount - minCount).toBeLessThanOrEqual(1);
  };

  test('Simulation N=5, doubles (playersPerMatch=4), 10 rounds', () => {
    runSimulation(5, 4, 10);
  });

  test('Simulation N=6, doubles, 10 rounds', () => {
    runSimulation(6, 4, 10);
  });

  test('Simulation N=7, doubles, 10 rounds', () => {
    runSimulation(7, 4, 10);
  });

  test('Simulation N=9, doubles, 10 rounds', () => {
    runSimulation(9, 4, 10);
  });

  test('Simulation N=11, doubles, 10 rounds', () => {
    runSimulation(11, 4, 10);
  });

  test('Simulation N=13, doubles, 10 rounds', () => {
    runSimulation(13, 4, 10);
  });

  test('Simulation N=3, singles (playersPerMatch=2), 10 rounds', () => {
    runSimulation(3, 2, 10);
  });
});
