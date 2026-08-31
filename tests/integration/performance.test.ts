/**
 * SC-002 allows 10 seconds from choosing files to candidate lists. The plan aims
 * for under 3. This runs the whole path — unzip, XML parse, header mapping,
 * eligibility, grouping — at the school's real scale, which for a monthly drawing
 * is a roster plus a month of weekly circulation reports rather than just one.
 */
import { describe, it, expect } from 'vitest';
import { ingestWorkbooks } from '../../src/parsing/ingest';
import { makeWorkbook, ROSTER_HEADERS, CIRC_HEADERS, rosterRow, circRow } from '../fixtures/makeWorkbook';

const STUDENTS = 1000;
const HOMEROOMS = 70;
const CIRC_ROWS = 300;
/** A long month, so the budget is measured against the worst realistic case. */
const WEEKLY_REPORTS = 5;

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

/** One week's report. Each week catches a different slice of students. */
function bigCirculation(week: number): Uint8Array {
  const rows: (string | null)[][] = [CIRC_HEADERS];
  for (let i = 0; i < CIRC_ROWS; i++) {
    const student = (i + week * CIRC_ROWS) % STUDENTS;
    rows.push(
      circRow({
        name: `Student${String(student).padStart(4, '0')}, Test`,
        barcode: `00${1000000 + student}`,
        transactionType: i % 3 === 0 ? 'Overdue' : 'Unpaid Fines & Refunds',
        due: i % 3 === 0 ? '46000' : '',
        fineReason: i % 3 === 0 ? '' : 'Lost LM',
      }),
    );
  }
  return makeWorkbook(rows);
}

describe('performance at school scale', () => {
  it('ingests ~1,100 roster rows and a month of circulation reports inside the budget', () => {
    const files = [
      { fileName: 'roster.xlsx', bytes: bigRoster() },
      ...Array.from({ length: WEEKLY_REPORTS }, (_, week) => ({
        fileName: `circ-week${week + 1}.xlsx`,
        bytes: bigCirculation(week),
      })),
    ];

    const started = performance.now();
    const result = ingestWorkbooks({ files, history: [], rounds: [], today: '2026-03-05' });
    const elapsed = performance.now() - started;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.activeStudents).toBe(STUDENTS);
    expect(result.summary.homeroomCount).toBe(HOMEROOMS);
    expect(result.summary.circulationFiles).toHaveLength(WEEKLY_REPORTS);
    expect(result.summary.circulationRowsRead).toBe(CIRC_ROWS * WEEKLY_REPORTS);
    expect(result.summary.overdueRowsFound).toBe(100 * WEEKLY_REPORTS);

    // Generous even for a Chromebook, which is slower than a dev machine.
    expect(elapsed).toBeLessThan(3000);
  });
});
