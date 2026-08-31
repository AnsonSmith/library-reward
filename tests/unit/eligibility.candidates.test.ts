import { describe, it, expect } from 'vitest';
import { buildHomerooms } from '../../src/domain/eligibility';
import { normalizeBarcode } from '../../src/domain/identifiers';
import { NO_HOMEROOM } from '../../src/domain/types';
import type { CirculationRow, RosterEntry, WinRecord } from '../../src/domain/types';

const TODAY = '2026-03-05';
const PAST = '2026-03-01';

let seq = 1;
function student(over: Partial<RosterEntry> & { barcode: string }): RosterEntry {
  return {
    displayName: over.displayName ?? `Student ${over.barcode}`,
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

function build(
  roster: RosterEntry[],
  circulation: CirculationRow[] = [],
  history: WinRecord[] = [],
) {
  return buildHomerooms({
    roster,
    circulation,
    history,
    rounds: [],
    today: TODAY,
    circulationFileNames: ['circ.xlsx'],
    rosterFileName: 'roster.xlsx',
  });
}

function names(list: RosterEntry[]): string[] {
  return list.map((s) => s.displayName).sort();
}

describe('buildHomerooms candidate derivation', () => {
  it('excludes faculty and inactive patrons', () => {
    const { homerooms } = build([
      student({ barcode: '1', displayName: 'Kid' }),
      student({ barcode: '2', displayName: 'Teacher', patronType: 'Faculty', homeroom: null }),
      student({ barcode: '3', displayName: 'Gone', status: 'Inactive' }),
    ]);
    const hr = homerooms.find((h) => h.name === 'Marigold, Rita')!;
    expect(names(hr.candidates)).toEqual(['Kid']);
  });

  it('excludes a student holding an overdue item', () => {
    const { homerooms } = build(
      [student({ barcode: '1', displayName: 'Kid' }), student({ barcode: '2', displayName: 'Late' })],
      [circ('2', { dueDate: PAST, dueDateRaw: '45782' })],
    );
    const hr = homerooms[0]!;
    expect(names(hr.candidates)).toEqual(['Kid']);
    expect(names(hr.blockedByOverdue)).toEqual(['Late']);
  });

  it('keeps a student listed only for fines or refunds', () => {
    const { homerooms } = build(
      [student({ barcode: '1', displayName: 'Fined' })],
      [
        circ('1', { fineReason: 'Lost LM' }),
        circ('1', { fineReason: 'Refund LM' }),
        circ('1', { fineReason: 'Lost LM [LLE]' }),
      ],
    );
    expect(names(homerooms[0]!.candidates)).toEqual(['Fined']);
  });

  it('excludes a student with one overdue item and several fines exactly once', () => {
    const { homerooms } = build(
      [student({ barcode: '1', displayName: 'Kid' }), student({ barcode: '2', displayName: 'Late' })],
      [
        circ('2', { fineReason: 'Lost LM' }),
        circ('2', { dueDate: PAST, dueDateRaw: '45782' }),
        circ('2', { fineReason: 'Refund LM' }),
        circ('2', { dueDate: PAST, dueDateRaw: '45781' }),
      ],
    );
    const hr = homerooms[0]!;
    expect(hr.blockedByOverdue).toHaveLength(1);
    expect(names(hr.candidates)).toEqual(['Kid']);
  });

  it('matches across leading-zero drift between the two files', () => {
    const { homerooms, summary } = build(
      [student({ barcode: '000100001', displayName: 'Late' })],
      [circ('100001', { dueDate: PAST, dueDateRaw: '45782' })],
    );
    expect(homerooms[0]!.candidates).toHaveLength(0);
    expect(summary.countsByReason.unmatchedCirculation).toBe(0);
  });

  it('keeps the active record when a student has an old inactive one too', () => {
    // Whichever order the rows arrive in, the active record is the one that survives.
    for (const rows of [
      [
        student({ barcode: '000100001', displayName: 'Old Record', status: 'Inactive' }),
        student({ barcode: '100001', displayName: 'Current Record', status: 'Active' }),
      ],
      [
        student({ barcode: '100001', displayName: 'Current Record', status: 'Active' }),
        student({ barcode: '000100001', displayName: 'Old Record', status: 'Inactive' }),
      ],
    ]) {
      const { homerooms, summary } = build(rows);
      expect(names(homerooms[0]!.candidates)).toEqual(['Current Record']);
      expect(summary.countsByReason.inactive).toBe(1);
    }
  });

  it('collapses two active rows sharing a barcode and counts the duplicate', () => {
    const { homerooms, summary } = build([
      student({ barcode: '000100001', displayName: 'First Row' }),
      student({ barcode: '100001', displayName: 'Second Row' }),
    ]);
    expect(homerooms[0]!.candidates).toHaveLength(1);
    expect(summary.countsByReason.duplicateRoster).toBe(1);
  });

  it('never mixes blank-homeroom students into a real homeroom', () => {
    const { homerooms } = build([
      student({ barcode: '1', displayName: 'Assigned' }),
      student({ barcode: '2', displayName: 'Unassigned', homeroom: null }),
      student({ barcode: '3', displayName: 'Blank spaces', homeroom: '   ' }),
    ]);
    const real = homerooms.find((h) => h.name === 'Marigold, Rita')!;
    const none = homerooms.find((h) => h.name === NO_HOMEROOM)!;
    expect(names(real.candidates)).toEqual(['Assigned']);
    expect(names(none.candidates)).toEqual(['Blank spaces', 'Unassigned']);
  });

  it('excludes students who already won in the current round', () => {
    const win: WinRecord = {
      id: 'w1',
      homeroom: 'Marigold, Rita',
      round: 1,
      studentMatchKey: '2',
      studentName: 'Winner',
      drawnOn: '2026-02-20',
      monthKey: '2026-02',
      candidatePoolSize: 2,
    };
    const { homerooms } = build(
      [student({ barcode: '1', displayName: 'Waiting' }), student({ barcode: '2', displayName: 'Winner' })],
      [],
      [win],
    );
    const hr = homerooms[0]!;
    expect(names(hr.candidates)).toEqual(['Waiting']);
    expect(names(hr.alreadyWonThisRound)).toEqual(['Winner']);
    expect(hr.turnsTaken).toBe(1);
    expect(hr.turnsRemaining).toBe(1);
  });

  it('reports a homeroom where nobody can win, rather than dropping it', () => {
    const { homerooms } = build(
      [student({ barcode: '1', displayName: 'Late' })],
      [circ('1', { dueDate: PAST, dueDateRaw: '45782' })],
    );
    expect(homerooms).toHaveLength(1);
    expect(homerooms[0]!.candidates).toHaveLength(0);
  });

  it('produces the same result regardless of input row order', () => {
    const roster = [
      student({ barcode: '1', displayName: 'A' }),
      student({ barcode: '2', displayName: 'B', homeroom: 'Pennyworth, Alex' }),
      student({ barcode: '3', displayName: 'C' }),
    ];
    const circulation = [circ('3', { dueDate: PAST, dueDateRaw: '45782' })];
    const forward = build(roster, circulation);
    const reversed = build([...roster].reverse(), [...circulation].reverse());
    const shape = (r: ReturnType<typeof build>) =>
      r.homerooms.map((h) => [h.name, names(h.candidates)]);
    expect(shape(reversed)).toEqual(shape(forward));
  });
});
