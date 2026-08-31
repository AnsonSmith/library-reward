import { describe, it, expect } from 'vitest';
import { buildHomerooms } from '../../src/domain/eligibility';
import { normalizeBarcode } from '../../src/domain/identifiers';
import type { CirculationRow, RosterEntry, SetAsideReason } from '../../src/domain/types';

const TODAY = '2026-03-05';
const PAST = '2026-03-01';

let seq = 1;
function student(over: Partial<RosterEntry> & { barcode: string }): RosterEntry {
  return {
    displayName: `S${over.barcode}`,
    districtId: null,
    patronType: 'Student',
    status: 'Active',
    homeroom: 'Marigold, Rita',
    sourceRow: seq++,
    matchKey: normalizeBarcode(over.barcode),
    ...over,
  } as RosterEntry;
}
function circ(barcode: string, over: Partial<CirculationRow> = {}): CirculationRow {
  return {
    sourceFile: 'circ.xlsx',
    displayName: 'x',
    barcode,
    matchKey: normalizeBarcode(barcode),
    transactionType: 'Unpaid Fines & Refunds',
    dueDate: null,
    dueDateRaw: '',
    itemTitle: null,
    fineReason: null,
    sourceRow: seq++,
    ...over,
  };
}

describe('import summary conservation', () => {
  // A roster row that vanishes without being counted is the failure mode that
  // makes a whole homeroom quietly disappear. Nothing may be dropped silently.
  it('accounts for every roster row exactly once', () => {
    const roster = [
      student({ barcode: '1' }),
      student({ barcode: '2', patronType: 'Faculty' }),
      student({ barcode: '3', status: 'Inactive' }),
      student({ barcode: '4', homeroom: null }),
      student({ barcode: '000100001' }),
      student({ barcode: '100001' }),
      student({ barcode: '' }),
      student({ barcode: '7' }),
    ];
    const { homerooms, summary } = buildHomerooms({
      roster,
      circulation: [circ('7', { dueDate: PAST, dueDateRaw: '45782' })],
      history: [],
      rounds: [],
      today: TODAY,
      circulationFileNames: ['c.xlsx'],
      rosterFileName: 'r.xlsx',
    });

    const placed = homerooms.reduce((n, h) => n + h.students.length, 0);
    const rosterReasons: SetAsideReason[] = [
      'faculty',
      'inactive',
      'duplicateRoster',
      'missingBarcode',
    ];
    const setAside = rosterReasons.reduce((n, r) => n + summary.countsByReason[r], 0);

    expect(placed + setAside).toBe(roster.length);
    expect(summary.rosterRowsRead).toBe(roster.length);
  });

  it('accounts for every circulation row exactly once', () => {
    const circulation = [
      circ('1', { dueDate: PAST, dueDateRaw: '45782' }),
      circ('1', { fineReason: 'Refund LM' }),
      circ('999', { dueDate: PAST, dueDateRaw: '45782' }),
      circ('1', { dueDateRaw: '#####' }),
    ];
    const { summary } = buildHomerooms({
      roster: [student({ barcode: '1' })],
      circulation,
      history: [],
      rounds: [],
      today: TODAY,
      circulationFileNames: ['c.xlsx'],
      rosterFileName: 'r.xlsx',
    });

    const c = summary.countsByReason;
    expect(c.unmatchedCirculation).toBe(1);
    expect(c.nonOverdue).toBe(1);
    expect(c.undeterminableDueDate).toBe(1);
    expect(summary.overdueRowsFound).toBe(1);
    expect(
      summary.overdueRowsFound + c.unmatchedCirculation + c.nonOverdue + c.undeterminableDueDate,
    ).toBe(circulation.length);
    expect(summary.circulationRowsRead).toBe(circulation.length);
  });

  it('attaches the affected rows so each count can be shown, not just totalled', () => {
    const { summary } = buildHomerooms({
      roster: [student({ barcode: '1', patronType: 'Faculty', displayName: 'Teacher, A' })],
      circulation: [circ('404', { displayName: 'Ghost, B' })],
      history: [],
      rounds: [],
      today: TODAY,
      circulationFileNames: ['c.xlsx'],
      rosterFileName: 'r.xlsx',
    });
    const faculty = summary.setAside.find((s) => s.reason === 'faculty');
    const ghost = summary.setAside.find((s) => s.reason === 'unmatchedCirculation');
    expect(faculty?.displayName).toBe('Teacher, A');
    expect(ghost?.displayName).toBe('Ghost, B');
    expect(ghost?.sourceRow).toBeGreaterThan(0);
  });

  it('counts a zero-overdue week plainly instead of treating it as an error', () => {
    // This is the reference export's exact shape: fines and refunds only.
    const { summary, homerooms } = buildHomerooms({
      roster: [student({ barcode: '1' }), student({ barcode: '2' })],
      circulation: [circ('1', { fineReason: 'Lost LM' }), circ('2', { fineReason: 'Refund LM' })],
      history: [],
      rounds: [],
      today: TODAY,
      circulationFileNames: ['c.xlsx'],
      rosterFileName: 'r.xlsx',
    });
    expect(summary.overdueRowsFound).toBe(0);
    expect(homerooms[0]!.candidates).toHaveLength(2);
  });
});
