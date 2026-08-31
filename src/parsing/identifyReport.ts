/**
 * Decide which selected file is which, by content rather than by file name —
 * the exports carry a job number that changes every week (FR-003, FR-004).
 *
 * A monthly drawing is fed one roster and however many weekly circulation reports
 * the month produced, chosen in any order. Sorting them out by their headers is
 * what lets the librarian select the whole folder and not think about it.
 */
import type { SheetRow } from './xlsxReader';
import { buildHeaderMap, checkRequired, hasHeaders, type HeaderMap } from './headerMap';

export const ROSTER_REQUIRED = ['Name', 'Barcode', 'Patron Type', 'Status', 'Homeroom'];
export const CIRCULATION_REQUIRED = ['Patron Barcode', 'Due'];

/** Headers that distinguish one report from the other. */
const ROSTER_SIGNATURE = ['Patron Type', 'Homeroom'];
const CIRCULATION_SIGNATURE = ['Patron Barcode', 'Due'];

export type FileRole = 'roster' | 'circulation' | 'unknown';

export interface IdentifiedFile {
  role: FileRole;
  map: HeaderMap;
  rows: SheetRow[];
  /** Required headers this file is missing for its detected role. */
  missing: string[];
}

export function identifyReport(rows: SheetRow[]): IdentifiedFile {
  const map = buildHeaderMap(rows);

  if (hasHeaders(map, ROSTER_SIGNATURE)) {
    return { role: 'roster', map, rows, missing: checkRequired(map, ROSTER_REQUIRED) };
  }
  if (hasHeaders(map, CIRCULATION_SIGNATURE)) {
    return { role: 'circulation', map, rows, missing: checkRequired(map, CIRCULATION_REQUIRED) };
  }
  return { role: 'unknown', map, rows, missing: [] };
}

export interface NamedSheet {
  rows: SheetRow[];
  fileName: string;
}

export interface ClassifiedFile extends IdentifiedFile {
  fileName: string;
}

export type ClassifyResult =
  | { ok: true; roster: ClassifiedFile; circulation: ClassifiedFile[] }
  | { ok: false; problem: string };

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * Sort any number of selected files into one roster and the month's circulation
 * reports. Selection order carries no meaning, so nothing here depends on it.
 */
export function classifyReports(sheets: NamedSheet[]): ClassifyResult {
  const classified: ClassifiedFile[] = sheets.map((s) => ({
    ...identifyReport(s.rows),
    fileName: s.fileName,
  }));

  const unknown = classified.filter((f) => f.role === 'unknown');
  if (unknown.length > 0) {
    const names = list(unknown.map((f) => f.fileName));
    return {
      ok: false,
      problem: `${names} ${unknown.length > 1 ? 'are' : 'is'} not one of the library reports. The roster needs "Patron Type" and "Homeroom" columns; a circulation report needs "Patron Barcode" and "Due" columns.`,
    };
  }

  const rosters = classified.filter((f) => f.role === 'roster');
  const circulation = classified.filter((f) => f.role === 'circulation');

  if (rosters.length === 0) {
    return {
      ok: false,
      problem:
        'None of those files is the student roster. Add the roster export — the one with "Patron Type" and "Homeroom" columns.',
    };
  }
  if (rosters.length > 1) {
    return {
      ok: false,
      problem: `${list(rosters.map((f) => f.fileName))} all look like the student roster. Choose one roster, plus this month's circulation reports.`,
    };
  }
  if (circulation.length === 0) {
    return {
      ok: false,
      problem:
        "Add at least one circulation report. Every weekly report you add to the pile keeps that week's overdue books out of the monthly drawing.",
    };
  }

  const roster = rosters[0]!;
  const missing = [
    ...roster.missing.map((h) => `"${h}" in the roster (${roster.fileName})`),
    ...circulation.flatMap((c) =>
      c.missing.map((h) => `"${h}" in the circulation report ${c.fileName}`),
    ),
  ];
  if (missing.length > 0) {
    return { ok: false, problem: `Missing required columns: ${missing.join('; ')}.` };
  }

  return { ok: true, roster, circulation };
}
