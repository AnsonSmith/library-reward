/**
 * Turn-taking across the school year.
 *
 * A round is DERIVED from the winner history rather than stored as a flag on each
 * student. That single choice makes the awkward cases fall out for free:
 *   - a student who arrives mid-year has no win in the current round, so they are
 *     immediately eligible (FR-021);
 *   - a student who leaves simply stops appearing on the roster and cannot block a
 *     reset (FR-022);
 *   - correcting a mistaken winner is a deletion, which returns that student to the
 *     pool with no other state to repair (FR-023).
 * Flags would need reconciliation every time the roster changed.
 */
import type { CalendarDate, Homeroom, RoundState, WinRecord } from './types';

export function currentRoundFor(homeroom: string, rounds: RoundState[]): number {
  return rounds.find((r) => r.homeroom === homeroom)?.currentRound ?? 1;
}

/** Students in this homeroom who have already had their turn in the current round. */
export function winnersInRound(
  homeroom: string,
  round: number,
  history: WinRecord[],
): Set<string> {
  return new Set(
    history.filter((w) => w.homeroom === homeroom && w.round === round).map((w) => w.studentMatchKey),
  );
}

export function turnsRemaining(homeroom: Homeroom, history: WinRecord[]): number {
  const won = winnersInRound(homeroom.name, homeroom.currentRound, history);
  return homeroom.students.filter((s) => !won.has(s.matchKey)).length;
}

export interface AdvanceInput {
  homerooms: Homeroom[];
  history: WinRecord[];
  rounds: RoundState[];
  today: CalendarDate;
}

/**
 * Start a new round for any homeroom where every CURRENTLY ROSTERED student has
 * had a turn. Evaluated against this week's roster, so departed students never
 * hold a class hostage. Idempotent: calling it twice advances at most once.
 */
export function advanceRoundsIfComplete(input: AdvanceInput): RoundState[] {
  const { homerooms, history, rounds, today } = input;
  const next = rounds.map((r) => ({ ...r }));

  for (const homeroom of homerooms) {
    // An empty homeroom has no turns to take; advancing it would loop forever.
    if (homeroom.students.length === 0) continue;

    const round = currentRoundFor(homeroom.name, next);
    const won = winnersInRound(homeroom.name, round, history);
    const everyoneHasWon = homeroom.students.every((s) => won.has(s.matchKey));
    if (!everyoneHasWon) continue;

    const existing = next.find((r) => r.homeroom === homeroom.name);
    if (existing) {
      existing.currentRound = round + 1;
      existing.startedOn = today;
    } else {
      next.push({ homeroom: homeroom.name, currentRound: round + 1, startedOn: today });
    }
  }

  return next;
}

/**
 * Rebuild round state from wins alone, for a backup file whose `rounds` block is
 * missing or disagrees with its `wins` (see contracts/backup-file.md).
 */
export function rebuildRoundsFromWins(history: WinRecord[], today: CalendarDate): RoundState[] {
  const highest = new Map<string, number>();
  for (const win of history) {
    const current = highest.get(win.homeroom) ?? 1;
    if (win.round > current) highest.set(win.homeroom, win.round);
    else if (!highest.has(win.homeroom)) highest.set(win.homeroom, win.round);
  }
  return [...highest.entries()].map(([homeroom, currentRound]) => ({
    homeroom,
    currentRound,
    startedOn: today,
  }));
}
