/**
 * Shared domain types. See specs/001-weekly-prize-drawing/data-model.md.
 *
 * Two lifetimes exist and must not be confused:
 *  - Session data (roster, circulation, homerooms) lives in memory only.
 *  - Persistent data (WinRecord, RoundState, Settings) survives across months.
 */

/** A calendar day with no time component, so a book due at 3pm is not "overdue" at 9am. */
export type CalendarDate = string; // ISO 'YYYY-MM-DD'

export type PatronType = 'Student' | 'Faculty' | 'Other';
export type PatronStatus = 'Active' | 'Inactive';

/** The label used for students whose roster row has no homeroom value. */
export const NO_HOMEROOM = '(No homeroom listed)';

export interface RosterEntry {
  /** As printed, "Last, First Middle". This is what a class sees. */
  displayName: string;
  /** Original barcode text, e.g. '000100001' or 'P 4242'. */
  barcode: string;
  /** Normalized barcode — the join key and the identity used in history. */
  matchKey: string;
  /** Present for most students, blank for some, duplicated for others. Never used to match. */
  districtId: string | null;
  patronType: PatronType;
  status: PatronStatus;
  /** Teacher name; null when the roster cell is blank. */
  homeroom: string | null;
  /** 1-based row number in the source sheet, for data-quality display. */
  sourceRow: number;
}

export interface CirculationRow {
  /** Which uploaded report this row came from. A month's rows are pooled, so a
   *  row with no file name behind it could not be traced back for the librarian. */
  sourceFile: string;
  displayName: string;
  barcode: string;
  matchKey: string;
  transactionType: string | null;
  /** Parsed due date, or null when blank/unreadable. */
  dueDate: CalendarDate | null;
  /** The cell verbatim, so an unparseable value can be shown to the librarian. */
  dueDateRaw: string;
  itemTitle: string | null;
  fineReason: string | null;
  sourceRow: number;
}

export type OverdueVerdict = 'overdue' | 'notOverdue' | 'undeterminable';

export type HomeroomState = 'drawable' | 'noCandidates' | 'drawnThisMonth';

export interface Homeroom {
  name: string;
  /** Active students in this homeroom, deduped. */
  students: RosterEntry[];
  /** Students minus overdue holders minus current-round winners. */
  candidates: RosterEntry[];
  /** Blocked by an overdue item in ANY of the month's reports. Never rendered on
   *  a class-facing screen. */
  blockedByOverdue: RosterEntry[];
  /** Never rendered on a class-facing screen. */
  alreadyWonThisRound: RosterEntry[];
  currentRound: number;
  turnsTaken: number;
  turnsRemaining: number;
}

/** One roster or circulation row that did not become a candidate, and why. */
export interface SetAsideRow {
  reason: SetAsideReason;
  displayName: string;
  barcode: string;
  detail: string | null;
  sourceRow: number;
  /** The report this row came from; null for roster rows, which have only one source. */
  sourceFile: string | null;
}

export type SetAsideReason =
  | 'faculty'
  | 'inactive'
  | 'noHomeroom'
  | 'duplicateRoster'
  | 'missingBarcode'
  | 'unmatchedCirculation'
  | 'nonOverdue'
  | 'undeterminableDueDate';

/** Per-report totals, so a report exported without due dates stands out from the rest. */
export interface CirculationFileSummary {
  fileName: string;
  rowsRead: number;
  overdueRowsFound: number;
  /** Students newly disqualified by this report and no earlier one. */
  studentsFirstBlockedHere: number;
}

export interface ImportSummary {
  rosterFileName: string;
  /** Every circulation report in this month's pool, in the order they were read. */
  circulationFiles: CirculationFileSummary[];
  importedAt: string;
  rosterRowsRead: number;
  circulationRowsRead: number;
  /** The number that tells the librarian whether the right reports were exported. */
  overdueRowsFound: number;
  /** Distinct students held out of the drawing by an overdue item in any report. */
  studentsBlockedByOverdue: number;
  activeStudents: number;
  homeroomCount: number;
  setAside: SetAsideRow[];
  countsByReason: Record<SetAsideReason, number>;
}

export interface WinRecord {
  id: string;
  /** The homeroom at the time of the win. */
  homeroom: string;
  round: number;
  studentMatchKey: string;
  /** Snapshot for display; the roster may later change. */
  studentName: string;
  drawnOn: CalendarDate;
  /** Calendar month, e.g. '2026-09'. One win per homeroom per month. */
  monthKey: string;
  candidatePoolSize: number;
}

export interface RoundState {
  homeroom: string;
  currentRound: number;
  startedOn: CalendarDate;
}

export interface Settings {
  schoolYearLabel: string;
  lastBackupExportedOn: CalendarDate | null;
  reduceMotion: boolean;
}

export interface HistoryState {
  wins: WinRecord[];
  rounds: RoundState[];
  settings: Settings;
}
