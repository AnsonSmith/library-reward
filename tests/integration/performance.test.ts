/**
 * SC-002 allows 10 seconds from choosing files to candidate lists. The plan aims
 * for under 3. This runs the whole path — unzip, XML parse, header mapping,
 * eligibility, grouping — at the school's real scale.
 */
import { describe, it, expect } from 'vitest';
import { ingestWorkbooks } from '../../src/parsing/ingest';
import { makeWorkbook, ROSTER_HEADERS, CIRC_HEADERS, rosterRow, circRow } from '../fixtures/makeWorkbook';

const STUDENTS = 1000;
const HOMEROOMS = 70;
const CIRC_ROWS = 300;

function bigRoster(): Uint8Array {
  const rows: (string | null)[][] = [ROSTER_HEADERS];
  for (let i = 0; i < STUDENTS; i++) {
    rows.push(
      rosterRow({
        name: `Student${String(i).padStart(4, '0')}, Test`,
        barcode: `00${1000000 + i}`,
        homeroom: `Teacher ${i % HOMEROOMS}`,
      }),
    );
  }
  for (let i = 0; i < 92; i++) {
    rows.push(rosterRow({ name: `Staff${i}, Test`, barcode: `P ${7000 + i}`, patronType: 'Faculty' }));
  }
  return makeWorkbook(rows);
}

function bigCirculation(): Uint8Array {
  const rows: (string | null)[][] = [CIRC_HEADERS];
  for (let i = 0; i < CIRC_ROWS; i++) {
    rows.push(
      circRow({
        name: `Student${String(i).padStart(4, '0')}, Test`,
        barcode: `00${1000000 + i}`,
        transactionType: i % 3 === 0 ? 'Overdue' : 'Unpaid Fines & Refunds',
        due: i % 3 === 0 ? '46000' : '',
        fineReason: i % 3 === 0 ? '' : 'Lost LM',
      }),
    );
  }
  return makeWorkbook(rows);
}

describe('performance at school scale', () => {
  it('ingests ~1,100 roster rows and 300 circulation rows well inside the budget', () => {
    const roster = bigRoster();
    const circulation = bigCirculation();

    const started = performance.now();
    const result = ingestWorkbooks({
      fileA: { fileName: 'roster.xlsx', bytes: roster },
      fileB: { fileName: 'circ.xlsx', bytes: circulation },
      history: [],
      rounds: [],
      today: '2026-03-05',
    });
    const elapsed = performance.now() - started;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.activeStudents).toBe(STUDENTS);
    expect(result.summary.homeroomCount).toBe(HOMEROOMS);
    expect(result.summary.overdueRowsFound).toBe(100);

    // Generous even for a Chromebook, which is slower than a dev machine.
    expect(elapsed).toBeLessThan(3000);
  });
});
