/**
 * Runs the real exports through the whole pipeline.
 *
 * These files hold live elementary-school student names, so they are gitignored
 * and never committed. The suite skips itself when they are absent, which is the
 * normal state on any machine but the developer's.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingestWorkbooks } from '../../src/parsing/ingest';
import { NO_HOMEROOM } from '../../src/domain/types';

const ROOT = join(__dirname, '..', '..');
const ROSTER = join(ROOT, 'PatronNameListJob829811.xlsx');
const CIRC = join(ROOT, 'PatronCircReportJob829808.xlsx');
const available = existsSync(ROSTER) && existsSync(CIRC);

describe.skipIf(!available)('the real reference exports', () => {
  const run = () =>
    ingestWorkbooks({
      fileA: { fileName: 'PatronNameListJob829811.xlsx', bytes: new Uint8Array(readFileSync(ROSTER)) },
      fileB: { fileName: 'PatronCircReportJob829808.xlsx', bytes: new Uint8Array(readFileSync(CIRC)) },
      history: [],
      rounds: [],
      today: '2026-08-30',
    });

  it('reads the roster into the expected shape', () => {
    const result = run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.rosterRowsRead).toBe(1070);
    expect(result.summary.activeStudents).toBe(975);
    expect(result.summary.homeroomCount).toBe(67);
    expect(result.summary.countsByReason.faculty).toBe(92);
    expect(result.summary.countsByReason.inactive).toBe(3); // 3 inactive students; 4 inactive faculty count as faculty
    expect(result.summary.countsByReason.noHomeroom).toBe(7);
  });

  it('finds no overdue items in this export, and says so rather than failing', () => {
    // Every row is "Unpaid Fines & Refunds" with an empty Due column, so under the
    // clarified rule (overdue items only) this week disqualifies nobody.
    const result = run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.circulationRowsRead).toBe(17);
    expect(result.summary.overdueRowsFound).toBe(0);
    expect(result.summary.countsByReason.nonOverdue).toBe(17);
    expect(result.summary.countsByReason.unmatchedCirculation).toBe(0);

    const blocked = result.homerooms.reduce((n, h) => n + h.blockedByOverdue.length, 0);
    expect(blocked).toBe(0);
  });

  it('groups every active student into a homeroom or the unassigned group', () => {
    const result = run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const placed = result.homerooms.reduce((n, h) => n + h.students.length, 0);
    expect(placed).toBe(result.summary.activeStudents);

    const unassigned = result.homerooms.find((h) => h.name === NO_HOMEROOM);
    expect(unassigned?.students).toHaveLength(7);
    expect(result.homerooms.at(-1)!.name).toBe(NO_HOMEROOM);
  });
});
