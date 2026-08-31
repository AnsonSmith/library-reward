/**
 * Builds real .xlsx bytes from a 2D array of strings.
 *
 * Fixtures are generated rather than committed: the only real workbooks available
 * contain live elementary-school student names, and generated fixtures let us
 * exercise cases the real exports cannot (overdue rows, unreadable due dates).
 */
import { zipSync, strToU8 } from 'fflate';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export interface WorkbookOptions {
  /** 'shared' exercises sharedStrings.xml, 'inline' exercises inlineStr cells. */
  stringMode?: 'shared' | 'inline';
  /** Cells whose text is purely numeric are written as numbers (like Excel does). */
  numbersAsNumbers?: boolean;
}

/**
 * @param rows Row-major cell text. `null` means the cell is omitted entirely,
 *             which is how real exports encode a sparse row.
 */
export function makeWorkbook(
  rows: (string | null)[][],
  options: WorkbookOptions = {},
): Uint8Array {
  const { stringMode = 'shared', numbersAsNumbers = true } = options;

  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  const indexOf = (text: string): number => {
    const existing = sharedIndex.get(text);
    if (existing !== undefined) return existing;
    const i = shared.length;
    shared.push(text);
    sharedIndex.set(text, i);
    return i;
  };

  const rowXml = rows
    .map((cells, r) => {
      const rowNumber = r + 1;
      const cellXml = cells
        .map((text, c) => {
          if (text === null) return '';
          const ref = `${colLetter(c)}${rowNumber}`;
          const isNumber = numbersAsNumbers && text !== '' && /^-?\d+(\.\d+)?$/.test(text);
          if (isNumber) return `<c r="${ref}"><v>${esc(text)}</v></c>`;
          if (text === '') return `<c r="${ref}"/>`;
          if (stringMode === 'inline') {
            return `<c r="${ref}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`;
          }
          return `<c r="${ref}" t="s"><v>${indexOf(text)}</v></c>`;
        })
        .join('');
      return `<row r="${rowNumber}">${cellXml}</row>`;
    })
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${rowXml}</sheetData></worksheet>`;
  const sharedXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${NS}" count="${shared.length}" uniqueCount="${shared.length}">${shared
    .map((s) => `<si><t>${esc(s)}</t></si>`)
    .join('')}</sst>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}"><sheets><sheet name="Sheet1" sheetId="1"/></sheets></workbook>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  if (stringMode === 'shared') files['xl/sharedStrings.xml'] = strToU8(sharedXml);

  return zipSync(files);
}

/** Header row of the real roster export, in its observed order. */
export const ROSTER_HEADERS = [
  'Name',
  'District ID',
  'Patron Type',
  'Barcode',
  'Status',
  'Graduation Year',
  'Card Expires',
  'Homeroom',
];

/** Header row of the real circulation export, in its observed order. */
export const CIRC_HEADERS = [
  'Patron Name',
  'Patron Barcode',
  'Transaction Type',
  'Due',
  'Call Number',
  'Copy/Item Barcode',
  'Copy Deleted',
  'Title/Description',
  'Replacement/Purchase Price',
  'Fine Reason',
  'Fine Assessed Date',
  'Fine Estimate/Due',
  'Fine Increment/Day',
];

export function rosterRow(opts: {
  name: string;
  districtId?: string;
  patronType?: string;
  barcode: string;
  status?: string;
  homeroom?: string;
}): string[] {
  return [
    opts.name,
    opts.districtId ?? '',
    opts.patronType ?? 'Student',
    opts.barcode,
    opts.status ?? 'Active',
    '',
    '',
    opts.homeroom ?? '',
  ];
}

export function circRow(opts: {
  name: string;
  barcode: string;
  transactionType?: string;
  due?: string;
  title?: string;
  fineReason?: string;
}): string[] {
  return [
    opts.name,
    opts.barcode,
    opts.transactionType ?? 'Unpaid Fines & Refunds',
    opts.due ?? '',
    '',
    '',
    '',
    opts.title ?? '',
    '',
    opts.fineReason ?? '',
    '',
    '',
    '',
  ];
}
