import type { CalendarEvent } from "@/lib/calendar/types";
import { addDays, parseLocalDate, toISODate } from "@/lib/calendar/dateUtils";
import type { GoogleCalendarEvent } from "./calendar";

/** Reads the literal date/hour digits straight out of an RFC3339 string
 *  (e.g. "2026-08-15T14:30:00-04:00") without ever constructing a Date
 *  object - the embedded offset already encodes the intended wall-clock
 *  moment, so converting through any other timezone (the server's, or any
 *  assumed one) would silently shift it. Matches this app's established
 *  rule that time interpretation never depends on server-local timezone. */
function parseWallClock(dateTime: string): { date: string; hour: number } {
  const match = dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Unrecognized Google dateTime format: ${dateTime}`);
  const [, date, hourStr, minuteStr] = match;
  return { date, hour: Number(hourStr) + Number(minuteStr) / 60 };
}

/** One Google Calendar event -> zero or more insertable CalendarEvent rows,
 *  clipped to [horizonStartISO, horizonEndISO]. Zero or more, not exactly
 *  one: a multi-day all-day event needs one row per spanned day, since this
 *  app's CalendarEvent has no multi-day span concept - the same treatment a
 *  recurring event already gets (one row per real occurrence), just driven
 *  by span length instead of a recurrence rule. */
export function convertGoogleEvent(
  event: GoogleCalendarEvent,
  categoryId: string,
  horizonStartISO: string,
  horizonEndISO: string,
): Omit<CalendarEvent, "id">[] {
  const base = {
    title: event.summary?.trim() || "(No title)",
    categoryId,
    type: "fixed" as const,
    repeat: "none" as const,
    source: "google" as const,
    googleEventId: event.id,
  };

  if (event.start.date && event.end.date) {
    // All-day: Google's end.date is exclusive, even for a single-day event
    // (start=Aug 15, end=Aug 16) - the real last included day is one
    // before end.date.
    const days: string[] = [];
    let cursor = event.start.date;
    while (cursor < event.end.date) {
      if (cursor >= horizonStartISO && cursor <= horizonEndISO) days.push(cursor);
      cursor = toISODate(addDays(parseLocalDate(cursor), 1));
    }
    return days.map((date) => ({ ...base, date, allDay: true, start: null, end: null }));
  }

  if (event.start.dateTime && event.end.dateTime) {
    const startWall = parseWallClock(event.start.dateTime);
    const endWall = parseWallClock(event.end.dateTime);
    if (startWall.date < horizonStartISO || startWall.date > horizonEndISO) return [];

    // Crossing midnight has no clean single-row fit in this app's
    // one-date-per-row model - clamped to end at midnight rather than
    // dropped entirely or rendered past the grid's actual range.
    const end = endWall.date === startWall.date ? endWall.hour : 24;

    return [{ ...base, date: startWall.date, allDay: false, start: startWall.hour, end }];
  }

  return [];
}
