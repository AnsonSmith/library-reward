/**
 * One call from two chosen files to this week's homerooms.
 * Kept out of the UI so the whole ingestion path is testable without a browser.
 */
import { readFirstSheet, SpreadsheetReadError } from './xlsxReader';
import { pairReports } from './identifyReport';
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
  fileA: FileInput;
  fileB: FileInput;
  history: WinRecord[];
  rounds: RoundState[];
  today: CalendarDate;
}

export type IngestResult =
  | (BuildResult & {
      ok: true;
      swapped: boolean;
      /** Kept so homerooms can be re-derived after each draw without re-reading files. */
      roster: RosterEntry[];
      circulation: CirculationRow[];
    })
  | { ok: false; problem: string };

export function ingestWorkbooks(input: IngestInput): IngestResult {
  const sheets: { rows: ReturnType<typeof readFirstSheet>; fileName: string }[] = [];

  for (const file of [input.fileA, input.fileB]) {
    try {
      sheets.push({ rows: readFirstSheet(file.bytes), fileName: file.fileName });
    } catch (err) {
      const why = err instanceof SpreadsheetReadError ? err.message : 'It could not be read.';
      return { ok: false, problem: `${file.fileName}: ${why}` };
    }
  }

  const paired = pairReports(sheets[0]!, sheets[1]!);
  if (!paired.ok) return paired;

  const roster = parseRoster(paired.roster.rows, paired.roster.map);
  const circulation = parseCirculation(paired.circulation.rows, paired.circulation.map);

  const built = buildHomerooms({
    roster,
    circulation,
    history: input.history,
    rounds: input.rounds,
    today: input.today,
    rosterFileName: paired.roster.fileName,
    circulationFileName: paired.circulation.fileName,
  });

  return { ok: true, swapped: paired.swapped, roster, circulation, ...built };
}
