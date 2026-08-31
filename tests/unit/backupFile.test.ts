import { describe, it, expect } from 'vitest';
import {
  BACKUP_VERSION,
  backupFileName,
  parseBackup,
  serializeBackup,
} from '../../src/storage/backupFile';
import { defaultSettings } from '../../src/storage/historyStore';
import type { HistoryState, WinRecord } from '../../src/domain/types';

const TODAY = '2026-03-05';

function win(over: Partial<WinRecord> = {}): WinRecord {
  return {
    id: 'w_0a3f91',
    homeroom: 'Marigold, Rita',
    round: 1,
    studentMatchKey: '100001',
    studentName: 'Doe, Jane A',
    drawnOn: '2026-09-04',
    monthKey: '2026-09',
    candidatePoolSize: 22,
    ...over,
  };
}

function state(over: Partial<HistoryState> = {}): HistoryState {
  return {
    wins: [win()],
    rounds: [{ homeroom: 'Marigold, Rita', currentRound: 1, startedOn: '2026-09-01' }],
    settings: { ...defaultSettings(), schoolYearLabel: '2026-2027' },
    ...over,
  };
}

describe('backup round trip', () => {
  it('exports and re-imports an identical history', () => {
    const original = state();
    const text = serializeBackup(original, TODAY);
    const result = parseBackup(text, TODAY, defaultSettings());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.history.wins).toEqual(original.wins);
    expect(result.history.rounds).toEqual(original.rounds);
    expect(result.history.settings.schoolYearLabel).toBe('2026-2027');
    expect(result.roundsRebuilt).toBe(false);
  });

  it('names the file after the school year', () => {
    expect(backupFileName('2026-2027')).toBe('library-reward-history-2026-2027.json');
    expect(backupFileName('2026/2027 (draft)')).toBe('library-reward-history-2026-2027-draft-.json');
  });
});

describe('backup validation', () => {
  it('refuses a newer file version rather than partially reading it', () => {
    const text = JSON.stringify({
      format: 'library-reward-history',
      version: BACKUP_VERSION + 1,
      schoolYearLabel: '2026-2027',
      exportedOn: TODAY,
      rounds: [],
      wins: [],
    });
    const result = parseBackup(text, TODAY, defaultSettings());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toMatch(/newer version/i);
  });

  it('refuses a file that is not a backup at all', () => {
    for (const text of ['', 'not json', '{}', '[]', JSON.stringify({ format: 'something-else' })]) {
      expect(parseBackup(text, TODAY, defaultSettings()).ok).toBe(false);
    }
  });

  it('refuses a damaged winners list and changes nothing', () => {
    const text = JSON.stringify({
      format: 'library-reward-history',
      version: 1,
      schoolYearLabel: '2026-2027',
      exportedOn: TODAY,
      rounds: [],
      wins: [{ id: 'w1', homeroom: 'Marigold, Rita' }], // missing required fields
    });
    const result = parseBackup(text, TODAY, defaultSettings());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toMatch(/nothing was changed/i);
  });
});

describe('round reconstruction', () => {
  it('rebuilds rounds when the file omits them', () => {
    const text = JSON.stringify({
      format: 'library-reward-history',
      version: 1,
      schoolYearLabel: '2026-2027',
      exportedOn: TODAY,
      wins: [win({ round: 3 })],
    });
    const result = parseBackup(text, TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roundsRebuilt).toBe(true);
    expect(result.history.rounds.find((r) => r.homeroom === 'Marigold, Rita')?.currentRound).toBe(3);
  });

  it('rebuilds rounds when they disagree with the wins they summarize', () => {
    const text = JSON.stringify({
      format: 'library-reward-history',
      version: 1,
      schoolYearLabel: '2026-2027',
      exportedOn: TODAY,
      rounds: [{ homeroom: 'Marigold, Rita', currentRound: 1, startedOn: '2026-09-01' }],
      wins: [win({ round: 4 })],
    });
    const result = parseBackup(text, TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roundsRebuilt).toBe(true);
    expect(result.history.rounds.find((r) => r.homeroom === 'Marigold, Rita')?.currentRound).toBe(4);
  });

  it('keeps consistent rounds as they are', () => {
    const original = state({
      wins: [win({ round: 2 })],
      rounds: [{ homeroom: 'Marigold, Rita', currentRound: 2, startedOn: '2026-11-14' }],
    });
    const result = parseBackup(serializeBackup(original, TODAY), TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roundsRebuilt).toBe(false);
    expect(result.history.rounds[0]!.startedOn).toBe('2026-11-14');
  });
});

describe('reading a backup from the weekly version of the app', () => {
  /** A v1 file: `weekKey` on every win, and no `monthKey`. */
  function v1(wins: Record<string, unknown>[]): string {
    return JSON.stringify({
      format: 'library-reward-history',
      version: 1,
      schoolYearLabel: '2026-2027',
      exportedOn: '2026-09-25',
      rounds: [{ homeroom: 'Marigold, Rita', currentRound: 1, startedOn: '2026-09-01' }],
      wins,
    });
  }

  function v1Win(over: Record<string, unknown> = {}): Record<string, unknown> {
    const { monthKey, ...rest } = win();
    expect(monthKey).toBeTypeOf('string'); // the field a v1 file is missing
    return { ...rest, weekKey: '2026-W36', ...over };
  }

  it('files each win under the month it was drawn in', () => {
    const result = parseBackup(v1([v1Win({ id: 'a', drawnOn: '2026-09-04' })]), TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.migratedFromWeekly).toBe(true);
    expect(result.history.wins[0]!.monthKey).toBe('2026-09');
    expect(result.history.wins[0]).not.toHaveProperty('weekKey');
  });

  it('keeps every weekly win, so turn-taking survives the upgrade', () => {
    // Four weekly drawings in one month. Under the new rule a month holds one
    // winner, but these turns were really taken — dropping any would put a
    // student back in a round they have already had.
    const wins = [
      v1Win({ id: 'a', studentMatchKey: '1', drawnOn: '2026-09-04', weekKey: '2026-W36' }),
      v1Win({ id: 'b', studentMatchKey: '2', drawnOn: '2026-09-11', weekKey: '2026-W37' }),
      v1Win({ id: 'c', studentMatchKey: '3', drawnOn: '2026-09-18', weekKey: '2026-W38' }),
      v1Win({ id: 'd', studentMatchKey: '4', drawnOn: '2026-10-02', weekKey: '2026-W40' }),
    ];
    const result = parseBackup(v1(wins), TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.history.wins).toHaveLength(4);
    expect(result.history.wins.map((w) => w.monthKey)).toEqual([
      '2026-09',
      '2026-09',
      '2026-09',
      '2026-10',
    ]);
    expect(new Set(result.history.wins.map((w) => w.studentMatchKey)).size).toBe(4);
  });

  it('does not claim a migration for a file that is already monthly', () => {
    const result = parseBackup(serializeBackup(state(), TODAY), TODAY, defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFromWeekly).toBe(false);
  });

  it('still refuses a win record with neither a month nor a week', () => {
    const noPeriod = v1Win();
    delete noPeriod.weekKey;
    const result = parseBackup(v1([noPeriod]), TODAY, defaultSettings());
    expect(result.ok).toBe(false);
  });
});
