/**
 * The moment the whole app exists for.
 *
 * The reveal is given only this homeroom's candidates, so a child who cannot win
 * this month is never rendered on the screen the class is watching, and no reason
 * for their absence is ever displayed (FR-020, FR-031).
 */
import { useEffect, useMemo, useState } from 'react';
import { drawWinner } from '../../domain/drawing';
import type { Homeroom, RosterEntry, WinRecord } from '../../domain/types';
import { NameShuffle, type RevealPhase } from '../components/NameShuffle';
import { Confetti } from '../components/Confetti';

interface Props {
  homeroom: Homeroom;
  existingWin: WinRecord | null;
  reduced: boolean;
  onRecord: (winner: RosterEntry, replacing: WinRecord | null) => void;
  onBack: () => void;
}

export function DrawScreen({ homeroom, existingWin, reduced, onRecord, onBack }: Props) {
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [winner, setWinner] = useState<RosterEntry | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [recorded, setRecorded] = useState(false);

  const candidates = useMemo(() => homeroom.candidates, [homeroom]);

  // Moving to a different homeroom must never carry a previous winner across.
  useEffect(() => {
    setPhase('idle');
    setWinner(null);
    setRecorded(false);
    setConfirmReplace(false);
  }, [homeroom.name]);

  const begin = (): void => {
    if (candidates.length === 0) return;
    const picked = drawWinner(candidates);
    if (!picked) return;
    setWinner(picked);
    setRecorded(false);
    setPhase('spinning');
  };

  const settle = (): void => {
    setPhase('won');
    setCelebrate((n) => n + 1);
  };

  const skip = (): void => {
    if (phase === 'spinning') settle();
  };

  const keep = (): void => {
    if (!winner || recorded) return;
    onRecord(winner, existingWin);
    setRecorded(true);
  };

  if (candidates.length === 0 && phase === 'idle') {
    return (
      <div className="stack">
        <button className="ghost" onClick={onBack}>
          ← All homerooms
        </button>
        <div className="stage">
          <div className="homeroom-label">{homeroom.name}</div>
          <div className="namecard">
            <div className="who" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}>
              No drawing this month
            </div>
          </div>
          <p className="lede" style={{ textAlign: 'center' }}>
            Everyone in this class will be back in the drawing next month.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row no-print">
        <button className="ghost" onClick={onBack}>
          ← All homerooms
        </button>
        {existingWin && phase === 'idle' && !confirmReplace && (
          <span className="tag">Already drawn this month: {existingWin.studentName}</span>
        )}
      </div>

      <Confetti fire={celebrate} reduced={reduced} />

      <div className="stage">
        <div className="homeroom-label">{homeroom.name}</div>

        <NameShuffle
          candidates={candidates}
          winner={winner}
          phase={phase}
          reduced={reduced}
          onSettled={settle}
        />

        {phase === 'idle' && !confirmReplace && (
          <div className="stack" style={{ alignItems: 'center' }}>
            <button
              className="primary big wiggle"
              onClick={existingWin ? () => setConfirmReplace(true) : begin}
            >
              {existingWin ? 'Draw again' : 'Start the drawing'}
            </button>
            <p className="muted">
              {candidates.length === 1
                ? 'One child can win this month.'
                : `${candidates.length} children can win this month.`}
            </p>
          </div>
        )}

        {phase === 'idle' && confirmReplace && (
          <div className="notice problem no-print" style={{ maxWidth: '34rem' }}>
            <h3>Replace this month's winner?</h3>
            <p>
              {existingWin?.studentName} was already drawn for {homeroom.name} this month. Drawing
              again will replace them, and they will go back to waiting for a turn.
            </p>
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <button
                className="danger"
                onClick={() => {
                  setConfirmReplace(false);
                  begin();
                }}
              >
                Yes, draw again
              </button>
              <button className="secondary" onClick={() => setConfirmReplace(false)}>
                Keep {existingWin?.studentName}
              </button>
            </div>
          </div>
        )}

        {phase === 'spinning' && (
          <button className="secondary no-print" onClick={skip}>
            Skip to the winner
          </button>
        )}

        {phase === 'won' && (
          <div className="stack no-print" style={{ alignItems: 'center' }}>
            {candidates.length === 1 && (
              <p className="muted">This was the only child who could win this month.</p>
            )}
            {recorded ? (
              <div className="row">
                <span className="tag">Saved</span>
                <button className="primary" onClick={onBack}>
                  Next homeroom →
                </button>
              </div>
            ) : (
              <div className="row">
                <button className="primary big" onClick={keep}>
                  Save this winner
                </button>
                <button className="secondary" onClick={begin}>
                  Draw again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
