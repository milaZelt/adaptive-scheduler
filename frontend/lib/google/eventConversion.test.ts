import { describe, expect, it } from "vitest";
import { convertGoogleEvent } from "./eventConversion";
import type { GoogleCalendarEvent } from "./calendar";

// Same bounds and cases already manually verified via a live scratch route
// during development - ported here as permanent regression tests instead
// of a throwaway route.
const HORIZON_START = "2026-08-11";
const HORIZON_END = "2026-08-24"; // 14 days
const CATEGORY_ID = "cat-123";

function convert(event: GoogleCalendarEvent) {
  return convertGoogleEvent(event, CATEGORY_ID, HORIZON_START, HORIZON_END);
}

describe("convertGoogleEvent - timed events", () => {
  it("reads the literal wall-clock digits regardless of a non-UTC offset", () => {
    const rows = convert({
      id: "ev1",
      summary: "Team sync",
      start: { dateTime: "2026-08-15T14:30:00-04:00" },
      end: { dateTime: "2026-08-15T15:00:00-04:00" },
    });
    expect(rows).toEqual([
      expect.objectContaining({ date: "2026-08-15", allDay: false, start: 14.5, end: 15 }),
    ]);
  });

  it("reads the literal wall-clock digits for a UTC (Z) offset the same way", () => {
    const rows = convert({
      id: "ev2",
      summary: "UTC meeting",
      start: { dateTime: "2026-08-15T09:00:00Z" },
      end: { dateTime: "2026-08-15T10:00:00Z" },
    });
    expect(rows).toEqual([
      expect.objectContaining({ date: "2026-08-15", allDay: false, start: 9, end: 10 }),
    ]);
  });

  it("clamps an event that crosses midnight to end at 24 rather than spanning rows", () => {
    const rows = convert({
      id: "ev7",
      summary: "Late flight",
      start: { dateTime: "2026-08-20T23:00:00-04:00" },
      end: { dateTime: "2026-08-21T01:00:00-04:00" },
    });
    expect(rows).toEqual([
      expect.objectContaining({ date: "2026-08-20", start: 23, end: 24 }),
    ]);
  });

  it("drops a timed event entirely outside the horizon", () => {
    const rows = convert({
      id: "ev6",
      summary: "Next month",
      start: { dateTime: "2026-09-15T10:00:00-04:00" },
      end: { dateTime: "2026-09-15T11:00:00-04:00" },
    });
    expect(rows).toEqual([]);
  });

  it("falls back to a placeholder title when summary is missing", () => {
    const rows = convert({
      id: "ev8",
      start: { dateTime: "2026-08-15T12:00:00-04:00" },
      end: { dateTime: "2026-08-15T13:00:00-04:00" },
    });
    expect(rows[0].title).toBe("(No title)");
  });

  it("carries source, googleEventId, categoryId, type, and repeat on every row", () => {
    const rows = convert({
      id: "ev-fields",
      summary: "Field check",
      start: { dateTime: "2026-08-15T12:00:00-04:00" },
      end: { dateTime: "2026-08-15T13:00:00-04:00" },
    });
    expect(rows[0]).toMatchObject({
      source: "google",
      googleEventId: "ev-fields",
      categoryId: CATEGORY_ID,
      type: "fixed",
      repeat: "none",
    });
  });
});

describe("convertGoogleEvent - all-day events", () => {
  it("produces exactly one row for a single-day all-day event", () => {
    const rows = convert({
      id: "ev3",
      summary: "Holiday",
      start: { date: "2026-08-16" },
      end: { date: "2026-08-17" }, // exclusive, per Google's convention
    });
    expect(rows).toEqual([
      expect.objectContaining({ date: "2026-08-16", allDay: true, start: null, end: null }),
    ]);
  });

  it("expands a multi-day all-day event into one row per spanned day", () => {
    const rows = convert({
      id: "ev4",
      summary: "Conference",
      start: { date: "2026-08-18" },
      end: { date: "2026-08-21" }, // exclusive - spans 18, 19, 20
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-08-18", "2026-08-19", "2026-08-20"]);
  });

  it("clips a multi-day all-day event that straddles the horizon start", () => {
    const rows = convert({
      id: "ev5",
      summary: "Trip",
      start: { date: "2026-08-09" },
      end: { date: "2026-08-13" }, // real span is 09-12, horizon starts 08-11
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-08-11", "2026-08-12"]);
  });
});

describe("convertGoogleEvent - malformed input", () => {
  it("throws on an unrecognized dateTime format rather than silently misinterpreting it", () => {
    expect(() =>
      convert({
        id: "ev-bad",
        start: { dateTime: "not-a-real-timestamp" },
        end: { dateTime: "2026-08-15T13:00:00-04:00" },
      }),
    ).toThrow(/Unrecognized Google dateTime format/);
  });

  it("returns no rows for an event with neither a date nor a dateTime", () => {
    // start/end are both optional fields, matching what an untrusted
    // third-party API response could actually send.
    expect(convert({ id: "ev-empty", start: {}, end: {} })).toEqual([]);
  });
});
