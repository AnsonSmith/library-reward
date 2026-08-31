/**
 * Choosing the week's two files.
 *
 * Plain <input type="file"> and File.arrayBuffer() — the File System Access API is
 * not dependable on a file:// origin, which is how this runs on a Chromebook
 * (research R2). File problems are stated in words a librarian can act on (FR-005).
 */
import { useState } from 'react';
import { ingestWorkbooks } from '../../parsing/ingest';
import { todayLocal } from '../../parsing/excelDate';
import type { HistoryState } from '../../domain/types';
import type { WeekSession } from '../../app/session';

interface Props {
  history: HistoryState;
  session: WeekSession | null;
  onLoaded: (session: WeekSession) => void;
  onShowQuality: () => void;
  onContinue: () => void;
}

interface Picked {
  name: string;
  bytes: Uint8Array;
}

export function ImportScreen({ history, session, onLoaded, onShowQuality, onContinue }: Props) {
  const [fileA, setFileA] = useState<Picked | null>(null);
  const [fileB, setFileB] = useState<Picked | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapped, setSwapped] = useState(false);

  const pick = (which: 'a' | 'b') => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProblem(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const picked = { name: file.name, bytes };
    if (which === 'a') setFileA(picked);
    else setFileB(picked);
  };

  const load = (): void => {
    if (!fileA || !fileB) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = ingestWorkbooks({
        fileA: { fileName: fileA.name, bytes: fileA.bytes },
        fileB: { fileName: fileB.name, bytes: fileB.bytes },
        history: history.wins,
        rounds: history.rounds,
        today: todayLocal(),
      });

      if (!result.ok) {
        setProblem(result.problem);
        return;
      }

      setSwapped(result.swapped);
      onLoaded({
        roster: result.roster,
        circulation: result.circulation,
        rosterFileName: result.summary.rosterFileName,
        circulationFileName: result.summary.circulationFileName,
        today: todayLocal(),
        swapped: result.swapped,
        homerooms: result.homerooms,
        summary: result.summary,
      });
    } catch (err) {
      setProblem(
        err instanceof Error
          ? `Something went wrong reading those files: ${err.message}`
          : 'Something went wrong reading those files.',
      );
    } finally {
      setBusy(false);
    }
  };

  const summary = session?.summary;

  return (
    <div className="stack">
      <div>
        <h2>This week's two files</h2>
        <p className="lede">
          Choose the two spreadsheets you exported from the library system. It does not matter which
          order you pick them in, and nothing you choose leaves this Chromebook.
        </p>
      </div>

      <div className="row">
        <label className="filepick">
          <strong>First file</strong>
          <span className="hint">The student roster, or the circulation report</span>
          <input type="file" accept=".xlsx" onChange={pick('a')} />
          {fileA && <span className="chosen">{fileA.name}</span>}
        </label>

        <label className="filepick">
          <strong>Second file</strong>
          <span className="hint">Whichever one you haven't picked yet</span>
          <input type="file" accept=".xlsx" onChange={pick('b')} />
          {fileB && <span className="chosen">{fileB.name}</span>}
        </label>
      </div>

      <div className="row">
        <button className="primary big" onClick={load} disabled={!fileA || !fileB || busy}>
          {busy ? 'Reading…' : 'Read these files'}
        </button>
      </div>

      {problem && (
        <div className="notice problem" role="alert">
          <h3>That didn't work</h3>
          <p>{problem}</p>
        </div>
      )}

      {summary && (
        <div className="stack">
          {swapped && (
            <div className="notice">
              Those two were the other way round, so they have been swapped for you.
            </div>
          )}

          <div className="card stack">
            <h3 style={{ margin: 0 }}>Here's what was read</h3>
            <ul className="counts">
              <li>
                <span className="n">{summary.activeStudents}</span>
                <span className="k">active students</span>
              </li>
              <li>
                <span className="n">{summary.homeroomCount}</span>
                <span className="k">homerooms</span>
              </li>
              <li>
                <span className="n">{summary.circulationRowsRead}</span>
                <span className="k">circulation rows</span>
              </li>
              <li>
                <span className="n">{summary.overdueRowsFound}</span>
                <span className="k">overdue items</span>
              </li>
            </ul>

            <p className="small muted" style={{ margin: 0 }}>
              Roster: <strong>{summary.rosterFileName}</strong> · Circulation:{' '}
              <strong>{summary.circulationFileName}</strong>
            </p>

            {summary.overdueRowsFound === 0 && (
              <div className="notice">
                <h3>No overdue items in this report</h3>
                <p>
                  Nobody is being kept out of the drawing this week. That's good news if everyone has
                  returned their books — but if that seems unlikely, the circulation report may have
                  been exported without checked-out items and their due dates.
                </p>
              </div>
            )}

            <div className="row">
              <button className="primary" onClick={onContinue}>
                See the homerooms
              </button>
              <button className="secondary" onClick={onShowQuality}>
                What was set aside?
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
