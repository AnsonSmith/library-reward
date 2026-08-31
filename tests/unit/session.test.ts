import { describe, it, expect } from 'vitest';
import {
  recordWin,
  rederive,
  removeWin,
  winForHomeroomThisMonth,
  winsForMonth,
} from '../../src/app/session';
import type { DrawingSession } from '../../src/app/session';
import { buildHomerooms } from '../../src/domain/eligibility';
import { currentRoundFor } from '../../src/domain/rounds';
import { defaultSettings } from '../../src/storage/historyStore';
import type { HistoryState, RosterEntry } from '../../src/domain/types';

const TODAY = '2026-09-07';
const MONTH = '2026-09';
const HOMEROOM = 'Marigold, Rita';

function students(n: number): RosterEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    displayName: `Student ${i}`,
    barcode: String(100 + i),
    matchKey: String(100 + i),
    districtId: null,
    patronType: 'Student' as const,
    status: 'Active' as const,
    homeroom: HOMEROOM,
    sourceRow: i + 2,
  }));
}

function makeSession(roster: RosterEntry[], history: HistoryState): DrawingSession {
  const base: DrawingSession = {
    roster,
    circulation: [],
    rosterFileName: 'roster.xlsx',
    circulationFileNames: ['circ.xlsx'],
    today: TODAY,
    homerooms: [],
    summary: buildHomerooms({
      roster,
      circulation: [],
      circulationFileNames: ['circ.xlsx'],
      history: history.wins,
      rounds: history.rounds,
      today: TODAY,
      rosterFileName: 'roster.xlsx',
    }).summary,
  };
  return rederive(base, history);
}

function emptyState(): HistoryState {
  return { wins: [], rounds: [], settings: defaultSettings() };
}

describe('recording a win', () => {
  it('records everything needed to audit the drawing later', () => {
    const roster = students(4);
    const session = makeSession(roster, emptyState());
    const homeroom = session.homerooms[0]!;

    const { history } = recordWin({
      history: emptyState(),
      session,
      homeroom,
      winner: roster[1]!,
    });

    const win = history.wins[0]!;
    expect(win.homeroom).toBe(HOMEROOM);
    expect(win.studentMatchKey).toBe(roster[1]!.matchKey);
    expect(win.studentName).toBe(roster[1]!.displayName);
    expect(win.round).toBe(1);
    expect(win.monthKey).toBe(MONTH);
    expect(win.drawnOn).toBe(TODAY);
    expect(win.candidatePoolSize).toBe(4);
    expect(win.id).toMatch(/^w_/);
  });

  it('takes the winner out of the pool immediately', () => {
    const roster = students(3);
    const session = makeSession(roster, emptyState());
    const result = recordWin({
      history: emptyState(),
      session,
      homeroom: session.homerooms[0]!,
      winner: roster[0]!,
    });

    const homeroom = result.session.homerooms[0]!;
    expect(homeroom.candidates.map((s) => s.matchKey)).not.toContain(roster[0]!.matchKey);
    expect(homeroom.turnsTaken).toBe(1);
    expect(homeroom.turnsRemaining).toBe(2);
  });

  it('keeps at most one winner per homeroom per month', () => {
    const roster = students(4);
    let history = emptyState();
    let session = makeSession(roster, history);

    const first = recordWin({ history, session, homeroom: session.homerooms[0]!, winner: roster[0]! });
    history = first.history;
    session = first.session;

    // A re-draw without naming what it replaces must still not leave two winners.
    const second = recordWin({ history, session, homeroom: session.homerooms[0]!, winner: roster[1]! });

    expect(winsForMonth(second.history, MONTH)).toHaveLength(1);
    expect(winForHomeroomThisMonth(second.history, HOMEROOM, MONTH)?.studentName).toBe(
      roster[1]!.displayName,
    );
  });

  it('puts a replaced winner back in the pool', () => {
    const roster = students(4);
    let history = emptyState();
    let session = makeSession(roster, history);

    const first = recordWin({ history, session, homeroom: session.homerooms[0]!, winner: roster[0]! });
    history = first.history;
    session = first.session;

    const replaced = recordWin({
      history,
      session,
      homeroom: session.homerooms[0]!,
      winner: roster[2]!,
      replacing: history.wins[0]!,
    });

    const keys = replaced.session.homerooms[0]!.candidates.map((s) => s.matchKey);
    expect(keys).toContain(roster[0]!.matchKey);
    expect(keys).not.toContain(roster[2]!.matchKey);
  });

  it('never lets a student take two turns in one round', () => {
    const roster = students(3);
    let history = emptyState();
    let session = makeSession(roster, history);

    const first = recordWin({ history, session, homeroom: session.homerooms[0]!, winner: roster[0]! });
    history = first.history;
    session = first.session;

    // Same student, a different month, same round — the invariant still holds.
    const second = recordWin({
      history,
      session: { ...session, today: '2026-10-05' },
      homeroom: session.homerooms[0]!,
      winner: roster[0]!,
    });

    const forStudent = second.history.wins.filter(
      (w) => w.studentMatchKey === roster[0]!.matchKey && w.round === 1,
    );
    expect(forStudent).toHaveLength(1);
  });

  it('starts the next round once the last child has had a turn', () => {
    const roster = students(2);
    let history = emptyState();
    let session = makeSession(roster, history);

    for (const [i, student] of roster.entries()) {
      const result = recordWin({
        history,
        session: { ...session, today: i === 0 ? TODAY : '2026-10-05' },
        homeroom: session.homerooms[0]!,
        winner: student,
      });
      history = result.history;
      session = result.session;
    }

    expect(currentRoundFor(HOMEROOM, history.rounds)).toBe(2);
    expect(session.homerooms[0]!.candidates).toHaveLength(2);
    expect(session.homerooms[0]!.turnsRemaining).toBe(2);
  });
});

describe('undoing a win', () => {
  it('returns the student to the pool with nothing else to repair', () => {
    const roster = students(3);
    const session = makeSession(roster, emptyState());
    const recorded = recordWin({
      history: emptyState(),
      session,
      homeroom: session.homerooms[0]!,
      winner: roster[0]!,
    });

    const undone = removeWin(recorded.history, recorded.session, recorded.history.wins[0]!.id);
    expect(undone.history.wins).toHaveLength(0);
    expect(undone.session!.homerooms[0]!.candidates).toHaveLength(3);
    expect(undone.session!.homerooms[0]!.turnsRemaining).toBe(3);
  });

  it('works when no files are loaded, so a mistake can be fixed any time', () => {
    const roster = students(2);
    const session = makeSession(roster, emptyState());
    const recorded = recordWin({
      history: emptyState(),
      session,
      homeroom: session.homerooms[0]!,
      winner: roster[0]!,
    });

    const undone = removeWin(recorded.history, null, recorded.history.wins[0]!.id);
    expect(undone.history.wins).toHaveLength(0);
    expect(undone.session).toBeNull();
  });
});
