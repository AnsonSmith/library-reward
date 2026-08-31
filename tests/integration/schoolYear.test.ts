/**
 * The fairness promise, end to end: buildHomerooms + rounds + drawing, run as a
 * school year of weekly drawings. This is SC-007 — every student wins exactly once
 * before any student wins twice.
 */
import { describe, it, expect } from 'vitest';
import { buildHomerooms } from '../../src/domain/eligibility';
import { advanceRoundsIfComplete } from '../../src/domain/rounds';
import { drawWinner, seededRng } from '../../src/domain/drawing';
import { weekKeyFor } from '../../src/domain/weekKey';
import type { CirculationRow, RosterEntry, RoundState, WinRecord } from '../../src/domain/types';

const HOMEROOM = 'Marigold, Rita';

function roster(size: number, homeroom = HOMEROOM): RosterEntry[] {
  return Array.from({ length: size }, (_, i) => ({
    displayName: `Student ${String(i).padStart(2, '0')}`,
    barcode: String(1000 + i),
    matchKey: String(1000 + i),
    districtId: null,
    patronType: 'Student' as const,
    status: 'Active' as const,
    homeroom,
    sourceRow: i + 2,
  }));
}

function mondayOfWeek(index: number): string {
  const d = new Date(Date.UTC(2026, 8, 7)); // Monday 2026-09-07
  d.setUTCDate(d.getUTCDate() + index * 7);
  return d.toISOString().slice(0, 10);
}

interface SimOptions {
  weeks: number;
  students: RosterEntry[];
  circulationFor?: (week: number) => CirculationRow[];
  rosterFor?: (week: number, base: RosterEntry[], history: WinRecord[]) => RosterEntry[];
}

function simulate(opts: SimOptions) {
  const rng = seededRng(20260907);
  let history: WinRecord[] = [];
  let rounds: RoundState[] = [];
  const log: { week: number; winner: string | null; round: number }[] = [];

  for (let week = 0; week < opts.weeks; week++) {
    const today = mondayOfWeek(week);
    const currentRoster = opts.rosterFor
      ? opts.rosterFor(week, opts.students, history)
      : opts.students;
    const circulation = opts.circulationFor ? opts.circulationFor(week) : [];

    const { homerooms } = buildHomerooms({
      roster: currentRoster,
      circulation,
      history,
      rounds,
      today,
      rosterFileName: 'r.xlsx',
      circulationFileName: 'c.xlsx',
    });

    const hr = homerooms.find((h) => h.name === HOMEROOM);
    if (!hr) continue;

    const winner = drawWinner(hr.candidates, rng);
    if (winner) {
      history = [
        ...history,
        {
          id: `w${week}`,
          homeroom: hr.name,
          round: hr.currentRound,
          studentMatchKey: winner.matchKey,
          studentName: winner.displayName,
          drawnOn: today,
          weekKey: weekKeyFor(today),
          candidatePoolSize: hr.candidates.length,
        },
      ];
    }
    log.push({ week, winner: winner?.matchKey ?? null, round: hr.currentRound });

    // Recompute after the draw, exactly as the app does.
    const after = buildHomerooms({
      roster: currentRoster,
      circulation,
      history,
      rounds,
      today,
      rosterFileName: 'r.xlsx',
      circulationFileName: 'c.xlsx',
    });
    rounds = advanceRoundsIfComplete({ homerooms: after.homerooms, history, rounds, today });
  }

  return { history, rounds, log };
}

describe('a school year of drawings', () => {
  it('gives every student a turn before anyone repeats', () => {
    const students = roster(12);
    const { history, log } = simulate({ weeks: 12, students });

    expect(history).toHaveLength(12);
    const winners = history.map((w) => w.studentMatchKey);
    expect(new Set(winners).size).toBe(12);
    expect(log.every((entry) => entry.round === 1)).toBe(true);
  });

  it('resets the round and lets everyone win again in the next pass', () => {
    const students = roster(8);
    const { history, rounds } = simulate({ weeks: 16, students });

    expect(history).toHaveLength(16);
    const firstRound = history.filter((w) => w.round === 1).map((w) => w.studentMatchKey);
    const secondRound = history.filter((w) => w.round === 2).map((w) => w.studentMatchKey);

    expect(new Set(firstRound).size).toBe(8);
    expect(new Set(secondRound).size).toBe(8);
    expect(rounds.find((r) => r.homeroom === HOMEROOM)?.currentRound).toBe(3);
  });

  it('never lets a student win twice in one round even across many rounds', () => {
    const students = roster(6);
    const { history } = simulate({ weeks: 30, students });
    expect(history.length).toBeGreaterThan(0);

    const seen = new Set<string>();
    for (const w of history) {
      const key = `${w.round}:${w.studentMatchKey}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(students).toBeDefined();
  });

  it('skips a week when everyone still waiting has an overdue book', () => {
    const students = roster(3);
    // From week 2 on, every remaining student holds an overdue item.
    const circulationFor = (week: number): CirculationRow[] =>
      week < 2
        ? []
        : students.map((s, i) => ({
            displayName: s.displayName,
            barcode: s.barcode,
            matchKey: s.matchKey,
            transactionType: 'Overdue',
            dueDate: '2026-01-05',
            dueDateRaw: '46027',
            itemTitle: 'Dog Man',
            fineReason: null,
            sourceRow: i + 2,
          }));

    const { history, log } = simulate({ weeks: 5, students, circulationFor });
    expect(history).toHaveLength(2);
    expect(log.slice(2).every((entry) => entry.winner === null)).toBe(true);
  });

  it('lets a student who joins mid-year win in the round already under way', () => {
    const base = roster(4);
    const newcomer = roster(5)[4]!;
    const rosterFor = (week: number) => (week < 2 ? base : [...base, newcomer]);

    const { history } = simulate({ weeks: 5, students: base, rosterFor });
    const wonKeys = history.filter((w) => w.round === 1).map((w) => w.studentMatchKey);
    expect(wonKeys).toContain(newcomer.matchKey);
  });

  it('resets a round even though a past winner has left the school', () => {
    // FR-022: whoever wins in week 0 then leaves. The remaining three must still
    // be able to finish the round, and the round must still reset.
    const full = roster(4);
    const rosterFor = (week: number, base: RosterEntry[], history: WinRecord[]) => {
      if (week === 0 || history.length === 0) return base;
      const leaverKey = history[0]!.studentMatchKey;
      return base.filter((s) => s.matchKey !== leaverKey);
    };

    const { history, rounds } = simulate({ weeks: 4, students: full, rosterFor });
    const leaverKey = history[0]!.studentMatchKey;

    // The leaver never wins again, and the other three each take a turn.
    expect(history.filter((w) => w.studentMatchKey === leaverKey)).toHaveLength(1);
    expect(new Set(history.filter((w) => w.round === 1).map((w) => w.studentMatchKey)).size).toBe(4);
    expect(rounds.find((r) => r.homeroom === HOMEROOM)?.currentRound).toBe(2);
  });
});
