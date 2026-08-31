import { describe, it, expect } from 'vitest';
import { monthKeyFor, monthLabelFor } from '../../src/domain/monthKey';

describe('monthKeyFor', () => {
  it('groups every day of a calendar month under one key', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-15', '2026-09-29', '2026-09-30'];
    expect(new Set(days.map(monthKeyFor)).size).toBe(1);
    expect(monthKeyFor('2026-09-15')).toBe('2026-09');
  });

  it('starts a new key on the first of the next month', () => {
    // Two drawings four days apart across a month boundary are two drawings.
    expect(monthKeyFor('2026-09-30')).not.toBe(monthKeyFor('2026-10-04'));
  });

  it('is zero-padded, so keys sort chronologically as text', () => {
    const keys = ['2026-09-01', '2026-10-01', '2027-01-01'].map(monthKeyFor);
    expect(keys).toEqual(['2026-09', '2026-10', '2027-01']);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe('monthLabelFor', () => {
  it('reads as a month a person would say out loud', () => {
    expect(monthLabelFor('2026-09')).toBe('September 2026');
    expect(monthLabelFor('2027-01')).toBe('January 2027');
  });

  it('falls back to the key rather than inventing a month', () => {
    expect(monthLabelFor('not-a-month')).toBe('not-a-month');
    expect(monthLabelFor('2026-13')).toBe('2026-13');
  });
});
