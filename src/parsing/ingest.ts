/**
 * One call from the month's chosen files to its homerooms.
 * Kept out of the UI so the whole ingestion path is testable without a browser.
 */
import { readFirstSheet, SpreadsheetReadError } from './xlsxReader';
import { classifyReports } from './identifyReport';
import { parseRoster } from './rosterReport';
import { parseCirculation } from './circulationReport';
import { buildHomerooms, type BuildResult } from '../domain/eligibility';
import type {
  CalendarDate,
  CirculationRow,
  RosterEntry,
  RoundState,
  WinRecord,
} from '../domain/types';

export interface FileInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface IngestInput {
  /** One roster plus one or more circulation reports, in any order. */
  files: FileInput[];
  history: WinRecord[];
  rounds: RoundState[];
  today: CalendarDate;
}

/** What each chosen file turned out to be, so nothing is sorted invisibly. */
export interface RecognizedFile {
  fileName: string;
  role: 'roster' | 'circulation';
}

export type IngestResult =
  | (BuildResult & {
      ok: true;
      recognized: RecognizedFile[];
      /** Kept so homerooms can be re-derived after each draw without re-reading files. */
      roster: RosterEntry[];
      circulation: CirculationRow[];
      circulationFileNames: string[];
    })
  | { ok: false; problem: string };

export function ingestWorkbooks(input: IngestInput): IngestResult {
  if (input.files.length < 2) {
    return {
      ok: false,
      problem:
        'Choose the student roster and at least one circulation report before reading the files.',
    };
  }

  const sheets: { rows: ReturnType<typeof readFirstSheet>; fileName: string }[] = [];

  for (const file of input.files) {
    try {
      sheets.push({ rows: readFirstSheet(file.bytes), fileName: file.fileName });
    } catch (err) {
      const why = err instanceof SpreadsheetReadError ? err.message : 'It could not be read.';
      return { ok: false, problem: `${file.fileName}: ${why}` };
    }
  }

  const sorted = classifyReports(sheets);
  if (!sorted.ok) return sorted;

  const roster = parseRoster(sorted.roster.rows, sorted.roster.map);
  // Every report's rows go into one pool; buildHomerooms takes the union of the
  // students they disqualify, and keeps the per-report counts for display.
  const circulation = sorted.circulation.flatMap((c) =>
    parseCirculation(c.rows, c.map, c.fileName),
  );
  const circulationFileNames = sorted.circulation.map((c) => c.fileName);

  const built = buildHomerooms({
    roster,
    circulation,
    circulationFileNames,
    history: input.history,
    rounds: input.rounds,
    today: input.today,
    rosterFileName: sorted.roster.fileName,
  });

  const recognized: RecognizedFile[] = [
    { fileName: sorted.roster.fileName, role: 'roster' },
    ...circulationFileNames.map((fileName) => ({ fileName, role: 'circulation' as const })),
  ];

  return { ok: true, recognized, roster, circulation, circulationFileNames, ...built };
}
