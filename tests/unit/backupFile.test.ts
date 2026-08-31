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
    weekKey: '2026-W36',
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
