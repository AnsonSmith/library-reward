import { describe, it, expect } from 'vitest';
import { drawWinner, seededRng, cryptoRng } from '../../src/domain/drawing';
import type { RosterEntry } from '../../src/domain/types';

function pool(n: number): RosterEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    displayName: `Student ${i}`,
    barcode: String(i),
    matchKey: String(i),
    districtId: null,
    patronType: 'Student' as const,
    status: 'Active' as const,
    homeroom: 'Marigold, Rita',
    sourceRow: i + 2,
  }));
}

describe('drawWinner', () => {
  it('returns null for an empty pool instead of throwing', () => {
    // A homeroom where nobody can win must not crash the app in front of a class.
    expect(drawWinner([], seededRng(1))).toBeNull();
  });

  it('always returns a member of the pool', () => {
    const candidates = pool(7);
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const winner = drawWinner(candidates, rng)!;
      expect(candidates).toContain(winner);
    }
  });

  it('returns the only candidate when there is one', () => {
    const candidates = pool(1);
    expect(drawWinner(candidates, seededRng(9))).toBe(candidates[0]);
  });

  it('is deterministic for a given seed', () => {
    const candidates = pool(20);
    const a = Array.from({ length: 30 }, () => drawWinner(candidates, seededRng(7))!.matchKey);
    const b = Array.from({ length: 30 }, () => drawWinner(candidates, seededRng(7))!.matchKey);
    expect(a).toEqual(b);
  });

  it('works with the production CSPRNG', () => {
    const candidates = pool(25);
    for (let i = 0; i < 50; i++) {
      expect(candidates).toContain(drawWinner(candidates, cryptoRng)!);
    }
  });
});

describe('selection fairness', () => {
  it('selects every candidate and stays close to equal chance over 1000 draws', () => {
    // SC-008: no child should be noticeably less likely to win across a school year.
    const candidates = pool(25);
    const rng = seededRng(2026);
    const counts = new Map<string, number>();
    const draws = 1000;

    for (let i = 0; i < draws; i++) {
      const winner = drawWinner(candidates, rng)!;
      counts.set(winner.matchKey, (counts.get(winner.matchKey) ?? 0) + 1);
    }

    expect(counts.size).toBe(candidates.length);
    const expected = draws / candidates.length; // 40
    for (const [, n] of counts) {
      expect(n).toBeGreaterThan(expected * 0.5);
      expect(n).toBeLessThan(expected * 1.5);
    }
  });

  it('the production RNG covers the whole range including the top index', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) seen.add(cryptoRng(5));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
