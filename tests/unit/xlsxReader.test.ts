import { describe, it, expect } from 'vitest';
import { readFirstSheet, SpreadsheetReadError } from '../../src/parsing/xlsxReader';
import { makeWorkbook } from '../fixtures/makeWorkbook';

describe('readFirstSheet', () => {
  it('reads shared strings', () => {
    const rows = readFirstSheet(
      makeWorkbook(
        [
          ['Name', 'Barcode'],
          ['Doe, Jane', '000100001'],
        ],
        { stringMode: 'shared' },
      ),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cells).toEqual({ A: 'Name', B: 'Barcode' });
    expect(rows[1]!.cells.A).toBe('Doe, Jane');
  });

  it('reads inline strings', () => {
    const rows = readFirstSheet(
      makeWorkbook(
        [
          ['Name', 'Barcode'],
          ['Roe, Sam', '000100006'],
        ],
        { stringMode: 'inline' },
      ),
    );
    expect(rows[1]!.cells.A).toBe('Roe, Sam');
  });

  it('keeps a sparse row sparse so later columns do not shift', () => {
    // A row that omits its middle cells entirely, as real exports do.
    const rows = readFirstSheet(makeWorkbook([['A1', 'B1', 'C1'], ['A2', null, 'C2']]));
    expect(rows[1]!.cells).toEqual({ A: 'A2', C: 'C2' });
    expect(rows[1]!.cells.B).toBeUndefined();
  });

  it('preserves the source row number', () => {
    const rows = readFirstSheet(makeWorkbook([['h'], ['one'], ['two']]));
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
  });

  it('reads numeric cells as text', () => {
    const rows = readFirstSheet(makeWorkbook([['Due'], ['45798.55032407407']]));
    expect(rows[1]!.cells.A).toBe('45798.55032407407');
  });

  it('handles an empty sheet', () => {
    expect(readFirstSheet(makeWorkbook([]))).toEqual([]);
  });

  it('rejects a file that is not a workbook, with a message a librarian can act on', () => {
    const notAZip = new TextEncoder().encode('this is a text file, not a spreadsheet');
    expect(() => readFirstSheet(notAZip)).toThrow(SpreadsheetReadError);
    expect(() => readFirstSheet(notAZip)).toThrow(/not a readable Excel workbook/i);
  });

  it('escapes round-trip correctly', () => {
    const rows = readFirstSheet(makeWorkbook([['Title'], ['Junie B. Jones & the "stupid" bus <1>']]));
    expect(rows[1]!.cells.A).toBe('Junie B. Jones & the "stupid" bus <1>');
  });
});
