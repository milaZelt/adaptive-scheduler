import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  decimalToTimeInput,
  fmtHour,
  fmtShortDate,
  getMonthGridDays,
  getWeekDays,
  parseLocalDate,
  sameDay,
  startOfWeek,
  timeInputToDecimal,
  toISODate,
} from "./dateUtils";

describe("toISODate", () => {
  it("formats local year/month/day, zero-padded", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  // Constructing via new Date(y, m, d) is always local time by definition,
  // so this holds regardless of the test runner's own timezone - the point
  // is proving toISODate reads local components, not that any particular
  // timezone is in effect.
  it("matches the Date's own local components, not a UTC-shifted view", () => {
    const d = new Date(2026, 0, 1, 23, 59);
    expect(toISODate(d)).toBe(`${d.getFullYear()}-01-01`);
  });
});

describe("parseLocalDate", () => {
  it("is the inverse of toISODate", () => {
    const iso = "2026-03-14";
    const d = parseLocalDate(iso);
    expect(toISODate(d)).toBe(iso);
  });

  it("lands on local midnight, not UTC midnight", () => {
    const d = parseLocalDate("2026-06-01");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe("sameDay", () => {
  it("is true for the same calendar day, different times", () => {
    expect(sameDay(new Date(2026, 5, 1, 1, 0), new Date(2026, 5, 1, 23, 0))).toBe(true);
  });

  it("is false across a day, month, or year boundary", () => {
    expect(sameDay(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(false);
    expect(sameDay(new Date(2026, 5, 1), new Date(2026, 6, 1))).toBe(false);
    expect(sameDay(new Date(2026, 5, 1), new Date(2027, 5, 1))).toBe(false);
  });
});

describe("fmtHour", () => {
  it.each([
    [0, "12 AM"],
    [9, "9 AM"],
    [12, "12 PM"],
    [13.5, "1:30 PM"],
    [23.75, "11:45 PM"],
    [11.25, "11:15 AM"],
  ])("formats %s as %s", (decimal, expected) => {
    expect(fmtHour(decimal)).toBe(expected);
  });
});

describe("fmtShortDate", () => {
  it("formats without a year", () => {
    expect(fmtShortDate("2026-08-15")).toBe("Aug 15");
  });

  it("falls back to the raw input for a malformed date", () => {
    expect(fmtShortDate("not-a-date")).toBe("not-a-date");
  });
});

describe("decimalToTimeInput / timeInputToDecimal", () => {
  it("round-trips through both directions", () => {
    for (const decimal of [0, 9.25, 13.5, 23.75]) {
      expect(timeInputToDecimal(decimalToTimeInput(decimal))).toBeCloseTo(decimal);
    }
  });

  it("formats a specific value as HH:MM", () => {
    expect(decimalToTimeInput(9.5)).toBe("09:30");
  });

  it("parses a specific HH:MM value", () => {
    expect(timeInputToDecimal("14:15")).toBe(14.25);
  });
});

describe("startOfWeek", () => {
  it("returns the Sunday of the containing week", () => {
    const wednesday = new Date(2026, 7, 12); // Aug 12, 2026 is a Wednesday
    const sunday = startOfWeek(wednesday);
    expect(sunday.getDay()).toBe(0);
    expect(toISODate(sunday)).toBe("2026-08-09");
  });
});

describe("addDays", () => {
  it("adds and subtracts across a month boundary", () => {
    expect(toISODate(addDays(new Date(2026, 0, 30), 5))).toBe("2026-02-04");
    expect(toISODate(addDays(new Date(2026, 1, 2), -5))).toBe("2026-01-28");
  });
});

describe("addMonths", () => {
  it("adds a month within a normal range", () => {
    expect(toISODate(addMonths(new Date(2026, 5, 15), 1))).toBe("2026-07-15");
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days, starting Sunday, containing the anchor", () => {
    const anchor = new Date(2026, 7, 12);
    const days = getWeekDays(anchor);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days.some((d) => sameDay(d, anchor))).toBe(true);
    for (let i = 1; i < 7; i++) {
      expect(toISODate(days[i])).toBe(toISODate(addDays(days[0], i)));
    }
  });
});

describe("getMonthGridDays", () => {
  it("returns 42 days starting on a Sunday and covering the 1st of the month", () => {
    const anchor = new Date(2026, 7, 12);
    const days = getMonthGridDays(anchor);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(0);
    const firstOfMonth = new Date(2026, 7, 1);
    expect(days.some((d) => sameDay(d, firstOfMonth))).toBe(true);
  });
});
