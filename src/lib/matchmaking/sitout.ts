import { Attendee } from './types';
import { createRNG } from './rng';

export function selectSitOuts(
  attendees: Attendee[],
  sitOutCount: number,
  currentRound: number,
  seed: string
): string[] {
  if (sitOutCount <= 0) return [];
  if (attendees.length <= sitOutCount) {
    return attendees.map(a => a.id);
  }

  const rng = createRNG(seed);

  // Clone attendees to sort
  const sorted = [...attendees].sort((a, b) => {
    // 1. sit_out_count asc (fewest sit-outs sits out first)
    if (a.sitOutCount !== b.sitOutCount) {
      return a.sitOutCount - b.sitOutCount;
    }

    // Hard constraint: no consecutive sit-outs if possible
    // A player who sat out in the previous round is highly protected.
    const aPrev = a.lastSitOutRound === currentRound - 1;
    const bPrev = b.lastSitOutRound === currentRound - 1;
    if (aPrev !== bPrev) {
      return aPrev ? 1 : -1; // The one who sat out last round goes to the end
    }

    // 2. matches_played desc (most matches played sits out first)
    if (a.matchesPlayed !== b.matchesPlayed) {
      return b.matchesPlayed - a.matchesPlayed;
    }

    // 3. last_sit_out_round asc (longest since last sit-out sits out first, i.e., smaller round number)
    const aLast = a.lastSitOutRound ?? -1;
    const bLast = b.lastSitOutRound ?? -1;
    if (aLast !== bLast) {
      return aLast - bLast;
    }

    // 4. seededRandom(seed, profileId) asc (deterministic tiebreak)
    const randA = rng();
    const randB = rng();
    // In order to make the seeded random tie-break completely independent of sorting stability,
    // we can use a deterministic value derived from the profileId + seed.
    // Let's create an RNG per player ID to get a stable random value for that player!
    const rngA = createRNG(`${seed}:${a.id}`);
    const rngB = createRNG(`${seed}:${b.id}`);
    return rngA() - rngB();
  });

  return sorted.slice(0, sitOutCount).map(a => a.id);
}
