/** How many children in this homeroom are still waiting for a turn (FR-020). */
import type { Homeroom } from '../../domain/types';

export function RoundMeter({ homeroom }: { homeroom: Homeroom }) {
  const total = homeroom.students.length;
  const taken = homeroom.turnsTaken;
  const pct = total === 0 ? 0 : Math.round((taken / total) * 100);

  return (
    <div>
      <div className="meter" role="img" aria-label={`${taken} of ${total} have had a turn`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="meta small">
        Round {homeroom.currentRound} · {homeroom.turnsRemaining} of {total} still waiting for a turn
      </div>
    </div>
  );
}
