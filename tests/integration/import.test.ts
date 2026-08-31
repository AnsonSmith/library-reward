import { describe, it, expect } from 'vitest';
import { ingestWorkbooks } from '../../src/parsing/ingest';
import { NO_HOMEROOM } from '../../src/domain/types';
import {
  makeWorkbook,
  ROSTER_HEADERS,
  CIRC_HEADERS,
  rosterRow,
  circRow,
} from '../fixtures/makeWorkbook';

const TODAY = '2026-03-05';
const OVERDUE_SERIAL = '46082'; // 2026-02-25, in the past
const FUTURE_SERIAL = '46100'; // 2026-03-15

/** A roster shaped like the real export: faculty, inactive rows, blank homerooms. */
function rosterBytes() {
  return makeWorkbook([
    ROSTER_HEADERS,
    rosterRow({ name: 'Able, Ann', barcode: '001000001', homeroom: 'Marigold, Rita' }),
    rosterRow({ name: 'Brown, Ben', barcode: '001000002', homeroom: 'Marigold, Rita' }),
    rosterRow({ name: 'Cole, Cara', barcode: '001000003', homeroom: 'Marigold, Rita' }),
    rosterRow({ name: 'Dean, Dev', barcode: '001000004', homeroom: 'Pennyworth, Alex' }),
    rosterRow({ name: 'Epps, Eli', barcode: '001000005', homeroom: 'Pennyworth, Alex' }),
    rosterRow({ name: 'Ford, Fay', barcode: '001000006', homeroom: '' }),
    rosterRow({ name: 'Teacher, Tam', barcode: 'P 4242', patronType: 'Faculty', homeroom: '' }),
    rosterRow({ name: 'Gone, Gil', barcode: '001000008', status: 'Inactive', homeroom: 'Marigold, Rita' }),
  ]);
}

describe('ingesting a month', () => {
  it('builds homerooms from a roster and one report, in either selection order', () => {
    const circ = makeWorkbook([
      CIRC_HEADERS,
      // Cole is genuinely overdue -> disqualified.
      circRow({ name: 'Cole, Cara', barcode: '001000003', transactionType: 'Overdue', due: OVERDUE_SERIAL, title: 'Dog Man' }),
      // Able owes a fine and is owed a refund -> still eligible.
      circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Lost LM' }),
      circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Refund LM' }),
      // Not on the roster at all.
      circRow({ name: 'Ghost, Gus', barcode: '009999999', fineReason: 'Lost LM' }),
    ]);

    for (const files of [
      [{ fileName: 'roster.xlsx', bytes: rosterBytes() }, { fileName: 'circ.xlsx', bytes: circ }],
      [{ fileName: 'circ.xlsx', bytes: circ }, { fileName: 'roster.xlsx', bytes: rosterBytes() }],
    ]) {
      const result = ingestWorkbooks({ files, history: [], rounds: [], today: TODAY });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.summary.rosterFileName).toBe('roster.xlsx');
      expect(result.circulationFileNames).toEqual(['circ.xlsx']);
      expect(result.summary.activeStudents).toBe(6);
      expect(result.summary.homeroomCount).toBe(2);
      expect(result.summary.overdueRowsFound).toBe(1);
      expect(result.summary.countsByReason.faculty).toBe(1);
      expect(result.summary.countsByReason.inactive).toBe(1);
      expect(result.summary.countsByReason.noHomeroom).toBe(1);
      expect(result.summary.countsByReason.unmatchedCirculation).toBe(1);
      expect(result.summary.countsByReason.nonOverdue).toBe(2);

      const bass = result.homerooms.find((h) => h.name === 'Marigold, Rita')!;
      expect(bass.candidates.map((s) => s.displayName)).toEqual(['Able, Ann', 'Brown, Ben']);
      expect(bass.blockedByOverdue.map((s) => s.displayName)).toEqual(['Cole, Cara']);

      // The unassigned group exists, is last, and is not a real homeroom.
      expect(result.homerooms.at(-1)!.name).toBe(NO_HOMEROOM);
    }
  });

  it('treats a month with no overdue items as valid and says the count is zero', () => {
    // This is the reference circulation export's exact shape: fines and refunds only.
    const circ = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Lost LM' }),
      circRow({ name: 'Brown, Ben', barcode: '001000002', fineReason: 'Refund LM' }),
    ]);
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        { fileName: 'circ.xlsx', bytes: circ },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.overdueRowsFound).toBe(0);
    const bass = result.homerooms.find((h) => h.name === 'Marigold, Rita')!;
    expect(bass.candidates).toHaveLength(3);
  });

  it('does not disqualify a student whose book is due today or later', () => {
    const circ = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Able, Ann', barcode: '001000001', transactionType: 'Checked Out', due: '46091' }), // 2026-03-05, today
      circRow({ name: 'Brown, Ben', barcode: '001000002', transactionType: 'Checked Out', due: FUTURE_SERIAL }),
    ]);
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        { fileName: 'circ.xlsx', bytes: circ },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.overdueRowsFound).toBe(0);
    expect(result.homerooms.find((h) => h.name === 'Marigold, Rita')!.candidates).toHaveLength(3);
  });

  it('surfaces a checkout whose due date cannot be read', () => {
    const circ = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Able, Ann', barcode: '001000001', transactionType: 'Checked Out', due: '##########' }),
    ]);
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        { fileName: 'circ.xlsx', bytes: circ },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.countsByReason.undeterminableDueDate).toBe(1);
    expect(result.summary.setAside.find((s) => s.reason === 'undeterminableDueDate')?.detail).toContain('##########');
  });

  it('refuses an unreadable file, naming it', () => {
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        { fileName: 'notes.txt', bytes: new TextEncoder().encode('hello') },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('notes.txt');
  });

  it('refuses a roster missing a required column, naming the column', () => {
    const short = ROSTER_HEADERS.filter((h) => h !== 'Status');
    const broken = makeWorkbook([short, short.map(() => 'x')]);
    const circ = makeWorkbook([CIRC_HEADERS, circRow({ name: 'A', barcode: '1' })]);
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: broken },
        { fileName: 'circ.xlsx', bytes: circ },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('Status');
    expect(result.problem).toContain('roster.xlsx');
  });
});

describe('pooling a month of weekly circulation reports', () => {
  /** Four weekly reports, only the first of which shows Cole overdue. */
  function fourWeeks() {
    const week1 = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Cole, Cara', barcode: '001000003', transactionType: 'Overdue', due: OVERDUE_SERIAL, title: 'Dog Man' }),
    ]);
    // Cole returned the book, so weeks 2-4 show nothing against her.
    const week2 = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Lost LM' }),
    ]);
    const week3 = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Dean, Dev', barcode: '001000004', transactionType: 'Overdue', due: OVERDUE_SERIAL, title: 'Wings of Fire' }),
    ]);
    const week4 = makeWorkbook([CIRC_HEADERS]);
    return [
      { fileName: 'roster.xlsx', bytes: rosterBytes() },
      { fileName: 'week1.xlsx', bytes: week1 },
      { fileName: 'week2.xlsx', bytes: week2 },
      { fileName: 'week3.xlsx', bytes: week3 },
      { fileName: 'week4.xlsx', bytes: week4 },
    ];
  }

  it('keeps a student out for the whole month on the strength of one report', () => {
    const result = ingestWorkbooks({ files: fourWeeks(), history: [], rounds: [], today: TODAY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Cole is overdue only in week 1 and clear in weeks 2-4. Returning it late
    // does not put her back in the month's drawing.
    const marigold = result.homerooms.find((h) => h.name === 'Marigold, Rita')!;
    expect(marigold.blockedByOverdue.map((s) => s.displayName)).toEqual(['Cole, Cara']);
    expect(marigold.candidates.map((s) => s.displayName)).toEqual(['Able, Ann', 'Brown, Ben']);

    // A different report catches a different homeroom's student; both count.
    const pennyworth = result.homerooms.find((h) => h.name === 'Pennyworth, Alex')!;
    expect(pennyworth.blockedByOverdue.map((s) => s.displayName)).toEqual(['Dean, Dev']);
    expect(result.summary.studentsBlockedByOverdue).toBe(2);
  });

  it('reports every file it read, in order, including one with no rows', () => {
    const result = ingestWorkbooks({ files: fourWeeks(), history: [], rounds: [], today: TODAY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.circulationFiles.map((f) => f.fileName)).toEqual([
      'week1.xlsx',
      'week2.xlsx',
      'week3.xlsx',
      'week4.xlsx',
    ]);
    // An empty export is listed rather than absent, so a botched export is visible.
    expect(result.summary.circulationFiles.at(-1)).toMatchObject({
      fileName: 'week4.xlsx',
      rowsRead: 0,
      overdueRowsFound: 0,
    });
    expect(result.summary.circulationRowsRead).toBe(3);
    expect(result.summary.overdueRowsFound).toBe(2);
  });

  it('credits only the first report to catch a student, so the numbers add up', () => {
    const overdue = (fileName: string) => ({
      fileName,
      bytes: makeWorkbook([
        CIRC_HEADERS,
        circRow({ name: 'Cole, Cara', barcode: '001000003', transactionType: 'Overdue', due: OVERDUE_SERIAL }),
      ]),
    });
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        overdue('week1.xlsx'),
        overdue('week2.xlsx'),
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Cole holds the same book across both weeks: two overdue rows, one student.
    expect(result.summary.overdueRowsFound).toBe(2);
    expect(result.summary.studentsBlockedByOverdue).toBe(1);
    const first = result.summary.circulationFiles.map((f) => f.studentsFirstBlockedHere);
    expect(first).toEqual([1, 0]);
    expect(first.reduce((a, b) => a + b, 0)).toBe(result.summary.studentsBlockedByOverdue);
  });

  it('still lets fines and refunds through, however many reports carry them', () => {
    const fines = (fileName: string) => ({
      fileName,
      bytes: makeWorkbook([
        CIRC_HEADERS,
        circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Lost LM' }),
        circRow({ name: 'Brown, Ben', barcode: '001000002', fineReason: 'Refund LM' }),
      ]),
    });
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        fines('week1.xlsx'),
        fines('week2.xlsx'),
        fines('week3.xlsx'),
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.studentsBlockedByOverdue).toBe(0);
    expect(result.homerooms.find((h) => h.name === 'Marigold, Rita')!.candidates).toHaveLength(3);
  });

  it('names the report a set-aside row came from', () => {
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        {
          fileName: 'week1.xlsx',
          bytes: makeWorkbook([CIRC_HEADERS, circRow({ name: 'Ghost, Gus', barcode: '009999999' })]),
        },
        {
          fileName: 'week2.xlsx',
          bytes: makeWorkbook([
            CIRC_HEADERS,
            circRow({ name: 'Able, Ann', barcode: '001000001', transactionType: 'Checked Out', due: '##########' }),
          ]),
        },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const unmatched = result.summary.setAside.find((s) => s.reason === 'unmatchedCirculation')!;
    expect(unmatched.sourceFile).toBe('week1.xlsx');
    const unreadable = result.summary.setAside.find((s) => s.reason === 'undeterminableDueDate')!;
    expect(unreadable.sourceFile).toBe('week2.xlsx');
    // Roster rows have only one possible source, so they carry none.
    expect(result.summary.setAside.find((s) => s.reason === 'faculty')!.sourceFile).toBeNull();
  });

  it('refuses a pile with no circulation report in it', () => {
    const result = ingestWorkbooks({
      files: [
        { fileName: 'roster.xlsx', bytes: rosterBytes() },
        { fileName: 'roster-again.xlsx', bytes: rosterBytes() },
      ],
      history: [],
      rounds: [],
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain('roster.xlsx');
    expect(result.problem).toContain('roster-again.xlsx');
  });
});
