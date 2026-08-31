import { describe, it, expect } from 'vitest';
import { weekKeyFor } from '../../src/domain/weekKey';

describe('weekKeyFor', () => {
  it('groups a Monday-to-Sunday school week under one key', () => {
    const week = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
    const keys = new Set(week.map(weekKeyFor));
    expect(keys.size).toBe(1);
  });

  it('starts a new key on the following Monday', () => {
    expect(weekKeyFor('2026-09-06')).not.toBe(weekKeyFor('2026-09-07'));
  });

  it('handles year boundaries the ISO way', () => {
    // 2026-12-31 is a Thursday, so it belongs to week 53 of 2026.
    expect(weekKeyFor('2026-12-31')).toBe('2026-W53');
    expect(weekKeyFor('2027-01-01')).toBe('2026-W53');
    expect(weekKeyFor('2027-01-04')).toBe('2027-W01');
  });

  it('is stable and zero-padded', () => {
    expect(weekKeyFor('2026-01-05')).toBe('2026-W02');
    expect(weekKeyFor('2026-03-05')).toBe('2026-W10');
  });
});
