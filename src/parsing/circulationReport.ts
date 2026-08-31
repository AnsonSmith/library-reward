/**
 * Circulation export -> CirculationRow[]. See contracts/input-files.md.
 *
 * A month's drawing pools several of these, so every row is stamped with the
 * report it came from — otherwise a set-aside row could not be traced back to the
 * week whose export needs a second look.
 */
import type { CirculationRow } from '../domain/types';
import { normalizeBarcode } from '../domain/identifiers';
import { cell, dataRows, type HeaderMap } from './headerMap';
import { parseDueDateCell } from './excelDate';
import type { SheetRow } from './xlsxReader';

function blankToNull(raw: string): string | null {
  const s = raw.trim();
  return s === '' ? null : s;
}

export function parseCirculation(
  rows: SheetRow[],
  map: HeaderMap,
  fileName: string,
): CirculationRow[] {
  return dataRows(rows, map).map((row) => {
    const barcode = cell(map, row, 'Patron Barcode').trim();
    // Kept verbatim: an unreadable due date must be showable to the librarian.
    const dueDateRaw = cell(map, row, 'Due');
    return {
      sourceFile: fileName,
      displayName: cell(map, row, 'Patron Name').trim(),
      barcode,
      matchKey: normalizeBarcode(barcode),
      transactionType: blankToNull(cell(map, row, 'Transaction Type')),
      dueDate: parseDueDateCell(dueDateRaw),
      dueDateRaw,
      itemTitle: blankToNull(cell(map, row, 'Title/Description')),
      fineReason: blankToNull(cell(map, row, 'Fine Reason')),
      sourceRow: row.rowNumber,
    };
  });
}
