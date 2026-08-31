/**
 * The winner-history backup file — the durable system of record.
 *
 * Browser storage is treated as a cache of this file: on a school Chromebook a
 * profile reset or a device swap can wipe localStorage, and losing the history
 * silently would mean losing a whole school year of turn-taking.
 *
 * See contracts/backup-file.md.
 */
import { rebuildRoundsFromWins } from '../domain/rounds';
import { hasPeriod, toMonthlyWin, type StoredWin } from './migrateWins';
import type { CalendarDate, HistoryState, RoundState, Settings, WinRecord } from '../domain/types';

export const BACKUP_FORMAT = 'library-reward-history';
/**
 * v1 recorded a `weekKey` per win, from when drawings were weekly. v2 records a
 * `monthKey`. A v1 file is still read: its wins are real turns that a class took,
 * and turn-taking is derived from round + student, not from the period key, so a
 * migrated file keeps whose-turn-it-is exactly right.
 */
export const BACKUP_VERSION = 2;

export interface BackupFile {
  format: string;
  version: number;
  schoolYearLabel: string;
  exportedOn: CalendarDate;
  rounds: RoundState[];
  wins: WinRecord[];
}

export type ImportOutcome =
  | { ok: true; history: HistoryState; roundsRebuilt: boolean; migratedFromWeekly: boolean }
  | { ok: false; problem: string };

export function backupFileName(schoolYearLabel: string): string {
  const safe = schoolYearLabel.replace(/[^\w-]+/g, '-');
  return `library-reward-history-${safe}.json`;
}

export function buildBackup(state: HistoryState, exportedOn: CalendarDate): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schoolYearLabel: state.settings.schoolYearLabel,
    exportedOn,
    rounds: state.rounds,
    wins: state.wins,
  };
}

export function serializeBackup(state: HistoryState, exportedOn: CalendarDate): string {
  return JSON.stringify(buildBackup(state, exportedOn), null, 2);
}

/** A win record from either format: v2 carries `monthKey`, v1 carried `weekKey`. */
function isWin(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.homeroom === 'string' &&
    typeof w.round === 'number' &&
    typeof w.studentMatchKey === 'string' &&
    typeof w.studentName === 'string' &&
    typeof w.drawnOn === 'string' &&
    hasPeriod(w as StoredWin)
  );
}

function isRound(value: unknown): value is RoundState {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.homeroom === 'string' && typeof r.currentRound === 'number';
}

/**
 * Parse and validate completely before committing anything. A file that fails
 * validation must change nothing — a half-applied history is worse than none.
 */
export function parseBackup(
  text: string,
  today: CalendarDate,
  currentSettings: Settings,
): ImportOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'That file is not readable as a backup file.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, problem: 'That file is not a Library Reward backup.' };
  }
  const file = raw as Record<string, unknown>;

  if (file.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      problem: 'That file is not a Library Reward backup (it is missing the expected marker).',
    };
  }

  const version = file.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, problem: 'That backup file does not say which version it is.' };
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      problem: `That backup was saved by a newer version of this app (file version ${version}, this app understands ${BACKUP_VERSION}). Use the newer version to open it.`,
    };
  }

  if (!Array.isArray(file.wins) || !file.wins.every(isWin)) {
    return { ok: false, problem: 'That backup file has a damaged list of winners; nothing was changed.' };
  }
  const converted = (file.wins as StoredWin[]).map(toMonthlyWin);
  const wins = converted.map((c) => c.win);
  const migratedFromWeekly = converted.some((c) => c.migrated);

  const rawRounds = Array.isArray(file.rounds) ? file.rounds : null;
  const roundsValid = rawRounds !== null && rawRounds.every(isRound);

  let rounds = roundsValid ? (rawRounds as RoundState[]) : [];
  let roundsRebuilt = !roundsValid;

  // A round that disagrees with the wins it is supposed to summarize cannot be trusted.
  if (!roundsRebuilt) {
    const derived = rebuildRoundsFromWins(wins, today);
    const inconsistent = derived.some((d) => {
      const stored = rounds.find((r) => r.homeroom === d.homeroom);
      return stored === undefined || stored.currentRound < d.currentRound;
    });
    if (inconsistent) {
      rounds = derived;
      roundsRebuilt = true;
    }
  } else {
    rounds = rebuildRoundsFromWins(wins, today);
  }

  const schoolYearLabel =
    typeof file.schoolYearLabel === 'string' && file.schoolYearLabel.trim() !== ''
      ? file.schoolYearLabel
      : currentSettings.schoolYearLabel;

  return {
    ok: true,
    roundsRebuilt,
    migratedFromWeekly,
    history: {
      wins,
      rounds,
      settings: { ...currentSettings, schoolYearLabel },
    },
  };
}
