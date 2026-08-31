/** ISO week key ('2026-W36') used to group one week's drawings. */
import type { CalendarDate } from './types';

export function weekKeyFor(date: CalendarDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));

  // ISO weeks run Monday–Sunday and belong to the year containing their Thursday.
  const dayIndex = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - dayIndex + 3);
  const isoYear = dt.getUTCFullYear();

  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3);

  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
