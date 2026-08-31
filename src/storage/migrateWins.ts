/**
 * Reading winner records written by the weekly version of this app.
 *
 * Those records carry a `weekKey` and no `monthKey`. Both places a history can
 * come from — the browser's cache and the backup file — have to cope with them,
 * so the rule lives here once rather than twice.
 *
 * Nothing is discarded. A weekly win is a turn a child really took, and
 * turn-taking is derived from round + student rather than from the period key,
 * so keeping every record is what makes an upgrade invisible to a class. It does
 * mean a migrated month can show more than one winner; that is history, and the
 * one-winner-per-month rule applies to new drawings.
 */
import { monthKeyFor } from '../domain/monthKey';
import type { WinRecord } from '../domain/types';

/** A win as it may appear on disk: either format, or something malformed. */
export type StoredWin = Partial<WinRecord> & { weekKey?: string };

export function hasPeriod(win: StoredWin): boolean {
  return typeof win.monthKey === 'string' || typeof win.weekKey === 'string';
}

/**
 * Give a win a monthKey and drop the weekKey. A v1 win's month comes from the
 * date it was drawn, which is exact — its weekKey was only ever derived from
 * that same date.
 */
export function toMonthlyWin(stored: StoredWin): { win: WinRecord; migrated: boolean } {
  const drawnOn = stored.drawnOn ?? '';
  const migrated = typeof stored.monthKey !== 'string';
  return {
    migrated,
    // Rebuilt field by field rather than spread, so `weekKey` cannot ride along.
    win: {
      id: stored.id ?? '',
      homeroom: stored.homeroom ?? '',
      round: stored.round ?? 1,
      studentMatchKey: stored.studentMatchKey ?? '',
      studentName: stored.studentName ?? '',
      drawnOn,
      monthKey: stored.monthKey ?? monthKeyFor(drawnOn),
      candidatePoolSize: stored.candidatePoolSize ?? 0,
    },
  };
}
