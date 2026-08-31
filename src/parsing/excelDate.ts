/**
 * Excel stores dates as serial numbers (observed in the real export:
 * 45798.55032407407). Serial 1 is 1900-01-01, but Excel wrongly believes 1900 was
 * a leap year, so serials >= 60 are one day ahead of reality. Using the 1899-12-30
 * epoch absorbs that quirk for every date after 1900-03-01, which is every date
 * this app will ever see.
 */
import type { CalendarDate } from '../domain/types';

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Lowest serial we accept. Below this a number is far more likely to be an id than a date. */
const MIN_PLAUSIBLE_SERIAL = 1000; // 1902-09-26

function toIso(y: number, m: number, d: number): CalendarDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Excel serial -> calendar date, discarding time of day. */
export function serialToCalendarDate(serial: number): CalendarDate | null {
  if (!Number.isFinite(serial) || serial < MIN_PLAUSIBLE_SERIAL) return null;
  const ms = EXCEL_EPOCH_UTC + Math.floor(serial) * MS_PER_DAY;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Parse a due-date cell that may be a serial number, an ISO date, or a
 * locale-ish text date. Returns null when the value is blank or unreadable —
 * the caller decides whether that is "no due date" or "cannot be determined".
 */
export function parseDueDateCell(raw: string | null | undefined): CalendarDate | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  if (/^-?\d+(\.\d+)?$/.test(s)) return serialToCalendarDate(Number(s));

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // M/D/YYYY or M-D-YY, the shapes a US library system exports as text.
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return toIso(year, month, day);
  }

  return null;
}

/** Today, as a local calendar date. Injected into the domain rather than read there. */
export function todayLocal(now: Date = new Date()): CalendarDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Whole-day comparison. Lexicographic works because both are ISO 'YYYY-MM-DD'. */
export function isBefore(a: CalendarDate, b: CalendarDate): boolean {
  return a < b;
}
