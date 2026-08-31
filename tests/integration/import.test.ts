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

describe('ingesting a week', () => {
  it('builds homerooms from two files, in either selection order', () => {
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

    for (const [a, b] of [
      [{ fileName: 'roster.xlsx', bytes: rosterBytes() }, { fileName: 'circ.xlsx', bytes: circ }],
      [{ fileName: 'circ.xlsx', bytes: circ }, { fileName: 'roster.xlsx', bytes: rosterBytes() }],
    ]) {
      const result = ingestWorkbooks({
        fileA: a!,
        fileB: b!,
        history: [],
        rounds: [],
        today: TODAY,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.summary.rosterFileName).toBe('roster.xlsx');
      expect(result.summary.circulationFileName).toBe('circ.xlsx');
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

  it('treats a week with no overdue items as valid and says the count is zero', () => {
    // This is the reference circulation export's exact shape: fines and refunds only.
    const circ = makeWorkbook([
      CIRC_HEADERS,
      circRow({ name: 'Able, Ann', barcode: '001000001', fineReason: 'Lost LM' }),
      circRow({ name: 'Brown, Ben', barcode: '001000002', fineReason: 'Refund LM' }),
    ]);
    const result = ingestWorkbooks({
      fileA: { fileName: 'roster.xlsx', bytes: rosterBytes() },
      fileB: { fileName: 'circ.xlsx', bytes: circ },
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
      fileA: { fileName: 'roster.xlsx', bytes: rosterBytes() },
      fileB: { fileName: 'circ.xlsx', bytes: circ },
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
      fileA: { fileName: 'roster.xlsx', bytes: rosterBytes() },
      fileB: { fileName: 'circ.xlsx', bytes: circ },
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
      fileA: { fileName: 'roster.xlsx', bytes: rosterBytes() },
      fileB: { fileName: 'notes.txt', bytes: new TextEncoder().encode('hello') },
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
      fileA: { fileName: 'roster.xlsx', bytes: broken },
      fileB: { fileName: 'circ.xlsx', bytes: circ },
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
