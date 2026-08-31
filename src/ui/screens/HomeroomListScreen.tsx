/**
 * Every homeroom, its candidate count, and where the librarian is up to.
 *
 * A homeroom where nobody can win is shown and labelled, never dropped — a class
 * quietly missing from this list is the failure she would not notice (FR-030).
 */
import { useState } from 'react';
import { NO_HOMEROOM, type Homeroom, type HistoryState } from '../../domain/types';
import { RoundMeter } from '../components/RoundMeter';
import { winForHomeroomThisMonth } from '../../app/session';
import { monthLabelFor } from '../../domain/monthKey';

interface Props {
  homerooms: Homeroom[];
  history: HistoryState;
  monthKey: string;
  onDraw: (homeroom: Homeroom) => void;
}

export function HomeroomListScreen({ homerooms, history, monthKey, onDraw }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const drawn = homerooms.filter((h) => winForHomeroomThisMonth(history, h.name, monthKey)).length;
  const drawable = homerooms.filter((h) => h.candidates.length > 0).length;

  return (
    <div className="stack">
      <div>
        <h2>Homerooms</h2>
        <p className="lede">
          {monthLabelFor(monthKey)} · {drawn} of {homerooms.length} drawn · {drawable} ready to
          draw. Pick a homeroom to start its drawing.
        </p>
      </div>

      <div className="grid">
        {homerooms.map((homeroom) => {
          const win = winForHomeroomThisMonth(history, homeroom.name, monthKey);
          const empty = homeroom.candidates.length === 0;
          const classes = [
            'homeroom',
            empty && !win ? 'empty' : '',
            win ? 'done' : '',
            homeroom.name === NO_HOMEROOM ? 'unassigned' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={homeroom.name} className={classes}>
              <div className="name">{homeroom.name}</div>

              {win ? (
                <div className="winner">🎉 {win.studentName}</div>
              ) : empty ? (
                <div className="meta">No one can win this month</div>
              ) : (
                <div className="meta">
                  {homeroom.candidates.length} can win · {homeroom.students.length} in the class
                </div>
              )}

              <RoundMeter homeroom={homeroom} />

              <div className="row">
                <button
                  className={win ? 'secondary' : 'primary'}
                  onClick={() => onDraw(homeroom)}
                  disabled={empty && !win}
                >
                  {win ? 'Draw again' : 'Draw a winner'}
                </button>
                <button
                  className="ghost"
                  onClick={() => setExpanded(expanded === homeroom.name ? null : homeroom.name)}
                  aria-expanded={expanded === homeroom.name}
                >
                  {expanded === homeroom.name ? 'Hide names' : 'Who can win?'}
                </button>
              </div>

              {expanded === homeroom.name && (
                <div>
                  {homeroom.candidates.length > 0 ? (
                    <ol className="namelist small">
                      {homeroom.candidates.map((s) => (
                        <li key={s.matchKey}>{s.displayName}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="small muted">Nobody in this homeroom can win this month.</p>
                  )}
                  <p className="small muted">
                    {homeroom.blockedByOverdue.length} with an overdue book this month ·{' '}
                    {homeroom.alreadyWonThisRound.length} already had a turn this round
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
