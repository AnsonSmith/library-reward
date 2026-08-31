/**
 * The backup file, and repairs.
 *
 * The backup is not a nicety: on a school Chromebook the browser's copy can be
 * wiped by a profile reset or a device swap, and it holds a whole school year of
 * whose-turn-it-is (research R2, contracts/backup-file.md).
 */
import { useRef, useState } from 'react';
import { monthLabelFor } from '../../domain/monthKey';
import type { HistoryState, StorageHealthView } from '../../app/appTypes';

interface Props {
  history: HistoryState;
  storage: StorageHealthView;
  onExportBackup: () => void;
  onImportBackup: (text: string) => void;
  onRemoveWin: (winId: string) => void;
  onClearYear: () => void;
  onClearHomeroom: (homeroom: string) => void;
  onClearEverything: () => void;
  onToggleReduceMotion: (value: boolean) => void;
  onSetSchoolYear: (label: string) => void;
}

export function SettingsScreen(props: Props) {
  const { history, storage } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirming, setConfirming] = useState<'year' | 'all' | null>(null);
  const [homeroomToClear, setHomeroomToClear] = useState('');

  const homerooms = [...new Set(history.wins.map((w) => w.homeroom))].sort();

  const readFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    props.onImportBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack">
      <div>
        <h2>Backup &amp; settings</h2>
        <p className="lede">
          School year {history.settings.schoolYearLabel} · {history.wins.length} winners recorded
        </p>
      </div>

      {!storage.available && (
        <div className="notice problem">
          <h3>This browser is not remembering anything</h3>
          <p>{storage.reason}</p>
          <p>
            Save the backup file at the end of every session and load it again at the start, or your
            turn-taking will start over each month.
          </p>
        </div>
      )}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>The backup file</h3>
        <p className="small muted" style={{ margin: 0 }}>
          This file is what remembers whose turn it is. Save it to your Google Drive folder — the
          copy inside the browser can be wiped when a Chromebook is reset.
          {history.settings.lastBackupExportedOn
            ? ` Last saved ${history.settings.lastBackupExportedOn}.`
            : ' It has not been saved yet.'}
        </p>
        <div className="row">
          <button className="primary" onClick={props.onExportBackup}>
            Save backup file
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            Load a backup file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={readFile}
            style={{ display: 'none' }}
          />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          It holds student names and barcodes, so keep it somewhere only staff can see.
        </p>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>School year</h3>
        <div className="row">
          <input
            type="text"
            value={history.settings.schoolYearLabel}
            onChange={(e) => props.onSetSchoolYear(e.target.value)}
            aria-label="School year label"
            style={{ font: 'inherit', padding: '0.5rem', borderRadius: 8 }}
          />
          <label className="row" style={{ gap: '0.4rem' }}>
            <input
              type="checkbox"
              checked={history.settings.reduceMotion}
              onChange={(e) => props.onToggleReduceMotion(e.target.checked)}
            />
            Shorter animations
          </label>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Start over</h3>

        {confirming === 'year' ? (
          <div className="notice problem">
            <p>
              Clear all {history.wins.length} recorded winners and start every homeroom fresh? The
              backup file you have already saved is not affected.
            </p>
            <div className="row">
              <button
                className="danger"
                onClick={() => {
                  props.onClearYear();
                  setConfirming(null);
                }}
              >
                Yes, start a new school year
              </button>
              <button className="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="danger" onClick={() => setConfirming('year')}>
              Start a new school year
            </button>
          </div>
        )}

        {homerooms.length > 0 && (
          <div className="row">
            <select
              value={homeroomToClear}
              onChange={(e) => setHomeroomToClear(e.target.value)}
              aria-label="Homeroom to reset"
              style={{ font: 'inherit', padding: '0.5rem', borderRadius: 8 }}
            >
              <option value="">Reset one homeroom…</option>
              {homerooms.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <button
              className="danger"
              disabled={!homeroomToClear}
              onClick={() => {
                props.onClearHomeroom(homeroomToClear);
                setHomeroomToClear('');
              }}
            >
              Reset turns for this homeroom
            </button>
          </div>
        )}

        {confirming === 'all' ? (
          <div className="notice problem">
            <p>Remove every winner and every loaded file from this Chromebook?</p>
            <div className="row">
              <button
                className="danger"
                onClick={() => {
                  props.onClearEverything();
                  setConfirming(null);
                }}
              >
                Yes, erase everything
              </button>
              <button className="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="ghost" onClick={() => setConfirming('all')}>
              Erase all data from this Chromebook
            </button>
          </div>
        )}
      </div>

      {history.wins.length > 0 && (
        <details className="card">
          <summary>
            <strong>All recorded winners</strong> — {history.wins.length}
          </summary>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Homeroom</th>
                <th>Winner</th>
                <th>Round</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...history.wins]
                .sort((a, b) => b.drawnOn.localeCompare(a.drawnOn))
                .map((win) => (
                  <tr key={win.id}>
                    <td className="small">{monthLabelFor(win.monthKey)}</td>
                    <td>{win.homeroom}</td>
                    <td>{win.studentName}</td>
                    <td className="small">{win.round}</td>
                    <td>
                      <button className="ghost small" onClick={() => props.onRemoveWin(win.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
