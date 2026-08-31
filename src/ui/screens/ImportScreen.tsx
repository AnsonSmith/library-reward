/**
 * Choosing the month's files: one roster, and every weekly circulation report the
 * month produced.
 *
 * Files accumulate across several trips to the file picker rather than replacing
 * each other — a month's reports are often saved in different folders, and a
 * picker that forgot the previous pick would make that a chore. Which file is
 * which is worked out from its headers, so selection order carries no meaning.
 *
 * Plain <input type="file"> and File.arrayBuffer() — the File System Access API is
 * not dependable on a file:// origin, which is how this runs on a Chromebook
 * (research R2). File problems are stated in words a librarian can act on (FR-005).
 */
import { useRef, useState } from 'react';
import { ingestWorkbooks, type RecognizedFile } from '../../parsing/ingest';
import { todayLocal } from '../../parsing/excelDate';
import { monthLabelFor, monthKeyFor } from '../../domain/monthKey';
import type { HistoryState } from '../../domain/types';
import type { DrawingSession } from '../../app/session';

interface Props {
  history: HistoryState;
  session: DrawingSession | null;
  onLoaded: (session: DrawingSession) => void;
  onShowQuality: () => void;
  onContinue: () => void;
}

export interface Picked {
  name: string;
  size: number;
  bytes: Uint8Array;
}

/**
 * Add a fresh pick to what is already chosen, ignoring anything already there.
 *
 * The same report added twice would double every count on the summary screen
 * without changing who can win, which reads as a bug either way. Name and size
 * together are the identity: two exports genuinely from different weeks differ in
 * one or the other, and re-picking the same file from the same folder does not.
 */
export function mergePicked(current: Picked[], incoming: Picked[]): Picked[] {
  const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
  const added: Picked[] = [];
  for (const file of incoming) {
    const id = `${file.name}:${file.size}`;
    if (seen.has(id)) continue;
    seen.add(id);
    added.push(file);
  }
  return added.length === 0 ? current : [...current, ...added];
}

export function ImportScreen({ history, session, onLoaded, onShowQuality, onContinue }: Props) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedFile[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const monthLabel = monthLabelFor(monthKeyFor(todayLocal()));

  const add = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const chosen = [...(event.target.files ?? [])];
    // Clear the input straight away, so picking the same file again still fires.
    if (inputRef.current) inputRef.current.value = '';
    if (chosen.length === 0) return;
    setProblem(null);

    const loaded: Picked[] = await Promise.all(
      chosen.map(async (file) => ({
        name: file.name,
        size: file.size,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );

    setPicked((current) => mergePicked(current, loaded));
  };

  const remove = (name: string, size: number): void => {
    setPicked((current) => current.filter((f) => !(f.name === name && f.size === size)));
    setProblem(null);
  };

  const load = (): void => {
    if (picked.length < 2) return;
    setBusy(true);
    setProblem(null);
    try {
      const today = todayLocal();
      const result = ingestWorkbooks({
        files: picked.map((f) => ({ fileName: f.name, bytes: f.bytes })),
        history: history.wins,
        rounds: history.rounds,
        today,
      });

      if (!result.ok) {
        setProblem(result.problem);
        setRecognized(null);
        return;
      }

      setRecognized(result.recognized);
      onLoaded({
        roster: result.roster,
        circulation: result.circulation,
        rosterFileName: result.summary.rosterFileName,
        circulationFileNames: result.circulationFileNames,
        today,
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
  const emptyReports = summary?.circulationFiles.filter((f) => f.rowsRead === 0) ?? [];

  return (
    <div className="stack">
      <div>
        <h2>This month's files</h2>
        <p className="lede">
          Choose the student roster, plus every weekly circulation report from{' '}
          {monthLabel}. A student with an overdue book in <strong>any</strong> of those
          reports sits out this month's drawing. It does not matter which order you pick
          them in, and nothing you choose leaves this Chromebook.
        </p>
      </div>

      <label className="filepick">
        <strong>Add files</strong>
        <span className="hint">
          The roster, and one report per week. You can add them a few at a time.
        </span>
        <input ref={inputRef} type="file" accept=".xlsx" multiple onChange={add} />
      </label>

      {picked.length > 0 && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>
            {picked.length} file{picked.length === 1 ? '' : 's'} chosen
          </h3>
          <ul className="namelist small">
            {picked.map((file) => (
              <li key={`${file.name}:${file.size}`}>
                <span className="row" style={{ gap: '0.5rem' }}>
                  <span>{file.name}</span>
                  <button
                    className="ghost small"
                    onClick={() => remove(file.name, file.size)}
                    aria-label={`Remove ${file.name}`}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="row">
        <button className="primary big" onClick={load} disabled={picked.length < 2 || busy}>
          {busy ? 'Reading…' : 'Read these files'}
        </button>
        {picked.length === 1 && (
          <span className="muted small">
            One more to go — a roster on its own cannot tell us who has an overdue book.
          </span>
        )}
      </div>

      {problem && (
        <div className="notice problem" role="alert">
          <h3>That didn't work</h3>
          <p>{problem}</p>
        </div>
      )}

      {summary && (
        <div className="stack">
          {recognized && (
            <div className="notice">
              <h3>What each file turned out to be</h3>
              <ul className="namelist small">
                {recognized.map((file) => (
                  <li key={file.fileName}>
                    {file.fileName} — {file.role === 'roster' ? 'student roster' : 'circulation report'}
                  </li>
                ))}
              </ul>
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
                <span className="n">{summary.circulationFiles.length}</span>
                <span className="k">circulation reports</span>
              </li>
              <li>
                <span className="n">{summary.overdueRowsFound}</span>
                <span className="k">overdue items</span>
              </li>
              <li>
                <span className="n">{summary.studentsBlockedByOverdue}</span>
                <span className="k">students sitting out</span>
              </li>
            </ul>

            <p className="small muted" style={{ margin: 0 }}>
              Roster: <strong>{summary.rosterFileName}</strong>
            </p>

            <table>
              <thead>
                <tr>
                  <th>Circulation report</th>
                  <th>Rows</th>
                  <th>Overdue</th>
                  <th>Students it caught first</th>
                </tr>
              </thead>
              <tbody>
                {summary.circulationFiles.map((file) => (
                  <tr key={file.fileName}>
                    <td className="small">{file.fileName}</td>
                    <td className="small">{file.rowsRead}</td>
                    <td className="small">{file.overdueRowsFound}</td>
                    <td className="small">{file.studentsFirstBlockedHere}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ margin: 0 }}>
              A student caught by an earlier report is only counted once, so the last column
              adds up to the {summary.studentsBlockedByOverdue} sitting out.
            </p>

            {emptyReports.length > 0 && (
              <div className="notice problem">
                <h3>
                  {emptyReports.length === 1
                    ? 'One report had no rows in it'
                    : `${emptyReports.length} reports had no rows in them`}
                </h3>
                <p>
                  {emptyReports.map((f) => f.fileName).join(', ')} had a header row and nothing
                  else. If that week really had no circulation activity this is fine — otherwise
                  the export may have gone wrong, and that week's overdue books are not being
                  counted.
                </p>
              </div>
            )}

            {summary.overdueRowsFound === 0 && (
              <div className="notice">
                <h3>No overdue items in any of these reports</h3>
                <p>
                  Nobody is being kept out of this month's drawing. That's good news if everyone
                  has returned their books — but if that seems unlikely across{' '}
                  {summary.circulationFiles.length} report
                  {summary.circulationFiles.length === 1 ? '' : 's'}, they may have been exported
                  without checked-out items and their due dates.
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
