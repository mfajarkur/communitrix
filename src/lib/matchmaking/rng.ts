/**
 * Seeded, deterministic pseudo-random number generator (PRNG) using Mulberry32.
 * Hashing of the seed string is done using a simple FNV-1a like algorithm to get a 32-bit integer seed.
 */
export function createRNG(seedStr: string): () => number {
  // Hash the seedStr into a 32-bit unsigned integer
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;

  // Mulberry32 generator
  return function () {
    let z = (seed += 0x6D2B79F5 | 0);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic seeded random shuffle helper.
 * Shuffles an array in place.
 */
export function seededShuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
