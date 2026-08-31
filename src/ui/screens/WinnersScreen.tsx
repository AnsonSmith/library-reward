/** This month's winners, ready to print or hand to teachers (FR-033, FR-036). */
import type { HistoryState, Homeroom } from '../../domain/types';
import { winsForMonth } from '../../app/session';
import { monthLabelFor } from '../../domain/monthKey';

interface Props {
  history: HistoryState;
  homerooms: Homeroom[];
  monthKey: string;
  onExport: () => void;
  onRemoveWin: (winId: string) => void;
}

export function WinnersScreen({ history, homerooms, monthKey, onExport, onRemoveWin }: Props) {
  const wins = winsForMonth(history, monthKey).sort((a, b) => a.homeroom.localeCompare(b.homeroom));
  const drawnNames = new Set(wins.map((w) => w.homeroom));
  const pending = homerooms.filter((h) => !drawnNames.has(h.name));

  return (
    <div className="stack">
      <div>
        <h2>This month's winners</h2>
        <p className="lede">
          {wins.length} drawn · {pending.length} still to go ({monthLabelFor(monthKey)})
        </p>
      </div>

      <div className="row no-print">
        <button className="primary" onClick={() => window.print()} disabled={wins.length === 0}>
          Print this list
        </button>
        <button className="secondary" onClick={onExport} disabled={wins.length === 0}>
          Save as a spreadsheet file
        </button>
      </div>

      {wins.length === 0 ? (
        <div className="notice">No drawings yet this month.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Homeroom</th>
                <th>Winner</th>
                <th>Drawn</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {wins.map((win) => (
                <tr key={win.id}>
                  <td>{win.homeroom}</td>
                  <td>
                    <strong>{win.studentName}</strong>
                  </td>
                  <td className="muted small">{win.drawnOn}</td>
                  <td className="no-print">
                    <button
                      className="ghost small"
                      onClick={() => onRemoveWin(win.id)}
                      title="Remove this winner and put them back in the pool"
                    >
                      Undo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending.length > 0 && (
        <details className="card no-print">
          <summary>{pending.length} homerooms not drawn yet</summary>
          <ul className="namelist small">
            {pending.map((h) => (
              <li key={h.name}>
                {h.name}
                {h.candidates.length === 0 ? ' — nobody can win this month' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
