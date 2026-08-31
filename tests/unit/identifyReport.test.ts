import { describe, it, expect } from 'vitest';
import { readFirstSheet } from '../../src/parsing/xlsxReader';
import { classifyReports, identifyReport } from '../../src/parsing/identifyReport';
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

describe('classifyReports', () => {
  it('assigns each file to its role regardless of selection order', () => {
    for (const order of [
      [
        { rows: rosterSheet(), fileName: 'PatronNameListJob829811.xlsx' },
        { rows: circSheet(), fileName: 'PatronCircReportJob829808.xlsx' },
      ],
      [
        { rows: circSheet(), fileName: 'PatronCircReportJob829808.xlsx' },
        { rows: rosterSheet(), fileName: 'PatronNameListJob829811.xlsx' },
      ],
    ]) {
      const sorted = classifyReports(order);
      expect(sorted.ok).toBe(true);
      if (!sorted.ok) return;
      expect(sorted.roster.fileName).toBe('PatronNameListJob829811.xlsx');
      expect(sorted.circulation.map((c) => c.fileName)).toEqual([
        'PatronCircReportJob829808.xlsx',
      ]);
    }
  });

  it('takes a whole month of circulation reports alongside one roster', () => {
    const sorted = classifyReports([
      { rows: circSheet(), fileName: 'week1.xlsx' },
      { rows: rosterSheet(), fileName: 'roster.xlsx' },
      { rows: circSheet(), fileName: 'week2.xlsx' },
      { rows: circSheet(), fileName: 'week3.xlsx' },
      { rows: circSheet(), fileName: 'week4.xlsx' },
    ]);
    expect(sorted.ok).toBe(true);
    if (!sorted.ok) return;
    expect(sorted.roster.fileName).toBe('roster.xlsx');
    // Order is the order they were selected in, so the summary reads predictably.
    expect(sorted.circulation.map((c) => c.fileName)).toEqual([
      'week1.xlsx',
      'week2.xlsx',
      'week3.xlsx',
      'week4.xlsx',
    ]);
  });

  it('refuses two rosters, naming both', () => {
    const sorted = classifyReports([
      { rows: rosterSheet(), fileName: 'a.xlsx' },
      { rows: rosterSheet(), fileName: 'b.xlsx' },
      { rows: circSheet(), fileName: 'week1.xlsx' },
    ]);
    expect(sorted.ok).toBe(false);
    if (sorted.ok) return;
    expect(sorted.problem).toContain('a.xlsx');
    expect(sorted.problem).toContain('b.xlsx');
  });

  it('refuses a pile with no roster in it', () => {
    const sorted = classifyReports([
      { rows: circSheet(), fileName: 'week1.xlsx' },
      { rows: circSheet(), fileName: 'week2.xlsx' },
    ]);
    expect(sorted.ok).toBe(false);
    if (sorted.ok) return;
    expect(sorted.problem).toMatch(/roster/i);
  });

  it('refuses a roster with no circulation report to check it against', () => {
    const sorted = classifyReports([{ rows: rosterSheet(), fileName: 'roster.xlsx' }]);
    expect(sorted.ok).toBe(false);
    if (sorted.ok) return;
    expect(sorted.problem).toMatch(/circulation report/i);
  });

  it('refuses a file that is neither report, naming the file', () => {
    const other = readFirstSheet(makeWorkbook([['Widget'], ['Sprocket']]));
    const sorted = classifyReports([
      { rows: rosterSheet(), fileName: 'roster.xlsx' },
      { rows: circSheet(), fileName: 'week1.xlsx' },
      { rows: other, fileName: 'shopping-list.xlsx' },
    ]);
    expect(sorted.ok).toBe(false);
    if (sorted.ok) return;
    expect(sorted.problem).toContain('shopping-list.xlsx');
  });
});
