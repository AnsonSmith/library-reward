/**
 * Who can win this month.
 *
 * This module is the reason the app exists, and the one place where being wrong
 * is invisible until a child is embarrassed in front of a class. Three rules
 * matter most, all clarified with the librarian:
 *
 *  1. Only a genuinely OVERDUE item disqualifies. Fines, lost-book charges, and
 *     refunds do not (FR-009).
 *  2. A drawing covers a MONTH, and the month's weekly circulation reports are
 *     pooled: an overdue item in ANY of them holds a student out of that month's
 *     drawing, even if a later report shows the book returned. Returning it late
 *     does not un-ring the bell for the month it was late in.
 *  3. A student who already won in their homeroom's current round sits out until
 *     every classmate has had a turn (FR-016).
 *
 * Nothing is ever dropped silently: every roster row and every circulation row
 * ends up either in a homeroom or in a counted, displayable set-aside bucket, and
 * every set-aside circulation row names the report it came from.
 */
import { isBefore } from '../parsing/excelDate';
import { currentRoundFor, winnersInRound } from './rounds';
import {
  NO_HOMEROOM,
  type CalendarDate,
  type CirculationFileSummary,
  type CirculationRow,
  type Homeroom,
  type ImportSummary,
  type OverdueVerdict,
  type RosterEntry,
  type RoundState,
  type SetAsideReason,
  type SetAsideRow,
  type WinRecord,
} from './types';

/** Transaction wording that claims to be a loan rather than a charge. */
const CHECKOUT_LIKE = /overdue|checked\s*out|checkout|loan|on\s*loan/i;

/**
 * A row disqualifies only when it carries a due date that has already passed.
 * A row that looks like a checkout but has no readable due date is reported as
 * undeterminable — never quietly treated as fine (FR-011).
 *
 * `today` is the drawing date, not each report's export date, which we are never
 * told. That only ever widens the set of overdue rows, which is the safe
 * direction: the failure that embarrasses the librarian is a student holding an
 * overdue book winning a prize, not a student sitting one month out.
 */
export function determineOverdue(row: CirculationRow, today: CalendarDate): OverdueVerdict {
  if (row.dueDate !== null) {
    return isBefore(row.dueDate, today) ? 'overdue' : 'notOverdue';
  }
  // A due-date cell with content we could not read is a question, not an answer.
  if (row.dueDateRaw.trim() !== '') return 'undeterminable';
  if (row.transactionType && CHECKOUT_LIKE.test(row.transactionType)) return 'undeterminable';
  return 'notOverdue';
}

export interface BuildInput {
  roster: RosterEntry[];
  /** Every row from every circulation report in the month, each naming its file. */
  circulation: CirculationRow[];
  /** The reports that were read, in order — including any that contributed no rows. */
  circulationFileNames: string[];
  history: WinRecord[];
  rounds: RoundState[];
  today: CalendarDate;
  rosterFileName: string;
}

export interface BuildResult {
  homerooms: Homeroom[];
  summary: ImportSummary;
}

const EMPTY_COUNTS = (): Record<SetAsideReason, number> => ({
  faculty: 0,
  inactive: 0,
  noHomeroom: 0,
  duplicateRoster: 0,
  missingBarcode: 0,
  unmatchedCirculation: 0,
  nonOverdue: 0,
  undeterminableDueDate: 0,
});

function homeroomNameOf(entry: RosterEntry): string {
  const raw = entry.homeroom?.trim() ?? '';
  return raw === '' ? NO_HOMEROOM : raw;
}

export function buildHomerooms(input: BuildInput): BuildResult {
  const { roster, circulation, circulationFileNames, history, rounds, today } = input;

  const setAside: SetAsideRow[] = [];
  const counts = EMPTY_COUNTS();
  const note = (
    reason: SetAsideReason,
    displayName: string,
    barcode: string,
    detail: string | null,
    sourceRow: number,
    sourceFile: string | null,
  ): void => {
    counts[reason] += 1;
    setAside.push({ reason, displayName, barcode, detail, sourceRow, sourceFile });
  };

  // --- Circulation: classify every row of every report, then take the UNION of
  //     the students each one disqualifies.
  const overdueKeys = new Set<string>();
  const rosterKeys = new Set(roster.map((r) => r.matchKey).filter((k) => k !== ''));
  const perFile = new Map<string, CirculationFileSummary>();
  const fileOf = (fileName: string): CirculationFileSummary => {
    let entry = perFile.get(fileName);
    if (!entry) {
      entry = { fileName, rowsRead: 0, overdueRowsFound: 0, studentsFirstBlockedHere: 0 };
      perFile.set(fileName, entry);
    }
    return entry;
  };
  // Reports appear in the order they were read even when one contributed no rows,
  // so a report exported empty by mistake is visible rather than absent.
  for (const fileName of circulationFileNames) fileOf(fileName);

  let overdueRowsFound = 0;

  for (const row of circulation) {
    const file = fileOf(row.sourceFile);
    file.rowsRead += 1;

    if (row.matchKey === '' || !rosterKeys.has(row.matchKey)) {
      note(
        'unmatchedCirculation',
        row.displayName,
        row.barcode,
        row.itemTitle ?? row.transactionType,
        row.sourceRow,
        row.sourceFile,
      );
      continue;
    }
    const verdict = determineOverdue(row, today);
    if (verdict === 'overdue') {
      overdueRowsFound += 1;
      file.overdueRowsFound += 1;
      // Only the first report to catch a student is credited, so the per-report
      // numbers add up to the total rather than double-counting a repeat offender.
      if (!overdueKeys.has(row.matchKey)) file.studentsFirstBlockedHere += 1;
      overdueKeys.add(row.matchKey);
    } else if (verdict === 'undeterminable') {
      note(
        'undeterminableDueDate',
        row.displayName,
        row.barcode,
        `Due date reads "${row.dueDateRaw.trim() || '(blank)'}"${row.itemTitle ? ` — ${row.itemTitle}` : ''}`,
        row.sourceRow,
        row.sourceFile,
      );
    } else {
      note(
        'nonOverdue',
        row.displayName,
        row.barcode,
        row.fineReason ?? row.transactionType,
        row.sourceRow,
        row.sourceFile,
      );
    }
  }

  // --- Roster: filter to active students, deduped, grouped by homeroom.
  const byKey = new Map<string, RosterEntry>();
  const grouped = new Map<string, RosterEntry[]>();

  for (const entry of roster) {
    if (entry.matchKey === '') {
      note('missingBarcode', entry.displayName, entry.barcode, null, entry.sourceRow, null);
      continue;
    }
    if (entry.patronType !== 'Student') {
      note('faculty', entry.displayName, entry.barcode, entry.patronType, entry.sourceRow, null);
      continue;
    }
    if (entry.status !== 'Active') {
      note('inactive', entry.displayName, entry.barcode, entry.status, entry.sourceRow, null);
      continue;
    }

    const existing = byKey.get(entry.matchKey);
    if (existing) {
      // Keep the first active record; a second one is a duplicate either way.
      note(
        'duplicateRoster',
        entry.displayName,
        entry.barcode,
        'Same barcode as an earlier row',
        entry.sourceRow,
        null,
      );
      continue;
    }
    byKey.set(entry.matchKey, entry);

    const name = homeroomNameOf(entry);
    if (name === NO_HOMEROOM) {
      counts.noHomeroom += 1;
      setAside.push({
        reason: 'noHomeroom',
        displayName: entry.displayName,
        barcode: entry.barcode,
        detail: null,
        sourceRow: entry.sourceRow,
        sourceFile: null,
      });
    }
    const bucket = grouped.get(name);
    if (bucket) bucket.push(entry);
    else grouped.set(name, [entry]);
  }

  // --- Assemble homerooms, applying the overdue and turn-taking filters.
  const homerooms: Homeroom[] = [];
  let studentsBlockedByOverdue = 0;
  for (const [name, students] of grouped) {
    const currentRound = currentRoundFor(name, rounds);
    const wonKeys = winnersInRound(name, currentRound, history);

    const blockedByOverdue: RosterEntry[] = [];
    const alreadyWonThisRound: RosterEntry[] = [];
    const candidates: RosterEntry[] = [];

    for (const s of students) {
      if (wonKeys.has(s.matchKey)) alreadyWonThisRound.push(s);
      else if (overdueKeys.has(s.matchKey)) blockedByOverdue.push(s);
      else candidates.push(s);
    }
    studentsBlockedByOverdue += blockedByOverdue.length;

    homerooms.push({
      name,
      students,
      candidates,
      blockedByOverdue,
      alreadyWonThisRound,
      currentRound,
      turnsTaken: alreadyWonThisRound.length,
      turnsRemaining: students.length - alreadyWonThisRound.length,
    });
  }

  // Alphabetical, with the unassigned group last so it never looks like a class.
  homerooms.sort((a, b) => {
    if (a.name === NO_HOMEROOM) return 1;
    if (b.name === NO_HOMEROOM) return -1;
    return a.name.localeCompare(b.name);
  });

  const summary: ImportSummary = {
    rosterFileName: input.rosterFileName,
    circulationFiles: [...perFile.values()],
    importedAt: new Date().toISOString(),
    rosterRowsRead: roster.length,
    circulationRowsRead: circulation.length,
    overdueRowsFound,
    studentsBlockedByOverdue,
    activeStudents: byKey.size,
    homeroomCount: homerooms.filter((h) => h.name !== NO_HOMEROOM).length,
    setAside,
    countsByReason: counts,
  };

  return { homerooms, summary };
}
