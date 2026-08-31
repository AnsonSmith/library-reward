/**
 * Screen routing and the one place session state and persistent history meet.
 *
 * Ordering rule that matters: every draw appends to history, then homerooms are
 * re-derived from that history, then rounds advance. Doing it in that order is
 * what keeps candidate lists, turn counters, and round resets in step without any
 * duplicated state to reconcile.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { weekKeyFor } from '../domain/weekKey';
import { todayLocal } from '../parsing/excelDate';
import type { HistoryState, Homeroom, RosterEntry, WinRecord } from '../domain/types';
import {
  clearHistory,
  emptyHistory,
  loadHistory,
  probeStorage,
  saveHistory,
} from '../storage/historyStore';
import { backupFileName, parseBackup, serializeBackup } from '../storage/backupFile';
import {
  rederive,
  recordWin,
  removeWin,
  winForHomeroomThisWeek,
  winsForWeek,
  type WeekSession,
} from './session';
import { ImportScreen } from '../ui/screens/ImportScreen';
import { HomeroomListScreen } from '../ui/screens/HomeroomListScreen';
import { DrawScreen } from '../ui/screens/DrawScreen';
import { WinnersScreen } from '../ui/screens/WinnersScreen';
import { DataQualityScreen } from '../ui/screens/DataQualityScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import type { StorageHealthView } from './appTypes';

type Screen = 'import' | 'homerooms' | 'draw' | 'winners' | 'quality' | 'settings';

/** Hand the user a file. Anchor download works under file://; showSaveFilePicker does not. */
function downloadFile(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some builds; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function App() {
  const [history, setHistory] = useState<HistoryState>(() => loadHistory());
  const [session, setSession] = useState<WeekSession | null>(null);
  const [screen, setScreen] = useState<Screen>('import');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'good' | 'problem'; text: string } | null>(null);
  const [storage, setStorage] = useState<StorageHealthView>({ available: true, reason: '' });

  // Ask once, at startup, whether this device remembers anything at all.
  useEffect(() => {
    const health = probeStorage();
    setStorage(
      health.available ? { available: true, reason: '' } : { available: false, reason: health.reason },
    );
  }, []);

  const persist = useCallback((next: HistoryState) => {
    setHistory(next);
    const health = saveHistory(next);
    if (!health.available) {
      setStorage({ available: false, reason: health.reason });
    }
  }, []);

  const weekKey = useMemo(() => weekKeyFor(session?.today ?? todayLocal()), [session]);

  // Honour the device setting as well as the app's own, so a Chromebook configured
  // for reduced motion gets the shorter build-up without anyone changing a setting.
  const systemReducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const reducedMotion = history.settings.reduceMotion || systemReducedMotion;

  const homerooms = session?.homerooms ?? [];
  const selectedHomeroom: Homeroom | null =
    homerooms.find((h) => h.name === selected) ?? null;

  const handleLoaded = (loaded: WeekSession): void => {
    setSession(loaded);
    setMessage(null);
  };

  const handleDraw = (homeroom: Homeroom): void => {
    setSelected(homeroom.name);
    setScreen('draw');
  };

  const handleRecord = (winner: RosterEntry, replacing: WinRecord | null): void => {
    if (!session || !selectedHomeroom) return;
    const result = recordWin({
      history,
      session,
      homeroom: selectedHomeroom,
      winner,
      replacing,
    });
    persist(result.history);
    setSession(result.session);
  };

  const handleRemoveWin = (winId: string): void => {
    const result = removeWin(history, session, winId);
    persist(result.history);
    setSession(result.session);
    setMessage({ kind: 'good', text: 'That winner was removed and is waiting for a turn again.' });
  };

  const exportBackup = (): void => {
    const today = todayLocal();
    const next: HistoryState = {
      ...history,
      settings: { ...history.settings, lastBackupExportedOn: today },
    };
    downloadFile(
      backupFileName(history.settings.schoolYearLabel),
      serializeBackup(next, today),
      'application/json',
    );
    persist(next);
    setMessage({
      kind: 'good',
      text: 'Backup saved to your Downloads folder. Move it into Google Drive to keep it safe.',
    });
  };

  const importBackup = (text: string): void => {
    const result = parseBackup(text, todayLocal(), history.settings);
    if (!result.ok) {
      setMessage({ kind: 'problem', text: result.problem });
      return;
    }
    const incoming = result.history;
    const confirmed = window.confirm(
      `That file holds ${incoming.wins.length} recorded winners. ` +
        `This Chromebook currently has ${history.wins.length}. ` +
        `Loading it will replace what is here. Continue?`,
    );
    if (!confirmed) return;

    persist(incoming);
    setSession(session ? rederive(session, incoming) : null);
    setMessage({
      kind: 'good',
      text: result.roundsRebuilt
        ? 'Backup loaded. Round numbers were rebuilt from the list of winners.'
        : 'Backup loaded.',
    });
  };

  const exportWinnersCsv = (): void => {
    const rows = winsForWeek(history, weekKey).sort((a, b) => a.homeroom.localeCompare(b.homeroom));
    const csv = [
      ['Homeroom', 'Winner', 'Date drawn', 'Week'].join(','),
      ...rows.map((w) =>
        [w.homeroom, w.studentName, w.drawnOn, w.weekKey].map(csvCell).join(','),
      ),
    ].join('\n');
    downloadFile(`library-reward-winners-${weekKey}.csv`, csv, 'text/csv');
  };

  const clearYear = (): void => {
    const next: HistoryState = { ...history, wins: [], rounds: [] };
    persist(next);
    setSession(session ? rederive(session, next) : null);
    setMessage({ kind: 'good', text: 'Every homeroom is starting fresh.' });
  };

  const clearHomeroom = (homeroom: string): void => {
    const next: HistoryState = {
      ...history,
      wins: history.wins.filter((w) => w.homeroom !== homeroom),
      rounds: history.rounds.filter((r) => r.homeroom !== homeroom),
    };
    persist(next);
    setSession(session ? rederive(session, next) : null);
    setMessage({ kind: 'good', text: `${homeroom} is starting fresh.` });
  };

  const clearEverything = (): void => {
    clearHistory();
    setHistory(emptyHistory());
    setSession(null);
    setSelected(null);
    setScreen('import');
    setMessage({ kind: 'good', text: 'Everything has been erased from this Chromebook.' });
  };

  const drawnThisWeek = winsForWeek(history, weekKey).length;

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span aria-hidden="true">📚</span> Library Reward
        </h1>
        <nav className="nav">
          <button aria-current={screen === 'import'} onClick={() => setScreen('import')}>
            Files
          </button>
          <button
            aria-current={screen === 'homerooms'}
            onClick={() => setScreen('homerooms')}
            disabled={!session}
          >
            Homerooms
          </button>
          <button
            aria-current={screen === 'winners'}
            onClick={() => setScreen('winners')}
            disabled={!session && history.wins.length === 0}
          >
            Winners{drawnThisWeek > 0 ? ` (${drawnThisWeek})` : ''}
          </button>
          <button
            aria-current={screen === 'quality'}
            onClick={() => setScreen('quality')}
            disabled={!session}
          >
            Set aside
          </button>
          <button aria-current={screen === 'settings'} onClick={() => setScreen('settings')}>
            Backup
          </button>
        </nav>
      </header>

      <main>
        {message && (
          <div className={`notice ${message.kind} no-print`} style={{ marginBottom: '1rem' }}>
            <div className="row">
              <span>{message.text}</span>
              <button className="ghost small" onClick={() => setMessage(null)} style={{ marginLeft: 'auto' }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!storage.available && screen !== 'settings' && (
          <div className="notice problem no-print" style={{ marginBottom: '1rem' }}>
            This Chromebook is not saving anything between sessions. Use the backup file on the
            Backup screen, or the turn-taking will reset each week.
          </div>
        )}

        {screen === 'import' && (
          <ImportScreen
            history={history}
            session={session}
            onLoaded={handleLoaded}
            onShowQuality={() => setScreen('quality')}
            onContinue={() => setScreen('homerooms')}
          />
        )}

        {screen === 'homerooms' && session && (
          <HomeroomListScreen
            homerooms={homerooms}
            history={history}
            weekKey={weekKey}
            onDraw={handleDraw}
          />
        )}

        {screen === 'draw' && selectedHomeroom && (
          <DrawScreen
            homeroom={selectedHomeroom}
            existingWin={winForHomeroomThisWeek(history, selectedHomeroom.name, weekKey)}
            reduced={reducedMotion}
            onRecord={handleRecord}
            onBack={() => setScreen('homerooms')}
          />
        )}

        {screen === 'winners' && (
          <WinnersScreen
            history={history}
            homerooms={homerooms}
            weekKey={weekKey}
            onExport={exportWinnersCsv}
            onRemoveWin={handleRemoveWin}
          />
        )}

        {screen === 'quality' && session && <DataQualityScreen summary={session.summary} />}

        {screen === 'settings' && (
          <SettingsScreen
            history={history}
            storage={storage}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
            onRemoveWin={handleRemoveWin}
            onClearYear={clearYear}
            onClearHomeroom={clearHomeroom}
            onClearEverything={clearEverything}
            onToggleReduceMotion={(value) =>
              persist({ ...history, settings: { ...history.settings, reduceMotion: value } })
            }
            onSetSchoolYear={(label) =>
              persist({ ...history, settings: { ...history.settings, schoolYearLabel: label } })
            }
          />
        )}
      </main>
    </div>
  );
}
