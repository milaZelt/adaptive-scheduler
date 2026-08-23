import type { CalendarEvent } from "@/lib/calendar/types";
import { addDays, parseLocalDate, toISODate } from "@/lib/calendar/dateUtils";
import type { GoogleCalendarEvent } from "./calendar";

/** Reads the date/hour straight out of an RFC3339 string (e.g.
 *  "2026-08-15T14:30:00-04:00") as text, without building a Date object.
 *  Building a Date would convert through some timezone and silently shift
 *  the time - this app never wants that. */
function parseWallClock(dateTime: string): { date: string; hour: number } {
  const match = dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Unrecognized Google dateTime format: ${dateTime}`);
  const [, date, hourStr, minuteStr] = match;
  return { date, hour: Number(hourStr) + Number(minuteStr) / 60 };
}

/** Turns one Google Calendar event into zero or more CalendarEvent rows,
 *  clipped to [horizonStartISO, horizonEndISO]. A multi-day all-day event
 *  becomes one row per day, since CalendarEvent can't span multiple days -
 *  same idea as how a recurring event becomes one row per occurrence. */
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
    // All-day: Google's end.date doesn't include the last day (start=Aug 15,
    // end=Aug 16 means just Aug 15). So the real last day is one day before
    // end.date.
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

    // An event that crosses midnight doesn't fit our one-date-per-row model.
    // We cut it off at midnight instead of dropping it or showing it past
    // the grid's range.
    const end = endWall.date === startWall.date ? endWall.hour : 24;

    return [{ ...base, date: startWall.date, allDay: false, start: startWall.hour, end }];
  }

  return [];
}
