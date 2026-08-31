/**
 * Persistent history in localStorage.
 *
 * IndexedDB is deliberately unused: Chrome denies it on file:// origins, which is
 * exactly how this app is opened on a Chromebook (research R2). Storage is probed
 * at startup so a device that refuses to remember anything says so plainly rather
 * than silently starting a fresh school year every week.
 */
import type { HistoryState, Settings } from '../domain/types';

const KEY = 'library-reward:history:v1';

export type StorageHealth =
  | { available: true }
  | { available: false; reason: string };

export function defaultSettings(): Settings {
  const now = new Date();
  // A school year runs Aug–Jul, so before August we are still in the year that started last calendar year.
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    schoolYearLabel: `${startYear}-${startYear + 1}`,
    lastBackupExportedOn: null,
    reduceMotion: false,
  };
}

export function emptyHistory(): HistoryState {
  return { wins: [], rounds: [], settings: defaultSettings() };
}

/** Can this device actually remember anything between sessions? */
export function probeStorage(): StorageHealth {
  try {
    const probeKey = `${KEY}:probe`;
    localStorage.setItem(probeKey, '1');
    const readBack = localStorage.getItem(probeKey);
    localStorage.removeItem(probeKey);
    if (readBack !== '1') {
      return { available: false, reason: 'This browser accepted the data but did not store it.' };
    }
    return { available: true };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : 'Storage is blocked in this browser.',
    };
  }
}

export function loadHistory(): HistoryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw) as Partial<HistoryState>;
    return {
      wins: Array.isArray(parsed.wins) ? parsed.wins : [],
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
    };
  } catch {
    // A corrupt cache must not block the app; the backup file is the real record.
    return emptyHistory();
  }
}

export function saveHistory(state: HistoryState): StorageHealth {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return { available: true };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : 'This browser refused to save.',
    };
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do — there was nothing stored.
  }
}
