/**
 * Picking the winner.
 *
 * Randomness is injected so the fairness properties are testable (SC-007, SC-008);
 * production uses a CSPRNG with rejection sampling, which costs nothing here and
 * removes any argument about modulo bias across a school year of drawings.
 */
import type { RosterEntry } from './types';

/** Returns a uniformly distributed integer in [0, upperBoundExclusive). */
export type Rng = (upperBoundExclusive: number) => number;

/** Rejection sampling over crypto.getRandomValues — unbiased for any bound. */
export const cryptoRng: Rng = (upperBoundExclusive: number): number => {
  if (upperBoundExclusive <= 0) throw new RangeError('upper bound must be positive');
  if (upperBoundExclusive === 1) return 0;

  const limit = Math.floor(0x1_0000_0000 / upperBoundExclusive) * upperBoundExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const value = buf[0] as number;
    // Discarding the tail keeps every outcome equally likely.
    if (value < limit) return value % upperBoundExclusive;
  }
};

/** Deterministic RNG for tests. Not used in production. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return (upperBoundExclusive: number): number => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state % upperBoundExclusive;
  };
}

/** One winner from the pool, or null when nobody can win. Never throws. */
export function drawWinner(candidates: RosterEntry[], rng: Rng = cryptoRng): RosterEntry | null {
  if (candidates.length === 0) return null;
  return candidates[rng(candidates.length)] ?? null;
}
