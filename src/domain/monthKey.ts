/**
 * Calendar-month key ('2026-09') used to group one month's drawings.
 *
 * The month, not the week, is now the unit of a drawing: a homeroom draws once per
 * calendar month, and the circulation reports gathered over that month are what
 * decide who is eligible. A key is derived from the drawing date alone, so nobody
 * has to remember to set a period before drawing.
 */
import type { CalendarDate } from './types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'YYYY-MM-DD' -> 'YYYY-MM'. */
export function monthKeyFor(date: CalendarDate): string {
  return date.slice(0, 7);
}

/** 'YYYY-MM' -> 'September 2026', for anything a person reads. */
export function monthLabelFor(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const name = MONTH_NAMES[month - 1];
  if (!name || !Number.isFinite(year)) return monthKey;
  return `${name} ${year}`;
}
