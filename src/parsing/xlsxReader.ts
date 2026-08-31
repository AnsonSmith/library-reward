/**
 * Minimal OOXML reader: unzip, read shared strings, read the first worksheet.
 *
 * The app needs a rectangle of cells from one sheet — no formulas, no styles, no
 * writing. That is ~100 lines, against ~1MB for a full spreadsheet library in a
 * file that must be double-clicked. See research.md R3.
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface SheetRow {
  /** 1-based row number in the source sheet. */
  rowNumber: number;
  /** Cell text keyed by column letter ('A', 'B', ... 'AA'). Absent cells are absent. */
  cells: Record<string, string>;
}

export class SpreadsheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpreadsheetReadError';
  }
}

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function parseXml(xml: string, what: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new SpreadsheetReadError(`The ${what} inside this file could not be read.`);
  }
  return doc;
}

/** Concatenate every <t> under a node — shared strings may be split across runs. */
function textOf(node: Element): string {
  const parts = node.getElementsByTagNameNS(MAIN_NS, 't');
  let out = '';
  for (let i = 0; i < parts.length; i++) out += parts[i]?.textContent ?? '';
  return out;
}

function columnLetters(ref: string): string {
  const m = /^([A-Z]+)/.exec(ref);
  return m ? (m[1] as string) : '';
}

/**
 * Read the first worksheet of an .xlsx file into rows of cell text.
 * Sparse rows are preserved as sparse: an omitted cell is simply absent, so a
 * missing value never shifts the columns that follow it.
 */
export function readFirstSheet(data: Uint8Array): SheetRow[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new SpreadsheetReadError(
      'This file is not a readable Excel workbook. It may be corrupt, password-protected, or a different kind of file.',
    );
  }

  const sheetPath = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetPath) {
    throw new SpreadsheetReadError('This Excel file contains no worksheets.');
  }

  const shared: string[] = [];
  const sharedFile = files['xl/sharedStrings.xml'];
  if (sharedFile) {
    const doc = parseXml(strFromU8(sharedFile), 'text');
    const items = doc.getElementsByTagNameNS(MAIN_NS, 'si');
    for (let i = 0; i < items.length; i++) shared.push(textOf(items[i] as Element));
  }

  const doc = parseXml(strFromU8(files[sheetPath] as Uint8Array), 'worksheet');
  const rowEls = doc.getElementsByTagNameNS(MAIN_NS, 'row');
  const rows: SheetRow[] = [];

  for (let r = 0; r < rowEls.length; r++) {
    const rowEl = rowEls[r] as Element;
    const rowNumber = Number(rowEl.getAttribute('r') ?? r + 1);
    const cells: Record<string, string> = {};
    const cellEls = rowEl.getElementsByTagNameNS(MAIN_NS, 'c');

    for (let c = 0; c < cellEls.length; c++) {
      const cellEl = cellEls[c] as Element;
      const col = columnLetters(cellEl.getAttribute('r') ?? '');
      if (!col) continue;

      const type = cellEl.getAttribute('t');
      let value = '';

      if (type === 's') {
        const v = cellEl.getElementsByTagNameNS(MAIN_NS, 'v')[0];
        const idx = v ? Number(v.textContent) : NaN;
        value = Number.isInteger(idx) ? (shared[idx] ?? '') : '';
      } else if (type === 'inlineStr') {
        value = textOf(cellEl);
      } else {
        const v = cellEl.getElementsByTagNameNS(MAIN_NS, 'v')[0];
        value = v?.textContent ?? textOf(cellEl);
      }

      if (value !== '') cells[col] = value;
    }

    rows.push({ rowNumber, cells });
  }

  return rows;
}
