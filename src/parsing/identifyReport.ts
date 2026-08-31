/**
 * Decide which selected file is which, by content rather than by file name —
 * the exports carry a job number that changes every week (FR-003, FR-004).
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

export interface PairedFile extends IdentifiedFile {
  fileName: string;
}

export type PairResult =
  | { ok: true; roster: PairedFile; circulation: PairedFile; swapped: boolean }
  | { ok: false; problem: string };

/**
 * Pair two selected files into roles. A swapped selection is corrected rather
 * than rejected — but the caller is told, so nothing happens invisibly.
 */
export function pairReports(a: NamedSheet, b: NamedSheet): PairResult {
  const ia: PairedFile = { ...identifyReport(a.rows), fileName: a.fileName };
  const ib: PairedFile = { ...identifyReport(b.rows), fileName: b.fileName };

  const unknown = [ia, ib].filter((f) => f.role === 'unknown');
  if (unknown.length > 0) {
    const names = unknown.map((f) => f.fileName).join(' and ');
    return {
      ok: false,
      problem: `${names} ${unknown.length > 1 ? 'are' : 'is'} not one of the two library reports. The roster needs "Patron Type" and "Homeroom" columns; the circulation report needs "Patron Barcode" and "Due" columns.`,
    };
  }

  if (ia.role === ib.role) {
    const wanted = ia.role === 'roster' ? 'circulation report' : 'student roster';
    return {
      ok: false,
      problem: `Both files look like the ${ia.role === 'roster' ? 'student roster' : 'circulation report'}. Please choose the ${wanted} as well.`,
    };
  }

  const roster = ia.role === 'roster' ? ia : ib;
  const circulation = ia.role === 'circulation' ? ia : ib;

  const missing = [
    ...roster.missing.map((h) => `"${h}" in the roster (${roster.fileName})`),
    ...circulation.missing.map((h) => `"${h}" in the circulation report (${circulation.fileName})`),
  ];
  if (missing.length > 0) {
    return { ok: false, problem: `Missing required columns: ${missing.join('; ')}.` };
  }

  return { ok: true, roster, circulation, swapped: ia.role === 'circulation' };
}
