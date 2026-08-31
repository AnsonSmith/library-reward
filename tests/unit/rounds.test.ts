import { describe, it, expect } from 'vitest';
import {
  advanceRoundsIfComplete,
  currentRoundFor,
  rebuildRoundsFromWins,
  turnsRemaining,
  winnersInRound,
} from '../../src/domain/rounds';
import type { Homeroom, RosterEntry, RoundState, WinRecord } from '../../src/domain/types';

const TODAY = '2026-03-05';

function student(key: string): RosterEntry {
  return {
    displayName: `Student ${key}`,
    barcode: key,
    matchKey: key,
    districtId: null,
    patronType: 'Student',
    status: 'Active',
    homeroom: 'Marigold, Rita',
    sourceRow: Number(key) + 1,
  };
}

function homeroom(name: string, keys: string[], currentRound = 1): Homeroom {
  const students = keys.map(student);
  return {
    name,
    students,
    candidates: students,
    blockedByOverdue: [],
    alreadyWonThisRound: [],
    currentRound,
    turnsTaken: 0,
    turnsRemaining: students.length,
  };
}

function win(homeroomName: string, key: string, round = 1): WinRecord {
  return {
    id: `w-${homeroomName}-${key}-${round}`,
    homeroom: homeroomName,
    round,
    studentMatchKey: key,
    studentName: `Student ${key}`,
    drawnOn: '2026-02-01',
    monthKey: '2026-02',
    candidatePoolSize: 3,
  };
}

describe('round advancement', () => {
  it('does not advance while anyone is still waiting for a turn', () => {
    const hr = homeroom('Marigold, Rita', ['1', '2', '3']);
    const rounds = advanceRoundsIfComplete({
      homerooms: [hr],
      history: [win('Marigold, Rita', '1'), win('Marigold, Rita', '2')],
      rounds: [],
      today: TODAY,
    });
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(1);
  });

  it('advances once every currently rostered student has won', () => {
    const hr = homeroom('Marigold, Rita', ['1', '2', '3']);
    const history = ['1', '2', '3'].map((k) => win('Marigold, Rita', k));
    const rounds = advanceRoundsIfComplete({ homerooms: [hr], history, rounds: [], today: TODAY });
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(2);
    expect(rounds[0]!.startedOn).toBe(TODAY);
  });

  it('is idempotent — calling it twice advances at most once', () => {
    const hr = homeroom('Marigold, Rita', ['1', '2']);
    const history = ['1', '2'].map((k) => win('Marigold, Rita', k));
    const once = advanceRoundsIfComplete({ homerooms: [hr], history, rounds: [], today: TODAY });
    const twice = advanceRoundsIfComplete({
      homerooms: [{ ...hr, currentRound: currentRoundFor('Marigold, Rita', once) }],
      history,
      rounds: once,
      today: TODAY,
    });
    expect(currentRoundFor('Marigold, Rita', twice)).toBe(2);
  });

  it('advances homerooms independently of one another', () => {
    const a = homeroom('Marigold, Rita', ['1', '2']);
    const b = homeroom('Pennyworth, Alex', ['3', '4']);
    const history = [win('Marigold, Rita', '1'), win('Marigold, Rita', '2'), win('Pennyworth, Alex', '3')];
    const rounds = advanceRoundsIfComplete({ homerooms: [a, b], history, rounds: [], today: TODAY });
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(2);
    expect(currentRoundFor('Pennyworth, Alex', rounds)).toBe(1);
  });

  it('never advances an empty homeroom', () => {
    const rounds = advanceRoundsIfComplete({
      homerooms: [homeroom('Empty, One', [])],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(currentRoundFor('Empty, One', rounds)).toBe(1);
  });

  it('starts everyone fresh in the new round', () => {
    const hr = homeroom('Marigold, Rita', ['1', '2'], 2);
    const history = ['1', '2'].map((k) => win('Marigold, Rita', k, 1));
    expect(winnersInRound('Marigold, Rita', 2, history).size).toBe(0);
    expect(turnsRemaining(hr, history)).toBe(2);
  });
});

describe('roster churn', () => {
  it('lets a student who joins mid-year be drawn immediately', () => {
    // FR-021: no win at the current round means eligible, with no special case.
    const hr = homeroom('Marigold, Rita', ['1', '2', '3']); // '3' is new this month
    const history = ['1', '2'].map((k) => win('Marigold, Rita', k));
    expect(winnersInRound('Marigold, Rita', 1, history).has('3')).toBe(false);
    expect(turnsRemaining(hr, history)).toBe(1);
  });

  it('does not let a departed student block the round from resetting', () => {
    // FR-022: '9' won earlier and has since left; the roster no longer lists them.
    const hr = homeroom('Marigold, Rita', ['1', '2']);
    const history = [win('Marigold, Rita', '9'), win('Marigold, Rita', '1'), win('Marigold, Rita', '2')];
    const rounds = advanceRoundsIfComplete({ homerooms: [hr], history, rounds: [], today: TODAY });
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(2);
  });

  it('keeps the departed student’s historical win on the record', () => {
    const history = [win('Marigold, Rita', '9')];
    expect(history.find((w) => w.studentMatchKey === '9')).toBeDefined();
  });

  it('treats a student who changes homerooms as a member of the new one', () => {
    const history = [win('Marigold, Rita', '1')];
    expect(winnersInRound('Pennyworth, Alex', 1, history).has('1')).toBe(false);
  });
});

describe('correcting a winner', () => {
  it('returns a student to the pool when their win record is removed', () => {
    // FR-023: a deletion is the whole repair; no other state to fix up.
    const hr = homeroom('Marigold, Rita', ['1', '2', '3']);
    const history = ['1', '2'].map((k) => win('Marigold, Rita', k));
    expect(turnsRemaining(hr, history)).toBe(1);

    const corrected = history.filter((w) => w.studentMatchKey !== '2');
    expect(turnsRemaining(hr, corrected)).toBe(2);
    expect(winnersInRound('Marigold, Rita', 1, corrected).has('2')).toBe(false);
  });

  it('un-advances nothing — a removed win means the round is no longer complete', () => {
    const hr = homeroom('Marigold, Rita', ['1', '2']);
    const history = [win('Marigold, Rita', '1')];
    const rounds = advanceRoundsIfComplete({ homerooms: [hr], history, rounds: [], today: TODAY });
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(1);
  });
});

describe('rebuildRoundsFromWins', () => {
  it('derives the current round from wins when round state is missing', () => {
    const history = [
      win('Marigold, Rita', '1', 1),
      win('Marigold, Rita', '2', 2),
      win('Pennyworth, Alex', '3', 1),
    ];
    const rounds: RoundState[] = rebuildRoundsFromWins(history, TODAY);
    expect(currentRoundFor('Marigold, Rita', rounds)).toBe(2);
    expect(currentRoundFor('Pennyworth, Alex', rounds)).toBe(1);
  });

  it('returns nothing for an empty history', () => {
    expect(rebuildRoundsFromWins([], TODAY)).toEqual([]);
  });
});
