/** Roster export -> RosterEntry[]. See contracts/input-files.md. */
import type { PatronStatus, PatronType, RosterEntry } from '../domain/types';
import { normalizeBarcode } from '../domain/identifiers';
import { cell, dataRows, type HeaderMap } from './headerMap';
import type { SheetRow } from './xlsxReader';

function toPatronType(raw: string): PatronType {
  const s = raw.trim().toLowerCase();
  if (s === 'student') return 'Student';
  if (s === 'faculty') return 'Faculty';
  // An unrecognized type is never assumed eligible.
  return 'Other';
}

function toStatus(raw: string): PatronStatus {
  // Only an explicit "Active" counts; anything else is set aside rather than trusted.
  return raw.trim().toLowerCase() === 'active' ? 'Active' : 'Inactive';
}

function blankToNull(raw: string): string | null {
  const s = raw.trim();
  return s === '' ? null : s;
}

export function parseRoster(rows: SheetRow[], map: HeaderMap): RosterEntry[] {
  return dataRows(rows, map).map((row) => {
    const barcode = cell(map, row, 'Barcode').trim();
    return {
      displayName: cell(map, row, 'Name').trim(),
      barcode,
      matchKey: normalizeBarcode(barcode),
      districtId: blankToNull(cell(map, row, 'District ID')),
      patronType: toPatronType(cell(map, row, 'Patron Type')),
      status: toStatus(cell(map, row, 'Status')),
      homeroom: blankToNull(cell(map, row, 'Homeroom')),
      sourceRow: row.rowNumber,
    };
  });
}
