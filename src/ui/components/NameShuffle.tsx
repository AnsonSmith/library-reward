/**
 * The reveal: names cycle fast, then slow to a stop on the winner.
 *
 * It only ever cycles CANDIDATE names. A child who cannot win this week never
 * appears on the screen the class is watching (FR-031) — that is a property of
 * what this component is given, not of remembering to hide something.
 *
 * Reduced motion shortens the build-up rather than removing it: the slowing-down
 * is what reads to a child as a fair drawing (research R9).
 */
import { useEffect, useRef, useState } from 'react';
import type { RosterEntry } from '../../domain/types';

export type RevealPhase = 'idle' | 'spinning' | 'won';

interface Props {
  candidates: RosterEntry[];
  winner: RosterEntry | null;
  phase: RevealPhase;
  reduced: boolean;
  onSettled: () => void;
}

export function NameShuffle({ candidates, winner, phase, reduced, onSettled }: Props) {
  const [shown, setShown] = useState<string>('');
  const timer = useRef<number | null>(null);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    if (phase !== 'spinning' || candidates.length === 0) return;

    // Start fast, then stretch each interval until it stops — the deceleration is
    // the whole effect.
    const totalSteps = reduced ? 8 : 28;
    let step = 0;
    let index = Math.floor(Math.random() * candidates.length);

    const next = (): void => {
      index = (index + 1 + Math.floor(Math.random() * 3)) % candidates.length;
      setShown(candidates[index]!.displayName);
      step += 1;

      if (step >= totalSteps) {
        settled.current();
        return;
      }
      const progress = step / totalSteps;
      const delay = 45 + Math.pow(progress, 3) * (reduced ? 120 : 420);
      timer.current = window.setTimeout(next, delay);
    };

    timer.current = window.setTimeout(next, 45);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [phase, candidates, reduced]);

  const text = phase === 'won' && winner ? winner.displayName : phase === 'idle' ? '' : shown;

  return (
    <div className={`namecard ${phase === 'spinning' ? 'spinning' : ''} ${phase === 'won' ? 'won' : ''}`}>
      {phase === 'won' && (
        <div className="crown" aria-hidden="true">
          🎉
        </div>
      )}
      <div
        className="who"
        aria-live={phase === 'won' ? 'assertive' : 'off'}
        aria-atomic="true"
      >
        {text || ' '}
      </div>
    </div>
  );
}
