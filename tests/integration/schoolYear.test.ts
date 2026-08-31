/**
 * The fairness promise, end to end: buildHomerooms + rounds + drawing, run as a
 * school year of monthly drawings. This is SC-007 — every student wins exactly
 * once before any student wins twice.
 *
 * Each month's circulation is the POOL of that month's weekly reports, which is
 * what the app hands the domain: one overdue row anywhere in the pool holds a
 * student out for the month.
 */
import { describe, it, expect } from 'vitest';
import { buildHomerooms } from '../../src/domain/eligibility';
import { advanceRoundsIfComplete } from '../../src/domain/rounds';
import { drawWinner, seededRng } from '../../src/domain/drawing';
import { monthKeyFor } from '../../src/domain/monthKey';
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

/** Drawing day of each successive month, starting September 2026. */
function drawingDay(index: number): string {
  const d = new Date(Date.UTC(2026, 8 + index, 7));
  return d.toISOString().slice(0, 10);
}

interface SimOptions {
  months: number;
  students: RosterEntry[];
  /** Every row from every weekly report gathered that month, already pooled. */
  circulationFor?: (month: number) => CirculationRow[];
  rosterFor?: (month: number, base: RosterEntry[], history: WinRecord[]) => RosterEntry[];
}

function simulate(opts: SimOptions) {
  const rng = seededRng(20260907);
  let history: WinRecord[] = [];
  let rounds: RoundState[] = [];
  const log: { month: number; winner: string | null; round: number }[] = [];

  for (let month = 0; month < opts.months; month++) {
    const today = drawingDay(month);
    const currentRoster = opts.rosterFor
      ? opts.rosterFor(month, opts.students, history)
      : opts.students;
    const circulation = opts.circulationFor ? opts.circulationFor(month) : [];
    const circulationFileNames = [...new Set(circulation.map((row) => row.sourceFile))];

    const { homerooms } = buildHomerooms({
      roster: currentRoster,
      circulation,
      circulationFileNames,
      history,
      rounds,
      today,
      rosterFileName: 'r.xlsx',
    });

    const hr = homerooms.find((h) => h.name === HOMEROOM);
    if (!hr) continue;

    const winner = drawWinner(hr.candidates, rng);
    if (winner) {
      history = [
        ...history,
        {
          id: `w${month}`,
          homeroom: hr.name,
          round: hr.currentRound,
          studentMatchKey: winner.matchKey,
          studentName: winner.displayName,
          drawnOn: today,
          monthKey: monthKeyFor(today),
          candidatePoolSize: hr.candidates.length,
        },
      ];
    }
    log.push({ month, winner: winner?.matchKey ?? null, round: hr.currentRound });

    // Recompute after the draw, exactly as the app does.
    const after = buildHomerooms({
      roster: currentRoster,
      circulation,
      circulationFileNames,
      history,
      rounds,
      today,
      rosterFileName: 'r.xlsx',
    });
    rounds = advanceRoundsIfComplete({ homerooms: after.homerooms, history, rounds, today });
  }

  return { history, rounds, log };
}

describe('a school year of drawings', () => {
  it('gives every student a turn before anyone repeats', () => {
    const students = roster(12);
    const { history, log } = simulate({ months: 12, students });

    expect(history).toHaveLength(12);
    const winners = history.map((w) => w.studentMatchKey);
    expect(new Set(winners).size).toBe(12);
    expect(log.every((entry) => entry.round === 1)).toBe(true);
  });

  it('resets the round and lets everyone win again in the next pass', () => {
    const students = roster(8);
    const { history, rounds } = simulate({ months: 16, students });

    expect(history).toHaveLength(16);
    const firstRound = history.filter((w) => w.round === 1).map((w) => w.studentMatchKey);
    const secondRound = history.filter((w) => w.round === 2).map((w) => w.studentMatchKey);

    expect(new Set(firstRound).size).toBe(8);
    expect(new Set(secondRound).size).toBe(8);
    expect(rounds.find((r) => r.homeroom === HOMEROOM)?.currentRound).toBe(3);
  });

  it('never lets a student win twice in one round even across many rounds', () => {
    const students = roster(6);
    const { history } = simulate({ months: 30, students });
    expect(history.length).toBeGreaterThan(0);

    const seen = new Set<string>();
    for (const w of history) {
      const key = `${w.round}:${w.studentMatchKey}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(students).toBeDefined();
  });

  it('skips a month when everyone still waiting has an overdue book', () => {
    const students = roster(3);
    // From month 2 on, every remaining student holds an overdue item.
    const circulationFor = (month: number): CirculationRow[] =>
      month < 2
        ? []
        : students.map((s, i) => ({
            sourceFile: `month${month}-week1.xlsx`,
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

    const { history, log } = simulate({ months: 5, students, circulationFor });
    expect(history).toHaveLength(2);
    expect(log.slice(2).every((entry) => entry.winner === null)).toBe(true);
  });

  it('lets a student who joins mid-year win in the round already under way', () => {
    const base = roster(4);
    const newcomer = roster(5)[4]!;
    const rosterFor = (month: number) => (month < 2 ? base : [...base, newcomer]);

    const { history } = simulate({ months: 5, students: base, rosterFor });
    const wonKeys = history.filter((w) => w.round === 1).map((w) => w.studentMatchKey);
    expect(wonKeys).toContain(newcomer.matchKey);
  });

  it('resets a round even though a past winner has left the school', () => {
    // FR-022: whoever wins in month 0 then leaves. The remaining three must still
    // be able to finish the round, and the round must still reset.
    const full = roster(4);
    const rosterFor = (month: number, base: RosterEntry[], history: WinRecord[]) => {
      if (month === 0 || history.length === 0) return base;
      const leaverKey = history[0]!.studentMatchKey;
      return base.filter((s) => s.matchKey !== leaverKey);
    };

    const { history, rounds } = simulate({ months: 4, students: full, rosterFor });
    const leaverKey = history[0]!.studentMatchKey;

    // The leaver never wins again, and the other three each take a turn.
    expect(history.filter((w) => w.studentMatchKey === leaverKey)).toHaveLength(1);
    expect(new Set(history.filter((w) => w.round === 1).map((w) => w.studentMatchKey)).size).toBe(4);
    expect(rounds.find((r) => r.homeroom === HOMEROOM)?.currentRound).toBe(2);
  });

  it('holds a student out for the month on one report, then frees them the next', () => {
    const students = roster(4);
    const blocked = students[0]!;
    // Month 0: overdue in week 2's report only, and clear in weeks 1, 3 and 4.
    const circulationFor = (month: number): CirculationRow[] =>
      month !== 0
        ? []
        : [
            {
              sourceFile: 'month0-week2.xlsx',
              displayName: blocked.displayName,
              barcode: blocked.barcode,
              matchKey: blocked.matchKey,
              transactionType: 'Overdue',
              dueDate: '2026-09-01',
              dueDateRaw: '46266',
              itemTitle: 'Dog Man',
              fineReason: null,
              sourceRow: 2,
            },
          ];

    const { history } = simulate({ months: 4, students, circulationFor });

    // One overdue row in one weekly report cost them the whole month...
    expect(history[0]!.studentMatchKey).not.toBe(blocked.matchKey);
    expect(history[0]!.candidatePoolSize).toBe(3);
    // ...but nothing beyond it: they are back in the pool the following month,
    // and still take their turn in the same round.
    expect(history.map((w) => w.studentMatchKey)).toContain(blocked.matchKey);
    expect(history.filter((w) => w.round === 1)).toHaveLength(4);
  });
});
