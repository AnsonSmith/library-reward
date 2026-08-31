import { describe, it, expect } from 'vitest';
import { determineOverdue } from '../../src/domain/eligibility';
import type { CirculationRow } from '../../src/domain/types';

function row(over: Partial<CirculationRow> = {}): CirculationRow {
  return {
    displayName: 'Doe, Jane',
    barcode: '000100001',
    matchKey: '100001',
    transactionType: 'Unpaid Fines & Refunds',
    dueDate: null,
    dueDateRaw: '',
    itemTitle: null,
    fineReason: null,
    sourceRow: 2,
    ...over,
  };
}

const TODAY = '2026-03-05';

describe('determineOverdue', () => {
  it('treats a past due date as overdue', () => {
    expect(determineOverdue(row({ dueDate: '2026-03-04', dueDateRaw: '45786' }), TODAY)).toBe(
      'overdue',
    );
  });

  it('treats an item due today as not yet overdue', () => {
    // FR-010: a book due at 3pm must not disqualify a child at a 9am drawing.
    expect(determineOverdue(row({ dueDate: TODAY, dueDateRaw: '45787' }), TODAY)).toBe('notOverdue');
  });

  it('treats a future due date as not overdue', () => {
    expect(determineOverdue(row({ dueDate: '2026-03-20', dueDateRaw: '45801' }), TODAY)).toBe(
      'notOverdue',
    );
  });

  it('treats a blank due date as not overdue', () => {
    // Every Due cell in the reference circulation export is blank.
    expect(determineOverdue(row({ dueDate: null, dueDateRaw: '' }), TODAY)).toBe('notOverdue');
  });

  it('does not disqualify a student for a fine, a lost book, or a refund alone', () => {
    // FR-009, the clarified rule: only genuinely overdue items disqualify.
    const fine = row({ transactionType: 'Unpaid Fines & Refunds', fineReason: 'Lost LM' });
    const refund = row({ transactionType: 'Unpaid Fines & Refunds', fineReason: 'Refund LM' });
    expect(determineOverdue(fine, TODAY)).toBe('notOverdue');
    expect(determineOverdue(refund, TODAY)).toBe('notOverdue');
  });

  it('flags a checkout row whose due date cannot be read', () => {
    // FR-011: never quietly turn a possibly-overdue student into a candidate.
    expect(determineOverdue(row({ dueDate: null, dueDateRaw: '##########' }), TODAY)).toBe(
      'undeterminable',
    );
  });

  it('flags a row that claims to be a checkout but carries no due date', () => {
    expect(
      determineOverdue(row({ transactionType: 'Overdue', dueDate: null, dueDateRaw: '' }), TODAY),
    ).toBe('undeterminable');
    expect(
      determineOverdue(
        row({ transactionType: 'Checked Out', dueDate: null, dueDateRaw: '' }),
        TODAY,
      ),
    ).toBe('undeterminable');
  });
});
