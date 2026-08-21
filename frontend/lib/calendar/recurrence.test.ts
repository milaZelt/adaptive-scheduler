import { describe, expect, it } from "vitest";
import type { CalendarEvent, CustomRecurrence } from "./types";
import {
  eventOccursOnDate,
  formatCustomRecurrenceSummary,
  isValidCustomRecurrence,
  repeatOptionLabel,
} from "./recurrence";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    title: "Test event",
    date: "2026-08-01", // a Saturday
    allDay: false,
    start: 9,
    end: 10,
    categoryId: "cat1",
    type: "fixed",
    source: "local",
    repeat: "none",
    ...overrides,
  };
}

function customRule(overrides: Partial<CustomRecurrence>): CustomRecurrence {
  return {
    interval: 1,
    unit: "week",
    daysOfWeek: [6], // Saturday, matching the default anchor above
    endType: "never",
    endDate: "",
    endCount: 1,
    ...overrides,
  };
}

describe("eventOccursOnDate - repeat: none", () => {
  it("occurs only on its own date", () => {
    const e = event({ date: "2026-08-01", repeat: "none" });
    expect(eventOccursOnDate(e, new Date(2026, 7, 1))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2026, 7, 2))).toBe(false);
  });

  it("returns false for a malformed date", () => {
    const e = event({ date: "not-a-date", repeat: "none" });
    expect(eventOccursOnDate(e, new Date(2026, 7, 1))).toBe(false);
  });
});

describe("eventOccursOnDate - simple repeats", () => {
  it("daily: every date on/after the anchor, never before", () => {
    const e = event({ date: "2026-08-01", repeat: "daily" });
    expect(eventOccursOnDate(e, new Date(2026, 7, 1))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2026, 7, 15))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2026, 6, 31))).toBe(false);
  });

  it("weekly: matches the anchor's day-of-week, on/after the anchor", () => {
    const e = event({ date: "2026-08-01", repeat: "weekly" }); // Saturday
    expect(eventOccursOnDate(e, new Date(2026, 7, 8))).toBe(true); // next Saturday
    expect(eventOccursOnDate(e, new Date(2026, 7, 9))).toBe(false); // Sunday
  });

  it("monthly: matches the anchor's day-of-month in a later month", () => {
    const e = event({ date: "2026-08-01", repeat: "monthly" });
    expect(eventOccursOnDate(e, new Date(2026, 8, 1))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2026, 8, 2))).toBe(false);
  });

  it("annually: matches month+day in a later year", () => {
    const e = event({ date: "2026-08-01", repeat: "annually" });
    expect(eventOccursOnDate(e, new Date(2027, 7, 1))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2027, 7, 2))).toBe(false);
  });

  it("weekday: Monday-Friday only, on/after the anchor", () => {
    const e = event({ date: "2026-08-01", repeat: "weekday" }); // Saturday anchor
    expect(eventOccursOnDate(e, new Date(2026, 7, 3))).toBe(true); // Monday
    expect(eventOccursOnDate(e, new Date(2026, 7, 8))).toBe(false); // Saturday
    expect(eventOccursOnDate(e, new Date(2026, 7, 9))).toBe(false); // Sunday
  });
});

describe("eventOccursOnDate - custom recurrence", () => {
  it("day unit: every N days", () => {
    const e = event({
      date: "2026-08-01",
      repeat: "custom",
      customRecurrence: customRule({ unit: "day", interval: 3 }),
    });
    expect(eventOccursOnDate(e, new Date(2026, 7, 4))).toBe(true); // +3
    expect(eventOccursOnDate(e, new Date(2026, 7, 5))).toBe(false); // +4
  });

  it("week unit: specific days of week, every N weeks", () => {
    const e = event({
      date: "2026-08-01", // Saturday, week 0
      repeat: "custom",
      customRecurrence: customRule({ unit: "week", interval: 2, daysOfWeek: [6] }),
    });
    expect(eventOccursOnDate(e, new Date(2026, 7, 8))).toBe(false); // week 1, skipped
    expect(eventOccursOnDate(e, new Date(2026, 7, 15))).toBe(true); // week 2
  });

  it("month unit: specific day of month, every N months", () => {
    const e = event({
      date: "2026-08-01",
      repeat: "custom",
      customRecurrence: customRule({ unit: "month", interval: 2 }),
    });
    expect(eventOccursOnDate(e, new Date(2026, 8, 1))).toBe(false); // +1 month, skipped
    expect(eventOccursOnDate(e, new Date(2026, 9, 1))).toBe(true); // +2 months
  });

  it("year unit: every N years", () => {
    const e = event({
      date: "2026-08-01",
      repeat: "custom",
      customRecurrence: customRule({ unit: "year", interval: 2 }),
    });
    expect(eventOccursOnDate(e, new Date(2027, 7, 1))).toBe(false);
    expect(eventOccursOnDate(e, new Date(2028, 7, 1))).toBe(true);
  });

  it("stops after endDate when endType is 'on'", () => {
    const e = event({
      date: "2026-08-01",
      repeat: "custom",
      customRecurrence: customRule({ unit: "day", interval: 1, endType: "on", endDate: "2026-08-03" }),
    });
    expect(eventOccursOnDate(e, new Date(2026, 7, 3))).toBe(true);
    expect(eventOccursOnDate(e, new Date(2026, 7, 4))).toBe(false);
  });

  it("stops after endCount occurrences when endType is 'after'", () => {
    const e = event({
      date: "2026-08-01",
      repeat: "custom",
      customRecurrence: customRule({ unit: "day", interval: 1, endType: "after", endCount: 3 }),
    });
    // Occurrences land on Aug 1, 2, 3 - the 3rd is still within the count.
    expect(eventOccursOnDate(e, new Date(2026, 7, 3))).toBe(true);
    // Aug 4 would be the 4th occurrence, past endCount.
    expect(eventOccursOnDate(e, new Date(2026, 7, 4))).toBe(false);
  });

  it("returns false with no rule attached", () => {
    const e = event({ date: "2026-08-01", repeat: "custom", customRecurrence: undefined });
    expect(eventOccursOnDate(e, new Date(2026, 7, 1))).toBe(false);
  });
});

describe("isValidCustomRecurrence", () => {
  it("rejects an interval below 1", () => {
    expect(isValidCustomRecurrence(customRule({ interval: 0 }))).toBe(false);
  });

  it("rejects a week rule with no days selected", () => {
    expect(isValidCustomRecurrence(customRule({ unit: "week", daysOfWeek: [] }))).toBe(false);
  });

  it("rejects endType 'on' with a missing or malformed endDate", () => {
    expect(isValidCustomRecurrence(customRule({ endType: "on", endDate: "" }))).toBe(false);
    expect(isValidCustomRecurrence(customRule({ endType: "on", endDate: "garbage" }))).toBe(false);
  });

  it("rejects endType 'after' with a non-positive endCount", () => {
    expect(isValidCustomRecurrence(customRule({ endType: "after", endCount: 0 }))).toBe(false);
  });

  it("accepts a well-formed rule", () => {
    expect(isValidCustomRecurrence(customRule({}))).toBe(true);
  });
});

describe("repeatOptionLabel", () => {
  it("labels each static option", () => {
    const anchor = new Date(2026, 7, 1); // Saturday, Aug 1
    expect(repeatOptionLabel("none", anchor)).toBe("Does not repeat");
    expect(repeatOptionLabel("daily", anchor)).toBe("Daily");
    expect(repeatOptionLabel("weekly", anchor)).toBe("Weekly on Saturday");
    expect(repeatOptionLabel("monthly", anchor)).toBe("Monthly on the 1st");
    expect(repeatOptionLabel("annually", anchor)).toBe("Annually on Aug 1");
    expect(repeatOptionLabel("weekday", anchor)).toBe("Every weekday (Mon–Fri)");
  });
});

describe("formatCustomRecurrenceSummary", () => {
  it("summarizes a simple weekly rule", () => {
    const summary = formatCustomRecurrenceSummary(customRule({ interval: 1, daysOfWeek: [1, 3] }));
    expect(summary).toBe("Every week on Monday, Wednesday");
  });

  it("pluralizes the interval and includes an end condition", () => {
    const summary = formatCustomRecurrenceSummary(
      customRule({ interval: 2, unit: "month", endType: "after", endCount: 5 }),
    );
    expect(summary).toBe("Every 2 months, 5 times");
  });
});
