import { describe, it, expect } from 'vitest';
import {
  serialToCalendarDate,
  parseDueDateCell,
  todayLocal,
  isBefore,
} from '../../src/parsing/excelDate';

describe('excel serial dates', () => {
  it('converts the serials observed in the real circulation export', () => {
    // 45798.55032407407 appeared as a Fine Assessed Date in PatronCircReportJob829808.
    expect(serialToCalendarDate(45798.55032407407)).toBe('2025-05-21');
    expect(serialToCalendarDate(45539.0841087963)).toBe('2024-09-04');
    expect(serialToCalendarDate(46098.41546296296)).toBe('2026-03-17');
  });

  it('discards time of day so a book due at 3pm is not overdue at 9am', () => {
    expect(serialToCalendarDate(45798.0)).toBe(serialToCalendarDate(45798.999));
  });

  it('handles known reference points', () => {
    expect(serialToCalendarDate(45000)).toBe('2023-03-15');
    expect(serialToCalendarDate(44927)).toBe('2023-01-01');
  });

  it('rejects numbers too small to be plausible dates', () => {
    expect(serialToCalendarDate(0)).toBeNull();
    expect(serialToCalendarDate(12)).toBeNull();
    expect(serialToCalendarDate(NaN)).toBeNull();
  });
});

describe('parseDueDateCell', () => {
  it('parses serial, ISO, and US text dates', () => {
    expect(parseDueDateCell('45798')).toBe('2025-05-21');
    expect(parseDueDateCell('2026-03-05')).toBe('2026-03-05');
    expect(parseDueDateCell('2026-3-5')).toBe('2026-03-05');
    expect(parseDueDateCell('3/5/2026')).toBe('2026-03-05');
    expect(parseDueDateCell('3-5-26')).toBe('2026-03-05');
    expect(parseDueDateCell(' 3/5/2026 ')).toBe('2026-03-05');
  });

  it('returns null for blank cells', () => {
    // Every Due cell in the reference circulation export is blank.
    expect(parseDueDateCell('')).toBeNull();
    expect(parseDueDateCell('   ')).toBeNull();
    expect(parseDueDateCell(null)).toBeNull();
    expect(parseDueDateCell(undefined)).toBeNull();
  });

  it('returns null for values it cannot read, rather than guessing', () => {
    expect(parseDueDateCell('sometime next week')).toBeNull();
    expect(parseDueDateCell('##########')).toBeNull();
    expect(parseDueDateCell('13/45/2026')).toBeNull();
  });
});

describe('calendar comparison', () => {
  it('compares whole days', () => {
    expect(isBefore('2026-03-04', '2026-03-05')).toBe(true);
    expect(isBefore('2026-03-05', '2026-03-05')).toBe(false);
    expect(isBefore('2026-03-06', '2026-03-05')).toBe(false);
  });

  it('formats today as a local ISO date', () => {
    expect(todayLocal(new Date(2026, 7, 30, 23, 59))).toBe('2026-08-30');
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
