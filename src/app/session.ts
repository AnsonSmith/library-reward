/**
 * The month in memory.
 *
 * Roster and circulation rows live here and ONLY here — they are never written to
 * storage (FR-040, research R10). Only winner history persists. Homerooms are
 * re-derived from these rows after every draw so candidate lists, turn counts, and
 * round state stay in step without re-reading the files.
 */
import { buildHomerooms } from '../domain/eligibility';
import { advanceRoundsIfComplete } from '../domain/rounds';
import { monthKeyFor } from '../domain/monthKey';
import type {
  CalendarDate,
  CirculationRow,
  Homeroom,
  HistoryState,
  ImportSummary,
  RosterEntry,
  WinRecord,
} from '../domain/types';

export interface DrawingSession {
  roster: RosterEntry[];
  /** Every row from every circulation report chosen for this month, pooled. */
  circulation: CirculationRow[];
  rosterFileName: string;
  circulationFileNames: string[];
  today: CalendarDate;
  homerooms: Homeroom[];
  summary: ImportSummary;
}

/** Recompute homerooms against the current history. Cheap enough to run after every draw. */
export function rederive(session: DrawingSession, history: HistoryState): DrawingSession {
  const { homerooms, summary } = buildHomerooms({
    roster: session.roster,
    circulation: session.circulation,
    circulationFileNames: session.circulationFileNames,
    history: history.wins,
    rounds: history.rounds,
    today: session.today,
    rosterFileName: session.rosterFileName,
  });
  return { ...session, homerooms, summary };
}

export function makeWinId(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `w_${bytes[0]!.toString(36)}${bytes[1]!.toString(36)}`;
}

export interface RecordWinInput {
  history: HistoryState;
  session: DrawingSession;
  homeroom: Homeroom;
  winner: RosterEntry;
  /** When re-drawing, the record being replaced is removed first (FR-034). */
  replacing?: WinRecord | null;
}

/**
 * Append a win, then advance any homeroom that has just completed its round.
 * Returns fresh history plus a re-derived session.
 */
export function recordWin(input: RecordWinInput): { history: HistoryState; session: DrawingSession } {
  const { session, homeroom, winner, replacing } = input;

  const monthKey = monthKeyFor(session.today);

  // Two invariants, enforced here rather than trusted to the caller:
  //   - one winner per homeroom per month (a replacement is explicit, FR-034)
  //   - one turn per student per homeroom per round (FR-016)
  // Dropping a stale record silently would be wrong, so the UI confirms first;
  // this filter is what makes the confirmation actually take effect.
  const keptWins = input.history.wins.filter((w) => {
    if (replacing && w.id === replacing.id) return false;
    if (w.homeroom === homeroom.name && w.monthKey === monthKey) return false;
    if (
      w.homeroom === homeroom.name &&
      w.round === homeroom.currentRound &&
      w.studentMatchKey === winner.matchKey
    ) {
      return false;
    }
    return true;
  });

  const record: WinRecord = {
    id: makeWinId(),
    homeroom: homeroom.name,
    round: homeroom.currentRound,
    studentMatchKey: winner.matchKey,
    studentName: winner.displayName,
    drawnOn: session.today,
    monthKey,
    candidatePoolSize: homeroom.candidates.length,
  };

  const withWin: HistoryState = { ...input.history, wins: [...keptWins, record] };
  const rederived = rederive(session, withWin);
  const rounds = advanceRoundsIfComplete({
    homerooms: rederived.homerooms,
    history: withWin.wins,
    rounds: withWin.rounds,
    today: session.today,
  });

  const history: HistoryState = { ...withWin, rounds };
  return { history, session: rederive(session, history) };
}

/** Remove a recorded win, returning that student to the pool (FR-023). */
export function removeWin(
  history: HistoryState,
  session: DrawingSession | null,
  winId: string,
): { history: HistoryState; session: DrawingSession | null } {
  const next: HistoryState = { ...history, wins: history.wins.filter((w) => w.id !== winId) };
  return { history: next, session: session ? rederive(session, next) : null };
}

export function winsForMonth(history: HistoryState, monthKey: string): WinRecord[] {
  return history.wins.filter((w) => w.monthKey === monthKey);
}

export function winForHomeroomThisMonth(
  history: HistoryState,
  homeroomName: string,
  monthKey: string,
): WinRecord | null {
  return history.wins.find((w) => w.homeroom === homeroomName && w.monthKey === monthKey) ?? null;
}
