import { describe, it, expect } from 'vitest';
import { readFirstSheet } from '../../src/parsing/xlsxReader';
import { identifyReport, pairReports } from '../../src/parsing/identifyReport';
import {
  makeWorkbook,
  ROSTER_HEADERS,
  CIRC_HEADERS,
  rosterRow,
  circRow,
} from '../fixtures/makeWorkbook';

const rosterSheet = () =>
  readFirstSheet(
    makeWorkbook([ROSTER_HEADERS, rosterRow({ name: 'Doe, Jane', barcode: '000100001', homeroom: 'Marigold, Rita' })]),
  );
const circSheet = () =>
  readFirstSheet(makeWorkbook([CIRC_HEADERS, circRow({ name: 'Doe, Jane', barcode: '000100001' })]));

describe('identifyReport', () => {
  it('recognizes the roster by Patron Type + Homeroom', () => {
    expect(identifyReport(rosterSheet()).role).toBe('roster');
  });

  it('recognizes the circulation report by Patron Barcode + Due', () => {
    expect(identifyReport(circSheet()).role).toBe('circulation');
  });

  it('reports an unrecognized file rather than guessing', () => {
    const other = readFirstSheet(makeWorkbook([['Widget', 'Price'], ['Sprocket', '3']]));
    expect(identifyReport(other).role).toBe('unknown');
  });

  it('names the missing column when the roster is short one header', () => {
    const short = ROSTER_HEADERS.filter((h) => h !== 'Status');
    const rows = readFirstSheet(makeWorkbook([short, short.map(() => 'x')]));
    const id = identifyReport(rows);
    expect(id.role).toBe('roster');
    expect(id.missing).toContain('Status');
  });
});

describe('pairReports', () => {
  it('assigns each file to its role', () => {
    const paired = pairReports(
      { rows: rosterSheet(), fileName: 'PatronNameListJob829811.xlsx' },
      { rows: circSheet(), fileName: 'PatronCircReportJob829808.xlsx' },
    );
    expect(paired.ok).toBe(true);
    if (!paired.ok) return;
    expect(paired.roster.fileName).toBe('PatronNameListJob829811.xlsx');
    expect(paired.circulation.fileName).toBe('PatronCircReportJob829808.xlsx');
    expect(paired.swapped).toBe(false);
  });

  it('corrects a swapped selection and says so', () => {
    const paired = pairReports(
      { rows: circSheet(), fileName: 'PatronCircReportJob829808.xlsx' },
      { rows: rosterSheet(), fileName: 'PatronNameListJob829811.xlsx' },
    );
    expect(paired.ok).toBe(true);
    if (!paired.ok) return;
    expect(paired.roster.fileName).toBe('PatronNameListJob829811.xlsx');
    expect(paired.swapped).toBe(true);
  });

  it('refuses two rosters, explaining what is missing', () => {
    const paired = pairReports(
      { rows: rosterSheet(), fileName: 'a.xlsx' },
      { rows: rosterSheet(), fileName: 'b.xlsx' },
    );
    expect(paired.ok).toBe(false);
    if (paired.ok) return;
    expect(paired.problem).toMatch(/circulation|outstanding/i);
  });

  it('refuses a file that is neither report, naming the file', () => {
    const other = readFirstSheet(makeWorkbook([['Widget'], ['Sprocket']]));
    const paired = pairReports(
      { rows: rosterSheet(), fileName: 'roster.xlsx' },
      { rows: other, fileName: 'shopping-list.xlsx' },
    );
    expect(paired.ok).toBe(false);
    if (paired.ok) return;
    expect(paired.problem).toContain('shopping-list.xlsx');
  });
});
