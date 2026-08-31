/**
 * Columns are located by header text, never by position: a column inserted
 * upstream must not silently change the meaning of the data (FR-003).
 */
import type { SheetRow } from './xlsxReader';

export interface HeaderMap {
  /** Header text (normalized) -> column letter. */
  columnFor: Record<string, string>;
  headerRowNumber: number;
}

export interface HeaderMatch {
  map: HeaderMap;
  missing: string[];
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Build a header map from the first non-empty row. */
export function buildHeaderMap(rows: SheetRow[]): HeaderMap {
  const headerRow = rows.find((r) => Object.keys(r.cells).length > 0);
  const columnFor: Record<string, string> = {};
  if (!headerRow) return { columnFor, headerRowNumber: 0 };

  for (const [col, text] of Object.entries(headerRow.cells)) {
    const key = normalizeHeader(text);
    if (key && !(key in columnFor)) columnFor[key] = col;
  }
  return { columnFor, headerRowNumber: headerRow.rowNumber };
}

/** Which of the required headers are absent. Reported, never thrown (FR-005). */
export function checkRequired(map: HeaderMap, required: string[]): string[] {
  return required.filter((h) => !(normalizeHeader(h) in map.columnFor));
}

export function matchHeaders(rows: SheetRow[], required: string[]): HeaderMatch {
  const map = buildHeaderMap(rows);
  return { map, missing: checkRequired(map, required) };
}

/** Read one cell by header name. Returns '' when the column or cell is absent. */
export function cell(map: HeaderMap, row: SheetRow, header: string): string {
  const col = map.columnFor[normalizeHeader(header)];
  if (!col) return '';
  return row.cells[col] ?? '';
}

export function hasHeaders(map: HeaderMap, headers: string[]): boolean {
  return headers.every((h) => normalizeHeader(h) in map.columnFor);
}

/** Data rows are everything after the header row. */
export function dataRows(rows: SheetRow[], map: HeaderMap): SheetRow[] {
  return rows.filter(
    (r) => r.rowNumber > map.headerRowNumber && Object.keys(r.cells).length > 0,
  );
}
